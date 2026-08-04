import { normalizeQuery } from "@shared/rules/classification";
import { foldVietnamese } from "@shared/utils/vietnamese";

export { foldVietnamese };

const STOP = new Set([
  "la",
  "va",
  "cua",
  "cho",
  "voi",
  "cac",
  "mot",
  "nhung",
  "the",
  "nao",
  "gi",
  "toi",
  "ban",
  "nen",
  "khi",
  "lam",
  "de",
  "co",
  "khong",
  "trong",
  "nay",
  "do",
  "duoc",
  "nhu",
]);

/** Query tokens for retrieval — keep meaningful 2-letter syllables (du, me, bi…). */
export function queryTokens(query: string): string[] {
  const { withoutDiacritics } = normalizeQuery(query);
  return withoutDiacritics
    .split(/[^a-z0-9]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOP.has(t))
    .slice(0, 10);
}

/**
 * Score haystack against a user query using folded-token overlap.
 * SQLite LIKE + lower() is not diacritic-safe for Vietnamese, so scoring is done in JS.
 */
export function scoreTextAgainstQuery(haystack: string, query: string): number {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return 0;

  const folded = foldVietnamese(haystack);
  let hits = 0;
  for (const token of tokens) {
    if (folded.includes(token)) hits += 1;
  }
  if (hits === 0) return 0;

  let score = hits / tokens.length;
  const phrase = tokens.join(" ");
  if (phrase.length >= 6 && folded.includes(phrase)) {
    score = Math.min(1, score + 0.25);
  }

  // Topic phrases that disambiguate “phòng” (ngã vs dự phòng) and similar
  const qFold = foldVietnamese(query);
  const topics = [
    "quy du phong",
    "du phong",
    "phong nga",
    "giay to",
    "huyet ap",
    "suc khoe",
    "kham dinh ky",
  ];
  for (const topic of topics) {
    if (qFold.includes(topic) && folded.includes(topic)) {
      score = Math.min(1, score + 0.35);
      break;
    }
  }

  // Soft-penalize weak single-token hits on multi-token questions
  if (hits === 1 && tokens.length >= 3) {
    score *= 0.55;
  }

  // Require at least one strong (3+ char) hit when query has such tokens
  const strong = tokens.filter((t) => t.length >= 3);
  if (strong.length > 0 && !strong.some((t) => folded.includes(t))) {
    return 0;
  }
  return score;
}

export type LocalChunkRow = {
  chunk_id: string;
  content: string;
  heading?: string | null;
  source_id: string;
  title: string;
  issuer: string;
  publication_date?: string | null;
  original_url?: string | null;
  status?: string | null;
};

export type LocalLessonRow = {
  slug: string;
  title: string;
  summary: string;
  body_markdown: string;
  issuer: string;
  publication_date?: string | null;
  last_reviewed_at?: string | null;
};

export type RankedLocalSource = {
  key: string;
  sourceId?: string;
  chunkId?: string;
  title: string;
  issuer: string;
  publicationDate?: string;
  url?: string;
  snippet: string;
  score: number;
  status?: string;
};

/** Rank approved D1 chunks / lessons for grounded chat when AI Search is empty. */
export function rankLocalKnowledge(
  query: string,
  chunks: LocalChunkRow[],
  lessons: LocalLessonRow[] = [],
  limit = 6,
): RankedLocalSource[] {
  const scored: Array<RankedLocalSource & { _score: number }> = [];

  for (const row of chunks) {
    const titleScore = scoreTextAgainstQuery(
      `${row.title}\n${row.heading ?? ""}`,
      query,
    );
    const bodyScore = scoreTextAgainstQuery(row.content, query);
    const score = Math.max(titleScore * 1.15, bodyScore, (titleScore + bodyScore) / 2);
    if (score <= 0) continue;
    scored.push({
      _score: score,
      key: "",
      sourceId: row.source_id,
      chunkId: row.chunk_id,
      title: row.title,
      issuer: row.issuer,
      publicationDate: row.publication_date ?? undefined,
      url: row.original_url ?? undefined,
      snippet: row.content.slice(0, 500),
      score,
      status: row.status ?? "active",
    });
  }

  for (const lesson of lessons) {
    const blob = `${lesson.title}\n${lesson.summary}\n${lesson.body_markdown}`;
    const score = scoreTextAgainstQuery(blob, query);
    if (score <= 0) continue;
    const snippet = (lesson.summary || lesson.body_markdown).slice(0, 500);
    scored.push({
      _score: score * 0.95, // slight preference for curated source_chunks
      key: "",
      sourceId: `lesson:${lesson.slug}`,
      chunkId: `lesson:${lesson.slug}`,
      title: lesson.title,
      issuer: lesson.issuer,
      publicationDate: lesson.publication_date ?? lesson.last_reviewed_at ?? undefined,
      url: `/thu-vien/${lesson.slug}`,
      snippet,
      score: score * 0.95,
      status: "active",
    });
  }

  scored.sort((a, b) => b._score - a._score);
  return scored.slice(0, limit).map((item, index) => {
    const { _score: _, ...rest } = item;
    return { ...rest, key: `S${index + 1}`, score: Math.max(0.35, rest.score) };
  });
}
