import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { Button } from "../components/Button";
import { EmptyState, ScoreMeter } from "../components/ui";
import { api } from "../lib/api";
import { PILLAR_LABELS } from "@shared/constants/product";

type Readiness = {
  result: {
    overallScore: number;
    pillars: Array<{ pillar: "health" | "finance" | "caregiving"; score: number; interpretation: string }>;
    gaps: string[];
  };
};

type Plan = {
  plan: {
    actions: Array<{ status: string; weekNumber: number; title: string }>;
  };
};

export function TodayPage() {
  const [readiness, setReadiness] = useState<Readiness["result"] | null>(null);
  const [weekActions, setWeekActions] = useState<Plan["plan"]["actions"]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await api<Readiness>("/readiness/current");
        if (!cancelled) setReadiness(r.result);
      } catch {
        if (!cancelled) setReadiness(null);
      }
      try {
        const p = await api<Plan>("/plans/current");
        if (!cancelled) {
          const currentWeek = Math.min(
            4,
            Math.ceil(
              (Date.now() - Date.parse(p.plan.actions[0] ? new Date().toISOString() : new Date().toISOString())) /
                (7 * 86400000),
            ) || 1,
          );
          // Show week 1 actions by default for MVP simplicity
          setWeekActions(
            p.plan.actions.filter((a) => a.weekNumber === 1 || a.weekNumber === currentWeek).slice(0, 3),
          );
        }
      } catch {
        /* no plan */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <AppShell>
        <p className="text-[var(--color-ink-muted)]">Đang tải…</p>
      </AppShell>
    );
  }

  if (!readiness) {
    return (
      <AppShell>
        <EmptyState
          title="Bắt đầu từ việc hiểu mình đang ở đâu"
          description="Hoàn thành bài đánh giá ngắn để nhận hồ sơ sẵn sàng và kế hoạch 30 ngày."
          action={
            <Link to="/danh-gia">
              <Button>Kiểm tra mức độ sẵn sàng</Button>
            </Link>
          }
        />
      </AppShell>
    );
  }

  const pending = weekActions.filter((a) => a.status !== "completed");

  return (
    <AppShell>
      <div className="space-y-6 fade-up">
        <div>
          <h1 className="font-display text-3xl text-[var(--color-ink)]">Hôm nay</h1>
          <p className="mt-2 text-[var(--color-ink-muted)]">
            Điểm tổng quan: {readiness.overallScore}/100 — đây là điểm chuẩn bị,
            không phải chẩn đoán.
          </p>
        </div>

        <div className="space-y-3 rounded-2xl bg-white/60 p-4">
          {readiness.pillars.map((p) => (
            <ScoreMeter
              key={p.pillar}
              label={PILLAR_LABELS[p.pillar]}
              score={p.score}
            />
          ))}
        </div>

        <section>
          <h2 className="font-display text-xl">Việc tuần này</h2>
          {pending.length === 0 ? (
            <p className="mt-2 text-[var(--color-ink-muted)]">
              Chưa có việc đang mở.{" "}
              <Link className="text-[var(--color-green)] underline" to="/ke-hoach">
                Xem kế hoạch
              </Link>
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {pending.map((a) => (
                <li key={a.title} className="rounded-xl bg-white/70 px-4 py-3">
                  {a.title}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4">
            <Link to="/ke-hoach">
              <Button variant="secondary">Mở kế hoạch</Button>
            </Link>
          </div>
        </section>

        {readiness.gaps.length > 0 ? (
          <section>
            <h2 className="font-display text-xl">Ưu tiên cải thiện</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[var(--color-ink-muted)]">
              {readiness.gaps.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
