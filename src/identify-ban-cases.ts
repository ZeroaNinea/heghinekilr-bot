import { readFile, writeFile } from "node:fs/promises";

import connection, { sequelize } from "@/config/db.js";
import BanMessage, { type IBanMessage } from "@/models/BanMessage.js";
import BanCase, { type IBanCase } from "@/models/BanCase.js";

interface UsernameMatchReport {
  matched_users: {
    user_id: string;
    current_username: string;
    historical_candidates: string[];
    source_message_ids: string[];
  }[];
}

interface HistoricalUsernames {
  users: {
    user_id: string;
    current_username: string;
    historical_names: {
      value: string;
      occurrences: {
        value: string;
        message_id: string;
        message_url: string;
        created_at: string;
        embed_index: number;
        field_index: number;
      }[];
    }[];
    status: string;
  }[];
}

interface TheRemainingUsernamesAndIds {
  user_id: string;
  username: string;
  historical_usernames: string[];
}

const banCaseGroups: number[][] = [
  [1],
  [2],
  [3],
  [4],
  [5, 6, 7, 8],
  [9],
  [10],
  [11],
  [12],
  [13],
  [14],
  [15],
  [16],
  [17],
  [18],
  [19],
  [20],
  [21],
  [22],
  [23],
  [24],
  [25],
  [26],
  [35],
  [43],
  [44],
  [45],
  [46],
  [47],
  [48],
  [49],
  [50],
  [51],
  [52],
  [53],
  [54],
  [55],
  [56],
  [57],
  [59, 58],
  [60, 58],
  [61],
  [62],
  [63],
  [64],
  [66],
  [67],
  [68],
  [69],
  [70],
  [72],
  [73],
  [74],
  [75],
  [76],
  [77],
  [78],
  [79],
  [80],
  [83],
  [84],
  [85],
  [86],
  [87],
  [88],
  [89],
  [90],
  [91],
  [92],
  [93],
  [94],
  [95, 96],
  [97],
  [98],
  [99],
  [100],
  [101],
  [102, 103],
  [105],
  [106],
  [107],
  [108],
  [109],
  [110],
  [111],
  [112],
  [113],
  [114],
];

const banCases: IBanCase[] = [];

const labelRegex = /(?:usernames?|[ūǓ]zrnāmz?)\s*:\s*/giu;

function findUsernames(message: string): string[] {
  const usernames: string[] = [];

  for (const match of message.matchAll(labelRegex)) {
    const start = (match.index ?? 0) + match[0].length;
    const remainder = message.slice(start);

    const end = remainder.search(/(?:\.\s+|\s+Reason\s*:|\s+ĪD\s*:|[)\r\n])/iu);

    const value = (end === -1 ? remainder : remainder.slice(0, end)).trim();

    const cleaned = value.replace(/^[("'`]+|[)"'`]+$/gu, "");

    usernames.push(
      ...cleaned
        .split(/\s+and\s+/iu)
        .map((name) => name.trim().replace(/[,!?;:]+$/gu, ""))
        .filter(Boolean),
    );
  }

  return usernames;
}

async function identifyBanCases() {
  connection();
  sequelize.sync();

  const [
    usernameMatchText,
    historicalUsernamesText,
    theRemainingUsernamesText,
  ] = await Promise.all([
    readFile("username-match-report.json", "utf8"),
    readFile("historical-usernames.json", "utf8"),
    readFile("the-remaining-usernames-and-ids.json", "utf8"),
  ]);

  const usernameMatch = JSON.parse(usernameMatchText) as UsernameMatchReport;
  const historicalUsernames = JSON.parse(
    historicalUsernamesText,
  ) as HistoricalUsernames;
  const theRemainingUsernamesAndIds = JSON.parse(
    theRemainingUsernamesText,
  ) as TheRemainingUsernamesAndIds[];

  const banMessages = await BanMessage.findAll();

  // BanCase.destroy({ where: {}, truncate: true });

  const messageGroups: IBanMessage[][] = [];

  banCaseGroups.map((banCaseGroup) => {
    const messageGroup: IBanMessage[] = [];
    banCaseGroup.map((messageId) => {
      const banMessage = banMessages.find(
        (message) => message.id === messageId,
      );

      if (banMessage) messageGroup.push(banMessage);
    });

    // console.log(messageGroup);

    messageGroups.push(messageGroup);
  });

  messageGroups.forEach((messageGroup, index) => {
    const id: number = index;
    const guildIds: string[] = [];
    const authorId: string = messageGroup[0]?.author_id || "";
    const bannedUsernames: string[] = [];
    const bannedIds: string[] = [];
    const banReason: string[] = [];
    const sourceUrls: string[] = [];

    messageGroup.forEach((message) => {
      guildIds.push(message.guild_id);
      bannedUsernames.push(...findUsernames(message.message));
      if (message.user_id) {
        bannedIds.push(message.user_id);
      } else {
        usernameMatch.matched_users.forEach((user) => {
          bannedUsernames.forEach((username) => {
            if (
              user.historical_candidates.includes(username) ||
              user.current_username === username
            ) {
              bannedIds.push(user.user_id);
            }
          });
        });

        historicalUsernames.users.forEach((user) => {
          bannedUsernames.forEach((username) => {
            user.historical_names.forEach((historicalName) => {
              if (
                historicalName.value === username ||
                user.current_username === username
              ) {
                bannedIds.push(user.user_id);
              }
            });
          });
        });

        theRemainingUsernamesAndIds.forEach((user) => {
          bannedUsernames.forEach((username) => {
            if (
              user.historical_usernames.includes(username) ||
              user.username === username
            ) {
              bannedIds.push(user.user_id);
            }
          });
        });
      }
      banReason.push(message.message);
      sourceUrls.push(
        `https://discord.com/channels/${message.guild_id}/${message.channel_id}/${message.message_id}`,
      );
    });

    const uniqueGuildIds = [...new Set(guildIds)];
    const uniqueBannedUsernames = [...new Set(bannedUsernames)];
    const uniqueBannedIds = [...new Set(bannedIds)];
    const mergedReason = banReason.join("\n");
    const uniqueSourceUrls = [...new Set(sourceUrls)];

    banCases.push({
      id: id,
      guild_ids: uniqueGuildIds,
      author_id: authorId,
      banned_usernames: uniqueBannedUsernames,
      banned_ids: uniqueBannedIds,
      reason: mergedReason,
      source_urls: uniqueSourceUrls,
    });
  });

  // console.log(banCases);

  await writeFile("ban-cases.json", JSON.stringify(banCases, null, 2), "utf8");
}

identifyBanCases();
