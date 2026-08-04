import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { Button } from "../components/Button";
import { EmptyState } from "../components/ui";
import { api } from "../lib/api";
import { PILLAR_LABELS } from "@shared/constants/product";
import type { Pillar } from "@shared/constants/product";

type Action = {
  publicId: string;
  weekNumber: number;
  title: string;
  description: string;
  reason: string;
  effortMinutes: number;
  isOptional: boolean;
  pillar: Pillar;
  status: string;
  lessonSlug?: string | null;
};

export function PlanPage() {
  const [actions, setActions] = useState<Action[]>([]);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [week, setWeek] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api<{
        plan: { title: string; summary: string; actions: Action[] };
      }>("/plans/current");
      setTitle(data.plan.title);
      setSummary(data.plan.summary);
      setActions(data.plan.actions);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chưa có kế hoạch.");
      setActions([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const weekActions = useMemo(
    () => actions.filter((a) => a.weekNumber === week),
    [actions, week],
  );

  async function complete(action: Action) {
    try {
      await api(`/actions/${action.publicId}/complete`, {
        method: "POST",
        body: { difficulty: 3, confidence: 4 },
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không cập nhật được.");
    }
  }

  if (loading) {
    return (
      <AppShell>
        <p>Đang tải kế hoạch…</p>
      </AppShell>
    );
  }

  if (!actions.length) {
    return (
      <AppShell>
        <EmptyState
          title="Chưa có kế hoạch 30 ngày"
          description="Hoàn thành bài đánh giá để nhận lịch hành động theo tuần."
          action={
            <Link to="/danh-gia">
              <Button>Bắt đầu đánh giá</Button>
            </Link>
          }
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-5 fade-up">
        <div>
          <h1 className="font-display text-3xl">{title}</h1>
          <p className="mt-2 text-[var(--color-ink-muted)]">{summary}</p>
        </div>

        <div className="flex gap-2" role="tablist" aria-label="Tuần">
          {[1, 2, 3, 4].map((w) => (
            <button
              key={w}
              type="button"
              role="tab"
              aria-selected={week === w}
              className={`min-h-11 flex-1 rounded-lg text-sm font-medium ${
                week === w
                  ? "bg-[var(--color-green)] text-white"
                  : "bg-white/70 text-[var(--color-ink)]"
              }`}
              onClick={() => setWeek(w)}
            >
              Tuần {w}
            </button>
          ))}
        </div>

        <ul className="space-y-3">
          {weekActions.map((a) => (
            <li key={a.publicId} className="rounded-2xl bg-white/75 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-[var(--color-ink-muted)]">
                    {PILLAR_LABELS[a.pillar]}
                    {a.isOptional ? " · Tùy chọn" : ""}
                  </p>
                  <h2 className="mt-1 font-display text-xl">{a.title}</h2>
                  <p className="mt-2 text-[var(--color-ink-muted)]">{a.description}</p>
                  <p className="mt-2 text-sm">
                    <span className="font-medium">Vì sao: </span>
                    {a.reason}
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                    Khoảng {a.effortMinutes} phút
                    {a.lessonSlug ? (
                      <>
                        {" · "}
                        <Link
                          className="text-[var(--color-blue)] underline"
                          to={`/thu-vien/${a.lessonSlug}`}
                        >
                          Bài học liên quan
                        </Link>
                      </>
                    ) : null}
                  </p>
                </div>
              </div>
              <div className="mt-4">
                {a.status === "completed" ? (
                  <p className="text-sm font-medium text-[var(--color-green)]">
                    Đã hoàn thành
                  </p>
                ) : (
                  <Button onClick={() => complete(a)}>Đánh dấu hoàn thành</Button>
                )}
              </div>
            </li>
          ))}
        </ul>
        {error ? (
          <p role="alert" className="text-sm text-[var(--color-danger)]">
            {error}
          </p>
        ) : null}
      </div>
    </AppShell>
  );
}
