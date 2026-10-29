import "dotenv/config";

import { writeFile } from "node:fs/promises";
import { Client, Events, GatewayIntentBits, type Message } from "discord.js";

interface BannedUser {
  user_id: string;
  username: string;
  global_name: string | null;
  display_tag: string;
}

const token = process.env["DISCORD_TOKEN"];
const channelId = process.env["TYK_LOG_CHANNEL_ID"];

if (!token || !channelId) {
  throw new Error("DISCORD_TOKEN and TYK_LOG_CHANNEL_ID must be set in .env");
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

async function searchMakiLogs(): Promise<void> {
  const bannedUsers = JSON.parse(
    await (await import("node:fs/promises")).readFile("tyk-bans.json", "utf8"),
  ) as BannedUser[];

  // const bannedById = new Map(bannedUsers.map((user) => [user.user_id, user]));

  const guildId = process.env["DISCORD_GUILD_ID"];

  if (!guildId) {
    throw new Error("DISCORD_GUILD_ID must be set in .env");
  }

  try {
    const guild = await client.guilds.fetch(guildId);
    const channel = await client.channels.fetch(channelId || "");

    if (
      !channel ||
      !channel.isTextBased() ||
      channel.isDMBased() ||
      !("messages" in channel)
    ) {
      throw new Error(
        "The configured log channel is not a server text channel.",
      );
    }

    console.log(
      `Searching #${channel.name} for ${bannedUsers.length} banned users...`,
    );

    const matches = new Map<
      string,
      {
        message_id: string;
        url: string;
        created_at: string;
        edited_at: string | null;
        author_id: string;
        author_username: string;
        content: string;
        embeds: unknown[];
        matched_users: {
          user_id: string;
          username: string;
          match_type: string[];
        }[];
      }
    >();

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
        const lowerText = searchableText.toLowerCase();

        const matchedUsers = [];

        for (const user of bannedUsers) {
          const matchTypes: string[] = [];

          // Match an exact ID occurrence, avoiding partial numeric matches.
          const escapedId = user.user_id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          if (new RegExp(`(?<!\\d)${escapedId}(?!\\d)`).test(searchableText)) {
            matchTypes.push("user_id");
          }

          if (message.mentions.users.has(user.user_id)) {
            matchTypes.push("mention");
          }

          // Search usernames only when they are not generated deleted-user names.
          if (
            !user.username.startsWith("deleted_user_") &&
            lowerText.includes(user.username.toLowerCase())
          ) {
            matchTypes.push("username");
          }

          if (matchTypes.length > 0) {
            matchedUsers.push({
              user_id: user.user_id,
              username: user.username,
              match_type: matchTypes,
            });
          }
        }

        if (matchedUsers.length > 0) {
          matches.set(message.id, {
            message_id: message.id,
            url: `https://discord.com/channels/${guild.id}/${channel.id}/${message.id}`,
            created_at: message.createdAt.toISOString(),
            edited_at: message.editedAt?.toISOString() ?? null,
            author_id: message.author.id,
            author_username: message.author.username,
            content: message.content,
            embeds: message.embeds.map((embed) => embed.toJSON()),
            matched_users: matchedUsers,
          });
        }
      }

      scanned += messages.size;
      before = messages.last()!.id;

      console.log(
        `Scanned ${scanned} messages; found ${matches.size} matching messages.`,
      );

      if (messages.size < 100) {
        break;
      }
    }

    const output = [...matches.values()];

    await writeFile(
      "maki-ban-matches.json",
      JSON.stringify(output, null, 2),
      "utf8",
    );

    console.log(`Finished! Scanned ${scanned} messages.`);
    console.log(`Matching messages: ${output.length}`);
    console.log("Output: maki-ban-matches.json");
  } finally {
    client.destroy();
  }
}

client.once(Events.ClientReady, () => {
  void searchMakiLogs().catch((error: unknown) => {
    console.error("Maki log search failed:", error);
    process.exitCode = 1;
  });
});

await client.login(token);
