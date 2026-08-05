import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { Button } from "../components/Button";
import { EmptyState, ScoreMeter } from "../components/ui";
import { api } from "../lib/api";
import { PILLAR_LABELS } from "@shared/constants/product";
import { currentPlanWeek } from "../lib/plan-week";
import { weekEncouragement } from "../content/momentum";

type Readiness = {
  result: {
    overallScore: number;
    pillars: Array<{
      pillar: "health" | "finance" | "caregiving";
      score: number;
      interpretation: string;
    }>;
    gaps: string[];
  };
};

type Plan = {
  plan: {
    startDate: string;
    actions: Array<{
      status: string;
      weekNumber: number;
      title: string;
      isOptional?: boolean;
    }>;
  };
};

type BlogTeaser = {
  items: Array<{ slug: string; title: string; excerpt: string }>;
};

export function TodayPage() {
  const [readiness, setReadiness] = useState<Readiness["result"] | null>(null);
  const [weekActions, setWeekActions] = useState<Plan["plan"]["actions"]>([]);
  const [weekNumber, setWeekNumber] = useState(1);
  const [blog, setBlog] = useState<BlogTeaser["items"][0] | null>(null);
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
          setWeekActions(p.plan.actions.filter((a) => a.weekNumber === week));
        }
      } catch {
        /* no plan */
      }
      try {
        const b = await api<BlogTeaser>("/blog");
        if (!cancelled && b.items?.[0]) setBlog(b.items[0]);
      } catch {
        /* blog optional */
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
        <div className="fade-up space-y-8 lg:grid lg:grid-cols-2 lg:gap-12 lg:space-y-0 lg:items-start">
          <div className="space-y-8">
            <EmptyState
              title="Bắt đầu từ việc hiểu mình đang ở đâu"
              description="Hoàn thành bài đánh giá ngắn để xem mức độ chuẩn bị và nhận kế hoạch 30 ngày."
              action={
                <Link to="/danh-gia">
                  <Button>Kiểm tra mức độ chuẩn bị</Button>
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
                  đặt câu hỏi về khám định kỳ, tiền để dành khi đột xuất, phòng ngã hoặc giấy tờ.
                </li>
                <li>
                  <Link
                    className="font-medium text-[var(--color-green)]"
                    to="/blog"
                  >
                    Đọc Góc động viên
                  </Link>
                  {" — "}
                  bài viết ấm áp giúp bạn bớt tiêu cực và thích nghi với tuổi già.
                </li>
                <li>
                  <Link
                    className="font-medium text-[var(--color-green)]"
                    to="/thu-vien"
                  >
                    Đọc Thư viện
                  </Link>
                  {" — "}
                  bài học ngắn theo sức khỏe, tiền bạc và chăm sóc người thân.
                </li>
              </ul>
            </section>
          </div>

          <div className="space-y-8">
            {blog ? (
              <section className="rounded-2xl bg-white/60 p-5 lg:p-6">
                <h2 className="font-display text-xl">Bài động viên mới</h2>
                <p className="mt-2 font-medium text-[var(--color-ink)]">{blog.title}</p>
                <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{blog.excerpt}</p>
                <div className="mt-3">
                  <Link to={`/blog/${blog.slug}`}>
                    <Button variant="secondary">Đọc bài</Button>
                  </Link>
                </div>
              </section>
            ) : null}
            <section className="rounded-2xl border border-[var(--color-sand)]/35 p-5 lg:p-6">
              <h2 className="font-display text-xl text-[var(--color-ink)]">
                Bài đánh giá gồm gì?
              </h2>
              <p className="mt-2 leading-relaxed text-[var(--color-ink-muted)]">
                Khoảng 20 câu, làm trong khoảng 7 phút. Bạn sẽ nhận điểm chuẩn bị
                theo ba trụ cột, khoảng trống ưu tiên và gợi ý việc nhỏ cho 30 ngày
                tới — không phải kết luận bệnh.
              </p>
            </section>
          </div>
        </div>
      </AppShell>
    );
  }

  const completedCount = weekActions.filter((a) => a.status === "completed").length;
  const totalCount = weekActions.length;
  const pending = weekActions.filter((a) => a.status !== "completed");
  const progressPct =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const encouragement = weekEncouragement(completedCount, totalCount);

  return (
    <AppShell>
      <div className="space-y-6 fade-up lg:space-y-0 lg:grid lg:grid-cols-[1.15fr_0.85fr] lg:gap-10 lg:items-start">
        <div className="space-y-6">
          <div>
            <h1 className="font-display text-3xl text-[var(--color-ink)] lg:text-4xl">Hôm nay</h1>
            <p className="mt-2 text-[var(--color-ink-muted)]">
              Điểm tổng quan: {readiness.overallScore}/100 — đây là điểm chuẩn bị,
              không phải kết luận bệnh.
            </p>
          </div>

          <section className="rounded-2xl bg-white/70 p-4 lg:p-6">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-display text-xl">Tiến độ tuần {weekNumber}</h2>
              <p className="text-sm font-medium text-[var(--color-green)]">
                {completedCount}/{totalCount || "—"} việc
              </p>
            </div>
            <div
              className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--color-sand)]/50"
              role="progressbar"
              aria-valuenow={progressPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Tiến độ tuần ${weekNumber}`}
            >
              <div
                className="h-full rounded-full bg-[var(--color-green)] transition-[width] duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="mt-3 text-[var(--color-ink-muted)]">{encouragement}</p>
          </section>

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
        </div>

        <div className="space-y-6">
          <div className="space-y-3 rounded-2xl bg-white/60 p-4 lg:p-6">
            {readiness.pillars.map((p) => (
              <ScoreMeter
                key={p.pillar}
                label={PILLAR_LABELS[p.pillar]}
                score={p.score}
              />
            ))}
          </div>

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

          {blog ? (
            <section className="rounded-2xl border border-[var(--color-sand)]/35 bg-white/50 p-4 lg:p-6">
              <h2 className="font-display text-xl">Giữ tinh thần</h2>
              <p className="mt-2 font-medium">{blog.title}</p>
              <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{blog.excerpt}</p>
              <div className="mt-3">
                <Link to={`/blog/${blog.slug}`}>
                  <Button variant="secondary">Đọc Góc động viên</Button>
                </Link>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
