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

import { currentPlanWeek } from "../lib/plan-week";

type Plan = {
  plan: {
    startDate: string;
    actions: Array<{ status: string; weekNumber: number; title: string }>;
  };
};

export function TodayPage() {
  const [readiness, setReadiness] = useState<Readiness["result"] | null>(null);
  const [weekActions, setWeekActions] = useState<Plan["plan"]["actions"]>([]);
  const [weekNumber, setWeekNumber] = useState(1);
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
          const week = currentPlanWeek(p.plan.startDate);
          setWeekNumber(week);
          setWeekActions(
            p.plan.actions.filter((a) => a.weekNumber === week).slice(0, 3),
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
        <div className="space-y-8 fade-up">
          <EmptyState
            title="Bắt đầu từ việc hiểu mình đang ở đâu"
            description="Hoàn thành bài đánh giá ngắn để nhận hồ sơ sẵn sàng và kế hoạch 30 ngày."
            action={
              <Link to="/danh-gia">
                <Button>Kiểm tra mức độ sẵn sàng</Button>
              </Link>
            }
          />
          <section>
            <h2 className="font-display text-xl text-[var(--color-ink)]">
              Trong lúc đó bạn có thể
            </h2>
            <ul className="mt-4 space-y-4 text-[var(--color-ink-muted)]">
              <li>
                <Link className="font-medium text-[var(--color-green)]" to="/hoi">
                  Hỏi Sống An
                </Link>
                {" — "}
                đặt câu hỏi về khám định kỳ, quỹ dự phòng, phòng ngã hoặc giấy tờ.
              </li>
              <li>
                <Link
                  className="font-medium text-[var(--color-green)]"
                  to="/thu-vien"
                >
                  Đọc Thư viện
                </Link>
                {" — "}
                bài học ngắn theo sức khỏe, tài chính và kỹ năng chăm sóc.
              </li>
            </ul>
          </section>
          <section className="border-t border-[var(--color-sand)]/40 pt-6">
            <h2 className="font-display text-xl text-[var(--color-ink)]">
              Bài đánh giá gồm gì?
            </h2>
            <p className="mt-2 leading-relaxed text-[var(--color-ink-muted)]">
              Khoảng 20 câu, làm trong khoảng 7 phút. Bạn sẽ nhận điểm chuẩn bị
              theo ba trụ cột, khoảng trống ưu tiên và gợi ý việc nhỏ cho 30 ngày
              tới — không phải chẩn đoán sức khỏe.
            </p>
          </section>
        </div>
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
          <h2 className="font-display text-xl">Việc tuần {weekNumber}</h2>
          {pending.length === 0 ? (
            <p className="mt-2 text-[var(--color-ink-muted)]">
              Không còn việc đang mở trong tuần này.{" "}
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
