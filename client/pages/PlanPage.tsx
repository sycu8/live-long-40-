import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { Button } from "../components/Button";
import { EmptyState } from "../components/ui";
import { api } from "../lib/api";
import { PILLAR_LABELS } from "@shared/constants/product";
import type { Pillar } from "@shared/constants/product";
import { reflectionPrompt } from "../content/momentum";

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

type ReflectState = {
  action: Action;
  difficulty: number;
  confidence: number;
  note: string;
  saving: boolean;
};

export function PlanPage() {
  const [actions, setActions] = useState<Action[]>([]);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [week, setWeek] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reflect, setReflect] = useState<ReflectState | null>(null);
  const [justDone, setJustDone] = useState<string | null>(null);

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

  function openReflect(action: Action) {
    setJustDone(null);
    setReflect({
      action,
      difficulty: 3,
      confidence: 4,
      note: "",
      saving: false,
    });
  }

  async function submitReflect() {
    if (!reflect) return;
    setReflect({ ...reflect, saving: true });
    try {
      await api(`/actions/${reflect.action.publicId}/complete`, {
        method: "POST",
        body: {
          difficulty: reflect.difficulty,
          confidence: reflect.confidence,
          note: reflect.note.trim() || undefined,
        },
      });
      setJustDone(reflect.action.title);
      setReflect(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không cập nhật được.");
      setReflect((r) => (r ? { ...r, saving: false } : r));
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

        {justDone ? (
          <p
            role="status"
            className="rounded-xl bg-[var(--color-green)]/10 px-4 py-3 text-sm text-[var(--color-ink)]"
          >
            Đã ghi nhận «{justDone}». Việc nhỏ cộng lại — bạn đang đi đúng hướng.
          </p>
        ) : null}

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

        <ul className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
          {weekActions.map((a) => (
            <li key={a.publicId} className="rounded-2xl bg-white/75 p-4 lg:p-5">
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
                  <Button onClick={() => openReflect(a)}>Đánh dấu hoàn thành</Button>
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

      {reflect ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reflect-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-[var(--color-cream)] p-5 shadow-lg">
            <h2 id="reflect-title" className="font-display text-2xl">
              Nhìn lại một phút
            </h2>
            <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
              {reflectionPrompt()}
            </p>
            <p className="mt-3 font-medium">{reflect.action.title}</p>

            <label className="mt-4 block text-sm">
              Độ khó (1 dễ — 5 khó)
              <input
                type="range"
                min={1}
                max={5}
                value={reflect.difficulty}
                onChange={(e) =>
                  setReflect({
                    ...reflect,
                    difficulty: Number(e.target.value),
                  })
                }
                className="mt-2 w-full"
              />
              <span className="text-[var(--color-ink-muted)]">{reflect.difficulty}/5</span>
            </label>

            <label className="mt-4 block text-sm">
              Mức tự tin làm lại (1 thấp — 5 cao)
              <input
                type="range"
                min={1}
                max={5}
                value={reflect.confidence}
                onChange={(e) =>
                  setReflect({
                    ...reflect,
                    confidence: Number(e.target.value),
                  })
                }
                className="mt-2 w-full"
              />
              <span className="text-[var(--color-ink-muted)]">{reflect.confidence}/5</span>
            </label>

            <label className="mt-4 block text-sm">
              Ghi chú ngắn (tuỳ chọn)
              <textarea
                value={reflect.note}
                onChange={(e) => setReflect({ ...reflect, note: e.target.value })}
                maxLength={500}
                rows={3}
                className="mt-2 w-full rounded-xl border border-[var(--color-sand)] bg-white/80 px-3 py-2 text-[var(--color-ink)]"
                placeholder="Ví dụ: làm vào sáng sớm thì dễ hơn"
              />
            </label>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Button
                className="flex-1"
                disabled={reflect.saving}
                onClick={() => void submitReflect()}
              >
                {reflect.saving ? "Đang lưu…" : "Lưu & hoàn thành"}
              </Button>
              <Button
                variant="secondary"
                className="flex-1"
                disabled={reflect.saving}
                onClick={() => setReflect(null)}
              >
                Huỷ
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
