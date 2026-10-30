import { readFile, writeFile } from "node:fs/promises";

interface UnidentifiedReport {
  users: UnidentifiedUser[];
}

interface UnidentifiedUser {
  user_id: string;
  current_username: string;
  log_entries: LogEntry[];
}

interface LogEntry {
  message_id: string;
  url: string;
  created_at: string;
  embeds: Embed[];
}

interface Embed {
  fields?: EmbedField[];
}

interface EmbedField {
  name: string;
  value: string;
}

interface UsernameOccurrence {
  value: string;
  message_id: string;
  message_url: string;
  created_at: string;
  embed_index: number;
  field_index: number;
}

interface ExtractedUser {
  user_id: string;
  current_username: string;
  historical_names: {
    value: string;
    occurrences: UsernameOccurrence[];
  }[];
  status: "no_name_found" | "one_candidate" | "multiple_candidates";
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractName(field: EmbedField, userId: string): string | null {
  // Only inspect fields explicitly labelled "User".
  const fieldName = field.name.replace(/\*/gu, "").trim().toLowerCase();

  if (fieldName !== "user") {
    return null;
  }

  // Verify that this particular field contains the target's ID.
  const escapedId = escapeRegex(userId);

  const idPattern = new RegExp(
    `(?:^|\\n)\\s*\\*{0,2}ID:\\*{0,2}\\s*${escapedId}(?!\\d)`,
    "iu",
  );

  if (!idPattern.test(field.value)) {
    return null;
  }

  // Extract the Name value from the same field.
  const nameMatch = field.value.match(
    /(?:^|\n)\s*\*{0,2}Name:\*{0,2}\s*(.+?)\s*(?=\r?\n|$)/iu,
  );

  if (!nameMatch?.[1]) {
    return null;
  }

  const name = nameMatch[1]
    .trim()
    .replace(/^\*+|\*+$/gu, "")
    .trim();

  return name || null;
}

async function extractHistoricalUsernames(): Promise<void> {
  const report = JSON.parse(
    await readFile("unidentified-ban-user-logs.json", "utf8"),
  ) as UnidentifiedReport;

  const results: ExtractedUser[] = [];

  for (const user of report.users) {
    const names = new Map<string, UsernameOccurrence[]>();

    for (const entry of user.log_entries) {
      for (const [embedIndex, embed] of entry.embeds.entries()) {
        for (const [fieldIndex, field] of (embed.fields ?? []).entries()) {
          const name = extractName(field, user.user_id);

          if (!name) {
            continue;
          }

          const key = name.toLowerCase();

          const occurrence: UsernameOccurrence = {
            value: name,
            message_id: entry.message_id,
            message_url: entry.url,
            created_at: entry.created_at,
            embed_index: embedIndex,
            field_index: fieldIndex,
          };

          const existing = names.get(key);

          if (existing) {
            existing.push(occurrence);
          } else {
            names.set(key, [occurrence]);
          }
        }
      }
    }

    const historicalNames = [...names.entries()].map(([, occurrences]) => ({
      value: occurrences[0]!.value,
      occurrences,
    }));

    let status: ExtractedUser["status"];

    if (historicalNames.length === 0) {
      status = "no_name_found";
    } else if (historicalNames.length === 1) {
      status = "one_candidate";
    } else {
      status = "multiple_candidates";
    }

    results.push({
      user_id: user.user_id,
      current_username: user.current_username,
      historical_names: historicalNames,
      status,
    });
  }

  const output = {
    generated_at: new Date().toISOString(),
    users_processed: results.length,
    users_with_names: results.filter((user) => user.historical_names.length > 0)
      .length,
    users_without_names: results.filter(
      (user) => user.historical_names.length === 0,
    ).length,
    users_with_multiple_names: results.filter(
      (user) => user.historical_names.length > 1,
    ).length,
    users: results,
  };

  await writeFile(
    "historical-usernames.json",
    JSON.stringify(output, null, 2),
    "utf8",
  );

  console.log("\nHistorical username extraction finished!");
  console.log(`Users processed: ${output.users_processed}`);
  console.log(`Users with names: ${output.users_with_names}`);
  console.log(`Users without names: ${output.users_without_names}`);
  console.log(`Users with multiple names: ${output.users_with_multiple_names}`);
  console.log("Output: historical-usernames.json");
}

await extractHistoricalUsernames();
