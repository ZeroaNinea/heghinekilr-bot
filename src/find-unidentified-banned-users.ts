import "dotenv/config";

import { readFile, writeFile } from "node:fs/promises";
import {
  Client,
  Events,
  GatewayIntentBits,
  type Message,
  type Embed,
} from "discord.js";

interface BannedUser {
  user_id: string;
  username: string;
  global_name: string | null;
  display_tag: string;
}

interface MatchReport {
  unmatched_current_bans: {
    user_id: string;
    username: string;
  }[];
}

interface LogEntry {
  message_id: string;
  url: string;
  created_at: string;
  edited_at: string | null;
  author_id: string;
  author_username: string;
  content: string;
  embeds: unknown[];
  matching_user: {
    user_id: string;
    current_username: string;
  };
  searchable_text: string;
  username_candidates: {
    value: string;
    source: string;
    confidence: "candidate";
  }[];
}

const token = process.env["DISCORD_TOKEN"];
const channelId = process.env["TYK_LOG_CHANNEL_ID"];
const guildId = process.env["DISCORD_GUILD_ID"];

if (!token || !channelId || !guildId) {
  throw new Error(
    "DISCORD_TOKEN, TYK_LOG_CHANNEL_ID, and DISCORD_GUILD_ID must be set in .env",
  );
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

function getSearchableText(message: Message): string {
  const parts = [message.content];

  for (const embed of message.embeds) {
    parts.push(
      embed.title ?? "",
      embed.description ?? "",
      embed.author?.name ?? "",
      embed.footer?.text ?? "",
    );

    for (const field of embed.fields) {
      parts.push(field.name, field.value);
    }
  }

  return parts.join("\n");
}

/**
 * Extracts possible username values from labeled log fields.
 *
 * These are candidates only. The script cannot assume that every field
 * containing "name" identifies the banned Discord account.
 */
function extractUsernameCandidates(
  message: Message,
  targetId: string,
): LogEntry["username_candidates"] {
  const candidates = new Map<string, LogEntry["username_candidates"][number]>();

  function addCandidate(value: string, source: string): void {
    const cleaned = value
      .trim()
      .replace(/^["'`]+|["'`]+$/gu, "")
      .replace(/[,\s]+$/gu, "");

    if (!cleaned || cleaned === targetId) {
      return;
    }

    // Exclude raw numeric IDs and very short strings.
    if (/^\d+$/u.test(cleaned) || cleaned.length < 2) {
      return;
    }

    const key = cleaned.toLowerCase();

    if (!candidates.has(key)) {
      candidates.set(key, {
        value: cleaned,
        source,
        confidence: "candidate",
      });
    }
  }

  function inspectText(text: string, source: string): void {
    /*
     * Match common labels such as:
     * Username: example
     * Old Username: example
     * New Username: example
     * User: example
     * Member: example
     *
     * The value ends at a newline or another common field label.
     */
    const labelPattern =
      /(?:old\s+username|new\s+username|previous\s+username|username|user\s+name|display\s+name|member|target\s+user|user)\s*[:=]\s*([^\r\n]+)/giu;

    for (const match of text.matchAll(labelPattern)) {
      const value = match[1];

      if (!value) {
        continue;
      }

      // Avoid accidentally treating a long sentence as a username.
      const cleaned = value.trim();

      if (cleaned.length <= 100) {
        addCandidate(cleaned, source);
      }
    }
  }

  inspectText(message.content, "message content");

  for (const [index, embed] of message.embeds.entries()) {
    const embedPrefix = `embed ${index + 1}`;

    inspectText(embed.title ?? "", `${embedPrefix} title`);
    inspectText(embed.description ?? "", `${embedPrefix} description`);
    inspectText(embed.author?.name ?? "", `${embedPrefix} author`);

    for (const [fieldIndex, field] of embed.fields.entries()) {
      const source = `${embedPrefix} field ${fieldIndex + 1}`;

      // The field name itself may be "Username", "Old Username", etc.
      if (
        /(?:old\s+username|new\s+username|previous\s+username|username|user\s+name|display\s+name|member|target\s+user|user)/iu.test(
          field.name,
        )
      ) {
        addCandidate(field.value, `${source}: ${field.name}`);
      }

      inspectText(`${field.name}: ${field.value}`, source);
    }

    inspectText(embed.footer?.text ?? "", `${embedPrefix} footer`);
  }

  /*
   * A log entry may show the target's username in the embed author,
   * even if the ID appears elsewhere in the same message.
   * Keep this as a candidate rather than treating it as verified.
   */
  for (const embed of message.embeds) {
    const authorName = embed.author?.name?.trim();

    if (authorName && authorName !== targetId) {
      addCandidate(authorName, "embed author name");
    }
  }

  return [...candidates.values()];
}

async function findUnidentifiedBanUsers(): Promise<void> {
  const [bannedUsersText, reportText] = await Promise.all([
    readFile("tyk-bans.json", "utf8"),
    readFile("username-match-report.json", "utf8"),
  ]);

  const bannedUsers = JSON.parse(bannedUsersText) as BannedUser[];
  const matchReport = JSON.parse(reportText) as MatchReport;

  /*
   * Use the report's unmatched list as the starting point.
   * Deleted accounts are excluded because their historical identities
   * have already been resolved separately.
   */
  const unresolvedUsers = matchReport.unmatched_current_bans
    .filter((user) => !user.username.startsWith("deleted_user_"))
    .map((unresolved) => {
      const fullUser = bannedUsers.find(
        (user) => user.user_id === unresolved.user_id,
      );

      return {
        user_id: unresolved.user_id,
        username: fullUser?.username ?? unresolved.username,
      };
    });

  if (unresolvedUsers.length === 0) {
    console.log("No unresolved accounts remain in the report.");
    return;
  }

  // const unresolvedById = new Map(
  //   unresolvedUsers.map((user) => [user.user_id, user]),
  // );

  console.log(
    `Searching Maki logs for ${unresolvedUsers.length} unresolved accounts...`,
  );

  const guild = await client.guilds.fetch(guildId || "");
  const channel = await client.channels.fetch(channelId || "");

  if (
    !channel ||
    !channel.isTextBased() ||
    channel.isDMBased() ||
    !("messages" in channel)
  ) {
    throw new Error("The configured log channel is not a server text channel.");
  }

  const matches: LogEntry[] = [];
  const seen = new Set<string>();

  let before: string | undefined;
  let scanned = 0;

  while (true) {
    const messages = await channel.messages.fetch({
      limit: 100,
      ...(before ? { before } : {}),
    });

    if (messages.size === 0) {
      break;
    }

    for (const message of messages.values()) {
      const searchableText = getSearchableText(message);

      /*
       * Search for exact Discord IDs, avoiding partial numeric matches.
       * This is more reliable than matching usernames by substring.
       */
      for (const user of unresolvedUsers) {
        const idPattern = new RegExp(`(?<!\\d)${user.user_id}(?!\\d)`);

        const mentioned = message.mentions.users.has(user.user_id);

        if (!idPattern.test(searchableText) && !mentioned) {
          continue;
        }

        const key = `${message.id}:${user.user_id}`;

        if (seen.has(key)) {
          continue;
        }

        seen.add(key);

        matches.push({
          message_id: message.id,
          url: `https://discord.com/channels/${guild.id}/${channel.id}/${message.id}`,
          created_at: message.createdAt.toISOString(),
          edited_at: message.editedAt?.toISOString() ?? null,
          author_id: message.author.id,
          author_username: message.author.username,
          content: message.content,
          embeds: message.embeds.map((embed: Embed) => embed.toJSON()),
          matching_user: {
            user_id: user.user_id,
            current_username: user.username,
          },
          searchable_text: searchableText,
          username_candidates: extractUsernameCandidates(message, user.user_id),
        });
      }
    }

    scanned += messages.size;
    before = messages.last()!.id;

    console.log(
      `Scanned ${scanned} messages; found ${matches.length} user/log matches.`,
    );

    if (messages.size < 100) {
      break;
    }
  }

  const resultsByUser = unresolvedUsers.map((user) => {
    const userMatches = matches.filter(
      (entry) => entry.matching_user.user_id === user.user_id,
    );

    const candidateMap = new Map<
      string,
      {
        value: string;
        sources: string[];
        message_ids: string[];
      }
    >();

    for (const entry of userMatches) {
      for (const candidate of entry.username_candidates) {
        const key = candidate.value.toLowerCase();
        const existing = candidateMap.get(key);

        if (existing) {
          if (!existing.sources.includes(candidate.source)) {
            existing.sources.push(candidate.source);
          }

          if (!existing.message_ids.includes(entry.message_id)) {
            existing.message_ids.push(entry.message_id);
          }
        } else {
          candidateMap.set(key, {
            value: candidate.value,
            sources: [candidate.source],
            message_ids: [entry.message_id],
          });
        }
      }
    }

    return {
      user_id: user.user_id,
      current_username: user.username,
      matching_log_count: userMatches.length,
      username_candidates: [...candidateMap.values()],
      log_entries: userMatches,
    };
  });

  const output = {
    generated_at: new Date().toISOString(),
    scanned_messages: scanned,
    unresolved_users_searched: unresolvedUsers.length,
    users_with_matching_logs: resultsByUser.filter(
      (user) => user.matching_log_count > 0,
    ).length,
    users_without_matching_logs: resultsByUser
      .filter((user) => user.matching_log_count === 0)
      .map(({ user_id, current_username }) => ({
        user_id,
        current_username,
      })),
    users: resultsByUser,
  };

  await writeFile(
    "unidentified-ban-user-logs.json",
    JSON.stringify(output, null, 2),
    "utf8",
  );

  console.log("\nFinished!");
  console.log(`Messages scanned: ${scanned}`);
  console.log(`Unresolved users searched: ${unresolvedUsers.length}`);
  console.log(`Users with matching logs: ${output.users_with_matching_logs}`);
  console.log(
    `Users without matching logs: ${output.users_without_matching_logs.length}`,
  );
  console.log("Output: unidentified-ban-user-logs.json");
}

client.once(Events.ClientReady, () => {
  void findUnidentifiedBanUsers()
    .catch((error: unknown) => {
      console.error("Unidentified ban-user search failed:", error);
      process.exitCode = 1;
    })
    .finally(() => {
      client.destroy();
    });
});

await client.login(token);
