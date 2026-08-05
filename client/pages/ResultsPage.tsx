import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { Button } from "../components/Button";
import { ScoreMeter } from "../components/ui";
import { api } from "../lib/api";
import { PILLAR_LABELS, SCORE_DISCLAIMER } from "@shared/constants/product";
import { questionTopicLabel } from "@shared/rules/scoring";

type Result = {
  publicId: string;
  overallScore: number;
  pillars: Array<{
    pillar: "health" | "finance" | "caregiving";
    score: number;
    interpretation: string;
  }>;
  gaps: string[];
  strengths: string[];
  explainability: {
    breakdown: Array<{
      questionKey: string;
      answered: boolean;
      rawScore: number | null;
    }>;
    unanswered: Record<string, string[]>;
  };
  scoringRulesetVersion: string;
  disclaimer: string;
};

export function ResultsPage() {
  const { id: routeResultId } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await api<{ result: Result }>("/readiness/current");
        if (routeResultId && data.result.publicId !== routeResultId) {
          setError(
            "Kết quả trên đường dẫn không khớp phiên hiện tại. Đang hiển thị kết quả mới nhất của bạn.",
          );
        }
        setResult(data.result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Không tải được kết quả.");
      }
    })();
  }, [routeResultId]);

  async function createPlan() {
    setCreating(true);
    try {
      await api("/plans", { method: "POST", body: {} });
      navigate("/ke-hoach");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tạo được kế hoạch.");
    } finally {
      setCreating(false);
    }
  }

  if (error && !result) {
    return (
      <AppShell>
        <p role="alert">{error}</p>
        <Link to="/danh-gia">
          <Button className="mt-4">Làm bài đánh giá</Button>
        </Link>
      </AppShell>
    );
  }

  if (!result) {
    return (
      <AppShell>
        <p>Đang tải kết quả…</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6 fade-up">
        <div>
          <h1 className="font-display text-3xl">Mức độ chuẩn bị của bạn</h1>
          <p className="mt-2 text-lg">
            Điểm tổng quan: <strong>{result.overallScore}/100</strong>
          </p>
          <p className="mt-2 rounded-lg bg-[var(--color-blue-soft)] p-3 text-sm">
            {SCORE_DISCLAIMER}
          </p>
        </div>

        <div className="space-y-4 rounded-2xl bg-white/70 p-4">
          {result.pillars.map((p) => (
            <div key={p.pillar} className="space-y-2">
              <ScoreMeter label={PILLAR_LABELS[p.pillar]} score={p.score} />
              <p className="text-sm text-[var(--color-ink-muted)]">{p.interpretation}</p>
            </div>
          ))}
        </div>

        <section>
          <h2 className="font-display text-xl">Ba khoảng trống ưu tiên</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {result.gaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl">Ba điểm mạnh</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {result.strengths.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </section>

        <details className="rounded-xl bg-white/50 p-4 text-sm">
          <summary className="cursor-pointer font-medium">
            Vì sao có điểm này?
          </summary>
          <p className="mt-2 text-[var(--color-ink-muted)]">
            Quy tắc chấm điểm: {result.scoringRulesetVersion}. Mỗi câu trả lời
            đóng góp theo trọng số cố định — không dùng AI để tính điểm.
          </p>
          <ul className="mt-3 space-y-1">
            {result.explainability.breakdown.map((b) => (
              <li key={b.questionKey}>
                {questionTopicLabel(b.questionKey)}:{" "}
                {b.answered ? `điểm ${b.rawScore}` : "chưa trả lời"}
              </li>
            ))}
          </ul>
        </details>

        <Button className="w-full" onClick={createPlan} disabled={creating}>
          {creating ? "Đang tạo kế hoạch…" : "Tạo kế hoạch 30 ngày"}
        </Button>
        {error ? (
          <p role="alert" className="text-sm text-[var(--color-danger)]">
            {error}
          </p>
        ) : null}
      </div>
    </AppShell>
  );
}
