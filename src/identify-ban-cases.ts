import { readFile } from "node:fs/promises";

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
  [58],
  [59],
  [60],
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
];

const labelRegex = /(?:usernames?|ūzrnāmz?)\s*:\s*/giu;

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

async function identifyBanCases() {
  const [
    usernameMatchText,
    historicalUsernamesText,
    theRemainingUsernamesText,
  ] = await Promise.all([
    readFile("username-match-report", "utf8"),
    readFile("historical-usernames.json", "utf8"),
    readFile("the-remaining-usernames-and-ids.json", "utf8"),
  ]);

  const usernameMatch = JSON.parse(usernameMatchText) as UsernameMatchReport;
  const historicalUsernames = JSON.parse(
    historicalUsernamesText,
  ) as HistoricalUsernames;
  const theRemainingUsernamesAndIds = JSON.parse(
    theRemainingUsernamesText,
  ) as TheRemainingUsernamesAndIds;
}
