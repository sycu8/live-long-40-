export type CitationSource = {
  key: string;
  url?: string;
  title?: string;
};

/** Hide a repeated chip. The first source with the same url or title stays. */
export function dedupeCitationSources<T extends CitationSource>(sources: T[]): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const source of sources) {
    const id = (source.url || source.title || source.key).trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    unique.push(source);
  }
  return unique;
}

/** Drop [S2] once its chip was removed as a duplicate or was not cited. */
export function stripUnkeptCitationMarkers(
  text: string,
  sources: Array<{ key: string }>,
): string {
  if (!text || sources.length === 0) return text;
  const keys = new Set(sources.map((source) => source.key));
  return text
    .replace(/\[S(\d+)\]/g, (marker, num: string) => (keys.has(`S${num}`) ? marker : ""))
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([.,;:])/g, "$1");
}

/** Cited sources only, with duplicate chips removed and their markers stripped. */
export function presentCitations<T extends CitationSource>(
  text: string,
  sources: T[],
): { text: string; sources: T[] } {
  const collapsed = text.replace(/(\[S\d+\])(?:\s*\1)+/g, "$1");
  const cited = new Set(
    [...collapsed.matchAll(/\[(S\d+)\]/g)].map((match) => match[1] ?? ""),
  );
  // No [S1] in the text means no chips, even when sources were retrieved.
  const citedSources = sources.filter((source) => cited.has(source.key));
  const unique = dedupeCitationSources(citedSources);
  return { text: stripUnkeptCitationMarkers(collapsed, unique), sources: unique };
}
