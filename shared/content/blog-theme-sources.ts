import type { BlogTheme } from "../constants/blog";
import {
  officialSourceById,
  type OfficialSourceRef,
} from "./official-sources";

/** Recommended official source IDs per blog theme (document-level URLs only). */
export const BLOG_THEME_SOURCE_IDS: Record<BlogTheme, readonly string[]> = {
  "tinh-than": ["who-mental-sleep", "who-ageing", "byt-elderly-checkup"],
  "thoi-quen": ["who-physical-activity", "who-ageing", "byt-elderly-checkup"],
  "suc-khoe": [
    "who-hypertension",
    "who-ageing",
    "byt-elderly-checkup",
    "who-physical-activity",
  ],
  "tai-chinh": [
    "sbv-financial-education",
    "bhxh-bhyt-card-lookup",
    "bhxh-pension-procedure",
  ],
  "cham-soc": ["who-falls", "byt-elderly-checkup", "byt-drug-registration-lookup"],
};

export function resolveBlogSources(
  sourceIds: string[] | undefined | null,
): OfficialSourceRef[] {
  if (!sourceIds?.length) return [];
  const out: OfficialSourceRef[] = [];
  const seen = new Set<string>();
  for (const id of sourceIds) {
    if (seen.has(id)) continue;
    const ref = officialSourceById(id);
    if (ref) {
      seen.add(id);
      out.push(ref);
    }
  }
  return out;
}

export function defaultSourceIdsForTheme(theme: string): string[] {
  const ids = BLOG_THEME_SOURCE_IDS[theme as BlogTheme];
  return ids ? [...ids].slice(0, 2) : ["who-ageing"];
}
