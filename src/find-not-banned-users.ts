import "dotenv/config";

import { writeFile } from "node:fs/promises";
import { Client, Events, GatewayIntentBits, type Message } from "discord.js";

import usernames from "./usernames.js";

const token = process.env["DISCORD_TOKEN"];
const channelId = process.env["TYK_LOG_CHANNEL_ID"];
const guildId = process.env["DISCORD_GUILD_ID"];

if (!token || !channelId || !guildId) {
  throw new Error(
    "DISCORD_TOKEN, TYK_LOG_CHANNEL_ID, and DISCORD_GUILD_ID must be set in .env",
  );
}

interface LogMatch {
  username: string;
  message_id: string;
  url: string;
  created_at: string;
  edited_at: string | null;
  author_id: string;
  author_username: string;
  content: string;
  embeds: unknown[];
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

  // Ordinary embeds
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

  // Discord Components V2
  function extractComponentText(component: any): void {
    if (typeof component.content === "string") {
      parts.push(component.content);
    }

    if (typeof component.label === "string") {
      parts.push(component.label);
    }

    if (typeof component.placeholder === "string") {
      parts.push(component.placeholder);
    }

    if (typeof component.description === "string") {
      parts.push(component.description);
    }

    if (typeof component.title === "string") {
      parts.push(component.title);
    }

    if (Array.isArray(component.components)) {
      for (const child of component.components) {
        extractComponentText(child);
      }
    }

    if (Array.isArray(component.items)) {
      for (const child of component.items) {
        extractComponentText(child);
      }
    }
  }

  for (const component of message.components) {
    extractComponentText(component.toJSON());
  }

  return parts.join("\n");
}

async function searchMakiLogs(): Promise<void> {
  const channel = await client.channels.fetch(channelId!);

  if (
    !channel ||
    !channel.isTextBased() ||
    channel.isDMBased() ||
    !("messages" in channel)
  ) {
    throw new Error("The configured log channel is not a server text channel.");
  }

  console.log("Searching channel:");
  console.log("Name:", channel.name);
  console.log("ID:", channel.id);
  console.log("Guild ID:", channel.guildId);

  const matches: LogMatch[] = [];

  let before: string | undefined;
  let scanned = 0;

  console.log(`Searching for ${usernames.length} usernames...`);

  // let firstMakiLog: Message | null = null;

  while (true) {
    const messages = await channel.messages.fetch({
      limit: 100,
      ...(before ? { before } : {}),
    });

    if (messages.size === 0) {
      break;
    }

    for (const message of messages.values()) {
      // if (message.author.id === "1362250089497628844") {
      //   if (
      //     !firstMakiLog ||
      //     message.createdTimestamp < firstMakiLog.createdTimestamp
      //   ) {
      //     firstMakiLog = message;
      //   }
      // }

      // if (firstMakiLog) {
      //   console.log("\nFirst Maki log found:");
      //   console.log("Message ID:", firstMakiLog.id);
      //   console.log("Date:", firstMakiLog.createdAt.toISOString());
      //   console.log("URL:", firstMakiLog.url);
      // } else {
      //   console.log("No Maki messages found.");
      // }

      const searchableText = getSearchableText(message)
        .replace(/\\_/gu, "_")
        .toLowerCase();

      for (const username of usernames) {
        if (!searchableText.includes(username.toLowerCase())) {
          continue;
        }

        matches.push({
          username,
          message_id: message.id,
          url: `https://discord.com/channels/${guildId}/${channelId}/${message.id}`,
          created_at: message.createdAt.toISOString(),
          edited_at: message.editedAt?.toISOString() ?? null,
          author_id: message.author.id,
          author_username: message.author.username,
          content: message.content,
          embeds: message.embeds.map((embed) => embed.toJSON()),
        });
      }
    }

    scanned += messages.size;
    before = messages.last()!.id;

    console.log(
      `Scanned ${scanned} messages; found ${matches.length} matches.`,
    );

    if (messages.size < 100) {
      break;
    }
  }

  const results = {
    generated_at: new Date().toISOString(),
    scanned_messages: scanned,
    usernames_searched: usernames,
    total_matches: matches.length,
    results: usernames.map((username) => ({
      username,
      matching_logs: matches.filter((match) => match.username === username),
    })),
  };

  await writeFile(
    "maki-username-search.json",
    JSON.stringify(results, null, 2),
    "utf8",
  );

  console.log("\nFinished!");
  console.log(`Messages scanned: ${scanned}`);
  console.log(`Total matches: ${matches.length}`);
  console.log("Output: maki-username-search.json");
}

client.once(Events.ClientReady, () => {
  void searchMakiLogs()
    .catch((error: unknown) => {
      console.error("Maki log search failed:", error);
      process.exitCode = 1;
    })
    .finally(() => {
      client.destroy();
    });
});

await client.login(token);
