import { readFile, writeFile } from "node:fs/promises";

import connection from "@/config/db.js";
import { sequelize } from "@/config/db.js";
import BanMessage from "@/models/BanMessage.js";

interface BannedUser {
  user_id: string;
  username: string;
  global_name: string | null;
  display_tag: string;
  avatar_url: string;
}

interface UsernameOccurrence {
  username: string;
  message_id: string;
}

const labelRegex = /(?:usernames?|ūzrnāmz?)\s*:\s*/giu;

function findUsernames(message: string): string[] {
  const usernames: string[] = [];

  for (const match of message.matchAll(labelRegex)) {
    const start = (match.index ?? 0) + match[0].length;
    const remainder = message.slice(start);

    const end = remainder.search(/(?:\.\s+|\s+Reason\s*:|[)\r\n])/iu);

    const value = (end === -1 ? remainder : remainder.slice(0, end)).trim();

    const cleaned = value.replace(/^[("'`]+|[)"'`]+$/gu, "");

    usernames.push(
      ...cleaned
        .split(/\s+and\s+/iu)
        .map((name) => name.trim().replace(/[,!?;:]+$/u, ""))
        .filter(Boolean),
    );
  }

  return usernames;
}

/**
 * Returns plausible variants without assuming a final period
 * cannot be part of the username.
 */
function getUsernameVariants(username: string): string[] {
  const variants = new Set<string>();
  let current = username.trim();

  variants.add(current.toLowerCase());

  // Try removing a trailing sentence period.
  if (current.endsWith(".")) {
    current = current.slice(0, -1).trimEnd();
    variants.add(current.toLowerCase());
  }

  // Try removing quotation marks/backticks left around punctuation.
  current = current.replace(/^[("'`]+|[)"'`]+$/gu, "").trim();

  if (current) {
    variants.add(current.toLowerCase());
  }

  return [...variants];
}

async function identifyBannedUsernames(): Promise<void> {
  await connection();
  await sequelize.sync();

  const banMessages = await BanMessage.findAll({
    attributes: ["id", "message"],
  });

  const rawBans = await readFile("tyk-bans.json", "utf8");
  const bannedUsers = JSON.parse(rawBans) as BannedUser[];

  const occurrences: UsernameOccurrence[] = [];

  for (const banMessage of banMessages) {
    for (const username of findUsernames(banMessage.message)) {
      occurrences.push({
        username,
        message_id: String(banMessage.id),
      });
    }
  }

  const bansByUsername = new Map<string, BannedUser[]>();

  for (const ban of bannedUsers) {
    const key = ban.username.toLowerCase();
    const existing = bansByUsername.get(key) ?? [];

    existing.push(ban);
    bansByUsername.set(key, existing);
  }

  const matched = new Map<
    string,
    {
      user_id: string;
      current_username: string;
      historical_candidates: Set<string>;
      source_message_ids: Set<string>;
    }
  >();

  const unmatchedCandidates = new Map<
    string,
    {
      original_forms: Set<string>;
      source_message_ids: Set<string>;
    }
  >();

  const matchedBanIds = new Set<string>();

  for (const occurrence of occurrences) {
    const variants = getUsernameVariants(occurrence.username);

    const matches = [
      ...new Map(
        variants.flatMap((variant) =>
          (bansByUsername.get(variant) ?? []).map((ban) => [ban.user_id, ban]),
        ),
      ).values(),
    ];

    if (matches.length > 0) {
      for (const ban of matches) {
        matchedBanIds.add(ban.user_id);

        const existing = matched.get(ban.user_id) ?? {
          user_id: ban.user_id,
          current_username: ban.username,
          historical_candidates: new Set<string>(),
          source_message_ids: new Set<string>(),
        };

        existing.historical_candidates.add(occurrence.username);
        existing.source_message_ids.add(occurrence.message_id);

        matched.set(ban.user_id, existing);
      }
    } else {
      const key = occurrence.username.toLowerCase();

      const existing = unmatchedCandidates.get(key) ?? {
        original_forms: new Set<string>(),
        source_message_ids: new Set<string>(),
      };

      existing.original_forms.add(occurrence.username);
      existing.source_message_ids.add(occurrence.message_id);

      unmatchedCandidates.set(key, existing);
    }
  }

  const unmatchedBans = bannedUsers.filter(
    (ban) => !matchedBanIds.has(ban.user_id),
  );

  const report = {
    summary: {
      archived_messages: banMessages.length,
      extracted_username_occurrences: occurrences.length,
      unique_unmatched_candidates: unmatchedCandidates.size,
      matched_banned_users: matched.size,
      unmatched_current_bans: unmatchedBans.length,
    },

    matched_users: [...matched.values()].map((entry) => ({
      user_id: entry.user_id,
      current_username: entry.current_username,
      historical_candidates: [...entry.historical_candidates],
      source_message_ids: [...entry.source_message_ids],
    })),

    unmatched_candidates: [...unmatchedCandidates.entries()].map(
      ([normalized, entry]) => ({
        normalized,
        original_forms: [...entry.original_forms],
        source_message_ids: [...entry.source_message_ids],
      }),
    ),

    unmatched_current_bans: unmatchedBans.map((ban) => ({
      user_id: ban.user_id,
      username: ban.username,
    })),
  };

  await writeFile(
    "username-match-report.json",
    JSON.stringify(report, null, 2),
    "utf8",
  );

  console.log("Summary:", report.summary);
  console.log("Report saved to username-match-report.json");
}

identifyBannedUsernames().catch((error: unknown) => {
  console.error("Failed to identify usernames:", error);
  process.exitCode = 1;
});
