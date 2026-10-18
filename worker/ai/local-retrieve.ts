import { normalizeQuery } from "@shared/rules/classification";
import { foldVietnamese } from "@shared/utils/vietnamese";

export { foldVietnamese };

const HTTP_URL = /https?:\/\/[^\s)>\]]+/gi;

/** A URL that parses and was not cut off mid-host or mid-encoding. */
export function isCompleteHttpUrl(raw: string): boolean {
  const url = raw.replace(/[.,;:!?)]+$/g, "");
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    if (!parsed.hostname.includes(".")) return false;
    const tld = parsed.hostname.split(".").pop() ?? "";
    if (!/^[a-z]{2,}$/i.test(tld)) return false;
    if (/%(?:$|[0-9a-f]$)/i.test(url)) return false;
    return true;
  } catch {
    return false;
  }
}

/** Remove a URL that does not parse as a finished http(s) address. */
export function stripIncompleteUrls(text: string): string {
  return text
    .replace(HTTP_URL, (raw) => {
      const url = raw.replace(/[.,;:!?)]+$/g, "");
      return isCompleteHttpUrl(url) ? url : "";
    })
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\(\s*\)/g, "")
    .trim();
}

/**
 * Shorten text without cutting a URL. A URL that would be sliced is dropped
 * whole, including one that is already incomplete.
 */
export function clipSnippet(text: string, max = 500): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return stripIncompleteUrls(clean);
  let end = max;
  const open = clean.slice(0, end).search(/https?:\/\/\S*$/);
  if (open >= 0) end = open;
  let cut = clean.slice(0, end).trimEnd();
  if (open < 0 && end < clean.length) cut = cut.replace(/\s+\S+$/, "").trimEnd();
  return stripIncompleteUrls(cut);
}

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
  // "trên" and "năm/Nam" match boilerplate ("Trên trang…", "Việt Nam").
  "tren",
  "nam",
]);

function rawQueryTokens(folded: string): string[] {
  return folded
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOP.has(token));
}

function isMostlyEnglish(folded: string): boolean {
  // "thế nào" folds to "the nao", so a lone "the" is not an English question.
  return /\b(what|how|should|does|about|many|older|adults|week|where|when|which)\b/.test(
    folded,
  );
}

/** Words the source is likely to use when the question uses a different phrase. */
function synonymTokens(folded: string): string[] {
  const extra: string[] = [];
  if (
    /tap the duc|the duc|tap luyen|di bo|\b(exercise|workout|walking|walk)\b/.test(folded)
  )
    extra.push("van", "dong");
  if (/mat ngu|kho ngu|thieu ngu|\b(insomnia|sleepless|sleep)\b/.test(folded))
    extra.push("giac", "ngu");
  if (/tram cam|buon chan|\b(depress|depression|mood|mental)\b/.test(folded))
    extra.push("tinh", "than");
  if (
    /ngung thuoc|tu y ngung|bo thuoc|tieu duong|\b(diabetes|medication|medicine)\b/.test(
      folded,
    )
  )
    extra.push("ngung", "thuoc");
  if (/\b(fall|falls|falling)\b/.test(folded)) extra.push("nga");
  if (/\b(blood pressure|hypertension)\b/.test(folded)) extra.push("huyet", "ap");
  if (/\b(checkup|check up|screening)\b/.test(folded)) extra.push("kham", "dinh", "ky");
  if (/\b(pension|retirement|retire)\b/.test(folded)) extra.push("luong", "huu");
  if (/\b(health insurance|insurance card|bhyt)\b/.test(folded))
    extra.push("bhyt", "bao", "hiem");
  if (/\b(saving|savings|budget|financial education)\b/.test(folded))
    extra.push("tiet", "kiem", "tai", "chinh");
  if (/\b(ageing|aging)\b/.test(folded)) extra.push("gia", "hoa");
  if (/\b(drug registration|marketing authorisation|medicine licen[cs]e)\b/.test(folded))
    extra.push("dang", "ky", "thuoc");
  return extra;
}

