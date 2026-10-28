import "dotenv/config";
import { Client, Events, GatewayIntentBits } from "discord.js";

const token = process.env["DISCORD_TOKEN"];

if (!token) {
  throw new Error("DISCORD_TOKEN is missing from .env");
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
  console.log(`Bot ID: ${readyClient.user.id}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  if (interaction.commandName === "ping") {
    await interaction.reply("Pong! Heghinekilr Bot is alive! :3");
  }
});

client.on(Events.Error, (error) => {
  console.error("Discord client error:", error);
});

await client.login(token);
