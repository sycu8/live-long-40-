import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { Button } from "../components/Button";
import { ProgressBar } from "../components/ui";
import { api } from "../lib/api";

type Question = {
  id: string;
  key: string;
  prompt: string;
  helpText?: string | null;
  whyImportant?: string | null;
  options: Array<{ value: string; label: string }>;
};

type AssessmentPayload = {
  definition: { title: string; questionCount: number };
  questions: Question[];
};

export function AssessmentPage() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWhy, setShowWhy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await api<AssessmentPayload>("/assessment/current");
        setQuestions(data.questions);
        const run = await api<{ run: { publicId: string } }>("/assessment/runs", {
          method: "POST",
          body: {},
        });
        setRunId(run.run.publicId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Không tải được bài đánh giá.");
      }
    })();
  }, []);

  const current = questions[index];
  const progress = useMemo(
    () => ({ value: Object.keys(answers).length, max: questions.length || 1 }),
    [answers, questions.length],
  );

  async function selectOption(value: string) {
    if (!current || !runId || saving) return;
    setSaving(true);
    setError(null);
    try {
      await api(`/assessment/runs/${runId}/answers/${current.id}`, {
        method: "PUT",
        body: { value },
      });
      const nextAnswers = { ...answers, [current.key]: value };
      setAnswers(nextAnswers);
      if (index + 1 >= questions.length) {
        const result = await api<{ result: { publicId: string } }>(
          `/assessment/runs/${runId}/complete`,
          { method: "POST", body: { confirm: true } },
        );
        navigate(`/ket-qua/${result.result.publicId}`, { replace: true });
      } else {
        setIndex((i) => i + 1);
        setShowWhy(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không lưu được câu trả lời.");
    } finally {
      setSaving(false);
    }
  }

  if (error && questions.length === 0) {
    return (
      <AppShell showNav={false}>
        <p role="alert" className="text-[var(--color-danger)]">
          {error}
        </p>
        <Link to="/" className="mt-4 inline-block text-[var(--color-green)]">
          Về trang chủ
        </Link>
      </AppShell>
    );
  }

  if (!current) {
    return (
      <AppShell showNav={false}>
        <p>Đang chuẩn bị câu hỏi…</p>
      </AppShell>
    );
  }

  return (
    <AppShell showNav={false}>
      <div className="space-y-6">
        <ProgressBar
          value={Math.min(progress.value + 1, progress.max)}
          max={progress.max}
          label="Tiến độ"
        />
        <div className="fade-up" key={current.key}>
          <p className="text-sm text-[var(--color-ink-muted)]">
            Câu {index + 1}/{questions.length}
          </p>
          <h1 className="mt-2 font-display text-2xl leading-snug">{current.prompt}</h1>
          {current.helpText ? (
            <p className="mt-2 text-[var(--color-ink-muted)]">{current.helpText}</p>
          ) : null}
          {current.whyImportant ? (
            <div className="mt-3">
              <button
                type="button"
                className="text-sm text-[var(--color-blue)] underline"
                onClick={() => setShowWhy((v) => !v)}
                aria-expanded={showWhy}
              >
                Vì sao câu hỏi này quan trọng?
              </button>
              {showWhy ? (
                <p className="mt-2 rounded-lg bg-[var(--color-blue-soft)] p-3 text-sm">
                  {current.whyImportant}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-3" role="group" aria-label="Lựa chọn">
          {current.options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={saving}
              onClick={() => selectOption(opt.value)}
              className="min-h-14 rounded-xl border border-[var(--color-sand)] bg-white/80 px-4 py-3 text-left text-base hover:border-[var(--color-green)] hover:bg-[var(--color-green-soft)]"
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            disabled={index === 0 || saving}
            onClick={() => {
              setIndex((i) => Math.max(0, i - 1));
              setShowWhy(false);
            }}
          >
            Quay lại
          </Button>
          {saving ? <span className="text-sm text-[var(--color-ink-muted)]">Đang lưu…</span> : null}
        </div>
        {error ? (
          <p role="alert" className="text-sm text-[var(--color-danger)]">
            {error}
          </p>
        ) : null}
      </div>
    </AppShell>
  );
}