/** Query tokens for retrieval. Skip 2-letter syllables; they match inside unrelated words. */
export function queryTokens(query: string): string[] {
  const { withoutDiacritics } = normalizeQuery(query);
  const seen = new Set<string>();
  const tokens: string[] = [];
  const synonyms = synonymTokens(withoutDiacritics);
  const base =
    isMostlyEnglish(withoutDiacritics) && synonyms.length > 0
      ? synonyms
      : [...rawQueryTokens(withoutDiacritics), ...synonyms];
  for (const token of base) {
    if (seen.has(token) || STOP.has(token)) continue;
    seen.add(token);
    tokens.push(token);
    if (tokens.length >= 24) break;
  }
  return tokens;
}

/** Whole-word match so short syllables do not hit inside unrelated words. */
export function containsToken(folded: string, token: string): boolean {
  if (!token) return false;
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`).test(folded);
}

/**
 * Below this, a source is too weak to cite. 0.42 dropped real falls hits.
 * Embedding scores use a separate floor in retrieval-filter.ts.
 */
export const MIN_RETRIEVAL_SCORE = 0.28;

/** How many sources may be shown as citations. */
export const MAX_CITED_SOURCES = 3;

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
    if (containsToken(folded, token)) hits += 1;
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
    "kham dinh ky",
    "van dong",
    "gia hoa",
    "giac ngu",
    "tinh than",
    "ngung thuoc",
  ];
  for (const topic of topics) {
    if (!qFold.includes(topic)) continue;
    if (folded.includes(topic)) score = Math.min(1, score + 0.35);
    else score *= 0.45;
    break;
  }

  // Soft-penalize a lone short hit. A specific word such as "sáng" still counts.
  const specificHit = tokens.some(
    (token) =>
      token.length >= 4 && !GENERIC_TOPIC.has(token) && containsToken(folded, token),
  );
  if (hits === 1 && tokens.length >= 3 && !specificHit) {
    score *= 0.55;
  }

  // “quỹ dự phòng” must not lose to “phòng ngã” on the shared token “phòng”
  if (
    ((qFold.includes("quy") && qFold.includes("phong")) || qFold.includes("du phong")) &&
    !folded.includes("quy") &&
    !folded.includes("du phong")
  ) {
    score *= 0.15;
  }

  // Require at least one strong (3+ char) hit when query has such tokens
  const strong = tokens.filter((t) => t.length >= 3);
  if (strong.length > 0 && !strong.some((t) => containsToken(folded, t))) {
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
  trust_tier?: string | null;
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
  trustTier?: string;
};

function corpusDocumentFrequency(token: string, corpus: string[]): number {
  let count = 0;
  for (const doc of corpus) {
    if (containsToken(doc, token)) count += 1;
  }
  return count;
}

/**
 * Overlap score that ignores tokens shared by most of the corpus
 * (“sức khỏe”, “tuổi”) unless a distinctive token also hits.
 */
export function scoreTextInCorpus(
  haystack: string,
  query: string,
  corpus: string[],
): number {
  if (corpus.length === 0) return scoreTextAgainstQuery(haystack, query);
  const tokens = queryTokens(query);
  if (tokens.length === 0) return 0;
  const folded = foldVietnamese(haystack);
  const qFold = foldVietnamese(query);
  const distinctiveCap = Math.max(2, Math.ceil(corpus.length * 0.34));
  let weightSum = 0;
  let hitWeight = 0;
  let distinctive = 0;
  let distinctiveHits = 0;
  for (const token of tokens) {
    const df = corpusDocumentFrequency(token, corpus);
    const idf = df === 0 ? 1.5 : Math.log((corpus.length + 1) / df);
    const weight = Math.max(0.25, idf);
    const isDistinctive = df === 0 || df <= distinctiveCap;
    if (isDistinctive) distinctive += 1;
    weightSum += weight;
    if (containsToken(folded, token)) {
      hitWeight += weight;
      if (isDistinctive) distinctiveHits += 1;
    }
  }
  if (hitWeight === 0 || weightSum === 0) return 0;
  if (distinctive > 0 && distinctiveHits === 0) return 0;

  let score = hitWeight / weightSum;
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const phrase = `${tokens[i]} ${tokens[i + 1]}`;
    if (phrase.length >= 6 && folded.includes(phrase)) {
      score = Math.min(1, score + 0.2);
      break;
    }
  }
  const topics = [
    "quy du phong",
    "du phong",
    "phong nga",
    "huyet ap",
    "kham dinh ky",
    "van dong",
    "gia hoa",
    "giac ngu",
    "tinh than",
    "ngung thuoc",
  ];
  for (const topic of topics) {
    if (!qFold.includes(topic)) continue;
    if (folded.includes(topic)) score = Math.min(1, score + 0.28);
    else score *= 0.45;
    break;
  }
  if (
    ((qFold.includes("quy") && qFold.includes("phong")) || qFold.includes("du phong")) &&
    !folded.includes("quy") &&
    !folded.includes("du phong")
  ) {
    score *= 0.15;
  }
  if (
    (qFold.includes("di bo") || qFold.includes("van dong")) &&
    (folded.includes("di bo") || folded.includes("van dong"))
  ) {
    score = Math.min(1, score + 0.45);
  }
  const strong = tokens.filter((token) => token.length >= 3);
  if (strong.length > 0 && !strong.some((token) => containsToken(folded, token)))
    return 0;
  return score;
}

const GENERIC_TOPIC = new Set([
  "nguoi",
  "tuoi",
  "lon",
  "cao",
  "suc",
  "khoe",
  "nen",
  "theo",
  "chuc",
  "the",
  "gioi",
  "viet",
  "nam",
  "bai",
  "thong",
  "tin",
  "nao",
  "dang",
  "uong",
  "minh",
  "hay",
  "rat",
  "mot",
  "nhieu",
  "moi",
  "ngay",
  "bao",
  "tren",
  "thi",
  "cung",
  "sau",
  "truoc",
  "duoi",
  "keo",
  "dai",
  "giup",
  "sang",
  "ngoai",
  "tam",
  "thu",
]);

/** One of these words is not enough to call a source on-topic. */
const WEAK_TOPIC = new Set(["than", "kinh", "hang", "tiem", "xin", "vac"]);

/**
 * Mutually exclusive subjects. A BHYT card and a pension procedure can share
 * an issuer and still be different topics. The title decides when the body
 * mentions a sibling subject in passing.
 */
const TOPIC_CLASSES: string[][] = [
  ["bhyt", "bao hiem y te"],
  ["luong huu"],
  ["huyet ap"],
  ["giac ngu", "mat ngu"],
  ["van dong", "di bo"],
  ["dang ky luu hanh"],
  ["tiet kiem"],
  ["gia hoa"],
  ["kham dinh ky"],
];

function topicClassIds(folded: string): Set<number> {
  const found = new Set<number>();
  TOPIC_CLASSES.forEach((phrases, index) => {
    if (phrases.some((phrase) => folded.includes(phrase))) found.add(index);
  });
  return found;
}

function topicClassesOverlap(
  question: string,
  source: { title: string; snippet: string },
): boolean {
  const qFold = foldVietnamese(question);
  const asked = topicClassIds(qFold);
  if (asked.size === 0) return true;
  const titleTopics = topicClassIds(foldVietnamese(source.title));
  const covered =
    titleTopics.size > 0 ? titleTopics : topicClassIds(foldVietnamese(source.snippet));
  if (covered.size === 0) return true;
  for (const topic of asked) if (covered.has(topic)) return true;
  return false;
}

/** True when the question's own topic words appear in this source, not only in the answer. */
export function sourceMatchesQuestionTopic(
  question: string,
  source: { title: string; snippet: string },
): boolean {
  const qFold = foldVietnamese(question);
  const haystack = foldVietnamese(`${source.title}\n${source.snippet}`);
  if (!topicClassesOverlap(question, source)) return false;
  if (
    qFold.includes("di bo") &&
    (haystack.includes("di bo") || haystack.includes("van dong"))
  ) {
    return true;
  }
  // A weight-loss question is not answered by a general activity sheet.
  if (qFold.includes("giam can") && !haystack.includes("giam can")) return false;
  const tokens = queryTokens(question).filter(
    (token) => token.length >= 3 && !GENERIC_TOPIC.has(token),
  );
  if (tokens.length === 0) return false;
  const hits = tokens.filter((token) => containsToken(haystack, token));
  if (hits.length === 0) return false;
  return hits.some((token) => !WEAK_TOPIC.has(token));
}

/** Rank approved D1 chunks / lessons for grounded chat when AI Search is empty. */
export function rankLocalKnowledge(
  query: string,
  chunks: LocalChunkRow[],
  lessons: LocalLessonRow[] = [],
  limit = MAX_CITED_SOURCES,
): RankedLocalSource[] {
  const corpus = [
    ...chunks.map((row) =>
      foldVietnamese(`${row.title}\n${row.heading ?? ""}\n${row.content}`),
    ),
    ...lessons.map((lesson) =>
      foldVietnamese(`${lesson.title}\n${lesson.summary}\n${lesson.body_markdown}`),
    ),
  ];
  const scored: Array<RankedLocalSource & { _score: number }> = [];

  for (const row of chunks) {
    const titleScore = scoreTextInCorpus(
      `${row.title}\n${row.heading ?? ""}`,
      query,
      corpus,
    );
    const bodyScore = scoreTextInCorpus(row.content, query, corpus);
    const score = Math.max(titleScore * 1.25, bodyScore, (titleScore + bodyScore) / 2);
    if (score < MIN_RETRIEVAL_SCORE) continue;
    scored.push({
      _score: score,
      key: "",
      sourceId: row.source_id,
      chunkId: row.chunk_id,
      title: row.title,
      issuer: row.issuer,
      publicationDate: row.publication_date ?? undefined,
      url: row.original_url ?? undefined,
      snippet: clipSnippet(row.content),
      score,
      status: row.status ?? "active",
      trustTier: row.trust_tier ?? undefined,
    });
  }

  for (const lesson of lessons) {
    const blob = `${lesson.title}\n${lesson.summary}\n${lesson.body_markdown}`;
    const score = scoreTextInCorpus(blob, query, corpus);
    if (score < MIN_RETRIEVAL_SCORE) continue;
    const snippet = clipSnippet(lesson.summary || lesson.body_markdown);
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
  const top = scored[0]?._score ?? 0;
  const band = scored.filter((item) => item._score >= top * 0.97);
  const topical = band.filter((item) =>
    sourceMatchesQuestionTopic(query, { title: item.title, snippet: item.snippet }),
  );
  const withHits = topical.map((item) => ({
    item,
    hits: queryTokens(query).filter(
      (token) =>
        token.length >= 3 &&
        !GENERIC_TOPIC.has(token) &&
        !WEAK_TOPIC.has(token) &&
        containsToken(foldVietnamese(`${item.title}\n${item.snippet}`), token),
    ),
  }));
  // A sibling that only repeats the broader source's tokens is the same issuer
  // boilerplate, not a second topic.
  const specific = withHits.filter(
    ({ hits }) =>
      !withHits.some(
        (other) =>
          other.hits.length > hits.length &&
          hits.every((token) => other.hits.includes(token)),
      ),
  );
  const kept = specific.map((entry) => entry.item).slice(0, limit);
  return kept.map((item, index) => {
    const { _score: _, ...rest } = item;
    return { ...rest, key: `S${index + 1}`, score: rest.score };
  });
}
