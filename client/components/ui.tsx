export function ProgressBar({
  value,
  max,
  label,
}: {
  value: number;
  max: number;
  label: string;
}) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div className="w-full" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
      <div className="mb-1 flex justify-between text-sm text-[var(--color-ink-muted)]">
        <span>{label}</span>
        <span>
          {value}/{max}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--color-cream-dark)]">
        <div
          className="h-full rounded-full bg-[var(--color-green)] transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function ScoreMeter({
  label,
  score,
}: {
  label: string;
  score: number;
}) {
  return (
    <div className="fade-up">
      <div className="mb-1 flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span aria-label={`${label}: ${score} trên 100`}>{score}/100</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-[var(--color-cream-dark)]">
        <div
          className="h-full rounded-full bg-[var(--color-green)]"
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="fade-in rounded-2xl border border-dashed border-[var(--color-sand)] bg-white/50 p-6 text-center">
      <h2 className="font-display text-xl text-[var(--color-ink)]">{title}</h2>
      <p className="mt-2 text-[var(--color-ink-muted)]">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
