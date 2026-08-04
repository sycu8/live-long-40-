/** Pure helper — week 1..4 from plan start date (UTC day buckets). */
export function currentPlanWeek(startDateIso: string, now = Date.now()): number {
  const start = Date.parse(startDateIso);
  if (Number.isNaN(start)) return 1;
  const elapsedDays = Math.floor((now - start) / 86_400_000);
  if (elapsedDays < 0) return 1;
  return Math.min(4, Math.floor(elapsedDays / 7) + 1);
}
