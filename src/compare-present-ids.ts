import { readFile, writeFile } from "node:fs/promises";

interface BannedUser {
  user_id: string;
  username: string;
  global_name: string | null;
  display_tag: string;
  avatar_url: string;
}

interface BanCase {
  id: number;
  guild_ids: string[];
  author_id: string;
  banned_usernames: string[];
  banned_ids: string[];
  reason: string;
  source_urls: string[];
}

async function findUnidentifiedUsers() {
  const [bannedUsersText, banCasesText] = await Promise.all([
    readFile("tyk-bans.json", "utf8"),
    readFile("ban-cases.json", "utf8"),
  ]);

  const bannedUsers = JSON.parse(bannedUsersText) as BannedUser[];
  const banCases = JSON.parse(banCasesText) as BanCase[];

  // Collect every Discord ID already mentioned in ban cases.
  const identifiedIds = new Set(
    banCases.flatMap((banCase) => banCase.banned_ids),
  );

  // Find users whose IDs haven't appeared in any ban case.
  const unidentifiedUsers = bannedUsers.filter(
    (user) => !identifiedIds.has(user.user_id),
  );

  await writeFile(
    "unidentified-users.json",
    JSON.stringify(unidentifiedUsers, null, 2),
    "utf8",
  );

  console.log({
    totalUsers: bannedUsers.length,
    identifiedUsers: identifiedIds.size,
    unidentifiedUsers: unidentifiedUsers.length,
  });
}

findUnidentifiedUsers();
