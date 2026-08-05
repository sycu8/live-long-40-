/** Trust tiers for grounded answers & library content */
export const SOURCE_TRUST_TIERS = [
  "official_vn",
  "intl_guideline",
  "editorial",
] as const;

export type SourceTrustTier = (typeof SOURCE_TRUST_TIERS)[number];

/** Issuers treated as official / authoritative for citations */
export const OFFICIAL_ISSUER_PATTERNS: RegExp[] = [
  /bộ\s*y\s*tế/i,
  /\bmoh\b/i,
  /bảo\s*hiểm\s*xã\s*hội/i,
  /\bbhxh\b/i,
  /who|world\s*health\s*organization|tổ\s*chức\s*y\s*tế\s*thế\s*giới/i,
  /ngân\s*hàng\s*nhà\s*nước/i,
  /\bsbv\b/i,
  /bộ\s*tài\s*chính/i,
  /cổng\s*thông\s*tin\s*điện\s*tử\s*chính\s*phủ/i,
  /cdc\s*việt\s*nam|cục\s*y\s*tế\s*dự\s*phòng/i,
  /ủy\s*ban\s*quốc\s*gia/i,
];

export const EVIDENCE_TRUST_TIERS: ReadonlySet<SourceTrustTier> = new Set([
  "official_vn",
  "intl_guideline",
]);

export function isOfficialIssuer(issuer: string): boolean {
  const text = issuer.trim();
  if (!text) return false;
  return OFFICIAL_ISSUER_PATTERNS.some((re) => re.test(text));
}

export function isEvidenceTrustTier(
  tier: string | null | undefined,
): tier is SourceTrustTier {
  return Boolean(tier && EVIDENCE_TRUST_TIERS.has(tier as SourceTrustTier));
}

/** Answer must cite at least one provided source key like [S1]. */
export function countCitationMarks(answer: string): number {
  return [...answer.matchAll(/\[S\d+\]/g)].length;
}

export function answerHasCitations(answer: string): boolean {
  return countCitationMarks(answer) > 0;
}

export function sourceLooksOfficial(input: {
  issuer?: string | null;
  trustTier?: string | null;
  url?: string | null;
}): boolean {
  if (isEvidenceTrustTier(input.trustTier ?? undefined)) return true;
  if (input.issuer && isOfficialIssuer(input.issuer)) return true;
  return false;
}
