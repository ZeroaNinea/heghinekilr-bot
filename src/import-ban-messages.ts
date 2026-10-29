import "dotenv/config";

import { Client, Events, GatewayIntentBits, type Message } from "discord.js";

import connection from "@/config/db.js";
import { sequelize } from "@/config/db.js";
import BanMessage from "@/models/BanMessage.js";

const token = process.env["DISCORD_TOKEN"];
const channelId = process.env["TYK_BAN_CHANNEL_ID"];

if (!token || !channelId) {
  throw new Error("DISCORD_TOKEN and TYK_BAN_CHANNEL_ID must be set in .env");
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

async function importMessages(): Promise<void> {
  try {
    await connection();

    // Development convenience: create the table if it doesn't exist.
    await sequelize.sync();

    const channel = await client.channels.fetch(channelId || "");

    if (
      !channel ||
      !channel.isTextBased() ||
      channel.isDMBased() ||
      !("messages" in channel)
    ) {
      throw new Error("The configured channel is not a text channel.");
    }

    console.log(`Importing messages from ${channel.name}...`);

    let before: string | undefined;
    let imported = 0;

    while (true) {
      const options = {
        limit: 100,
        ...(before ? { before } : {}),
      };

      const messages = await channel.messages.fetch(options);

      if (messages.size === 0) {
        break;
      }

      const rows = [...messages.values()].map((message: Message) => ({
        guild_id: message.guildId!,
        channel_id: message.channelId,
        message_id: message.id,
        author_id: message.author.id,
        user_id: null,
        message: message.content,
      }));

      await BanMessage.bulkCreate(rows, {
        ignoreDuplicates: true,
      });

      imported += messages.size;

      // Continue from the oldest message in this batch.
      before = messages.last()!.id;

      console.log(`Processed ${imported} messages so far...`);

      if (messages.size < 100) {
        break;
      }
    }

    console.log(`Finished! Processed ${imported} messages.`);
  } finally {
    client.destroy();
  }
}

client.once(Events.ClientReady, () => {
  void importMessages().catch((error: unknown) => {
    console.error("Message import failed:", error);
    process.exitCode = 1;
  });
});

await client.login(token);
