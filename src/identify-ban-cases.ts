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
