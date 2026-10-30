import connection from "@/config/db.js";
import { sequelize } from "@/config/db.js";

import BanMessage from "@/models/BanMessage.js";
// import BanAttachment from "@/models/BanAttachment.js";

const labelRegex = /(?:usernames?|ūzrnāmz?)\s*:\s*/giu;

function findUsernames(message: string): string[] {
  const usernames: string[] = [];

  for (const match of message.matchAll(labelRegex)) {
    const start = (match.index ?? 0) + match[0].length;

    // Stop at a closing parenthesis or line break, if present.
    const remainder = message.slice(start);
    const end = remainder.search(/[)\r\n]/u);
    const value = (end === -1 ? remainder : remainder.slice(0, end)).trim();

    // Remove surrounding quotes/backticks, then split plural examples on "and".
    const cleaned = value.replace(/^[("'`]+|[)"'`]+$/gu, "");
    usernames.push(
      ...cleaned
        .split(/\s+and\s+/iu)
        .map((name) => name.trim().replace(/[.,!?;:]+$/u, ""))
        .filter(Boolean),
    );
  }

  return usernames;
}

async function identifyBanCases(): Promise<string[]> {
  await connection();
  await sequelize.sync();

  const banMessages = await BanMessage.findAll();
  // const banAttachments = await BanAttachment.findAll();

  const usernames: string[] = [];

  for (let banMessage of banMessages) {
    usernames.push(...findUsernames(banMessage.message));
  }

  return usernames;
}

identifyBanCases()
  .then((usernames) =>
    console.log(
      "Usernames:",
      usernames,
      "\n",
      "The number of usernames:",
      usernames.length,
    ),
  )
  .catch(console.error);
