import "dotenv/config";
import { REST, Routes, SlashCommandBuilder } from "discord.js";

const token = process.env["DISCORD_TOKEN"];
const clientId = process.env["DISCORD_CLIENT_ID"];
const guildId = process.env["DISCORD_GUILD_ID"];

if (!token || !clientId || !guildId) {
  throw new Error(
    "DISCORD_TOKEN, DISCORD_CLIENT_ID, and DISCORD_GUILD_ID must be set in .env",
  );
}

const commands = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check whether Heghinekilr Bot is alive!")
    .toJSON(),
];

const rest = new REST({ version: "10" }).setToken(token);

try {
  console.log("Registering guild commands...");

  await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
    body: commands,
  });

  console.log("Successfully registered /ping!");
} catch (error) {
  console.error("Failed to register commands:", error);
  process.exitCode = 1;
}
