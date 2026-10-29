import "dotenv/config";

import { writeFile } from "node:fs/promises";
import { Client, Events, GatewayIntentBits } from "discord.js";

const token = process.env["DISCORD_TOKEN"];
const guildId = process.env["DISCORD_GUILD_ID"];

if (!token || !guildId) {
  throw new Error("DISCORD_TOKEN and TYK_GUILD_ID must be set in .env");
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

async function exportBans(): Promise<void> {
  try {
    const guild = await client.guilds.fetch(guildId || "");
    const bans = await guild.bans.fetch();

    const records = [...bans.values()].map((ban) => ({
      user_id: ban.user.id,
      username: ban.user.username,
      global_name: ban.user.globalName,
      display_tag: ban.user.tag,
      avatar_url: ban.user.displayAvatarURL(),
    }));

    await writeFile("tyk-bans.json", JSON.stringify(records, null, 2), "utf8");

    console.log(`Exported ${records.length} banned users to tyk-bans.json`);
  } finally {
    client.destroy();
  }
}

client.once(Events.ClientReady, () => {
  void exportBans().catch((error: unknown) => {
    console.error("Failed to export TYK's ban list:", error);
    process.exitCode = 1;
  });
});

await client.login(token);
