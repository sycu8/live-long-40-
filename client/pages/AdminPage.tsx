import { useEffect, useState } from "react";
import { AppShell } from "../components/AppShell";
import { Button } from "../components/Button";
import { api, setAdminBearer } from "../lib/api";
import { LIBRARY_CATEGORIES } from "@shared/constants/product";

type SourceRow = {
  public_id: string;
  title: string;
  issuer: string;
  status: string;
  review_status: string;
  category: string;
  trust_tier?: string;
  original_url?: string;
};

export function AdminPage() {
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [jobs, setJobs] = useState<Array<Record<string, unknown>>>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [adminToken, setAdminToken] = useState("");
  const [form, setForm] = useState<{
    title: string;
    issuer: string;
    category: string;
    documentType: "guideline" | "education" | "policy";
    trustTier: "official_vn" | "intl_guideline" | "editorial";
    originalUrl: string;
    reviewedText: string;
    summary: string;
  }>({
    title: "",
    issuer: "Bộ Y tế Việt Nam",
    category: LIBRARY_CATEGORIES[0]!.id,
    documentType: "guideline",
    trustTier: "official_vn",
    originalUrl: "https://moh.gov.vn/",
    reviewedText: "",
    summary: "",
  });

  async function refresh(opts?: { preserveMessage?: boolean }) {
    try {
      const data = await api<{ sources: SourceRow[] }>("/admin/sources");
      setSources(data.sources);
      const jobData = await api<{ jobs: Array<Record<string, unknown>> }>(
        "/admin/ingestion-jobs",
      );
      setJobs(jobData.jobs);
      if (!opts?.preserveMessage) setMessage(null);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Không tải được admin API.");
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function applyToken() {
    setAdminBearer(adminToken || null);
    void refresh();
  }

  async function createSource(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    try {
      const created = await api<{ publicId: string }>("/admin/sources", {
        method: "POST",
        body: {
          title: form.title,
          issuer: form.issuer,
          category: form.category,
          documentType: form.documentType,
          trustTier: form.trustTier,
          originalUrl: form.originalUrl || undefined,
          summary: form.summary,
          reviewedText: form.reviewedText,
          language: "vi",
          jurisdiction: form.trustTier === "intl_guideline" ? "INTL" : "VN",
        },
      });
      await api(`/admin/sources/${created.publicId}/ingest`, {
        method: "POST",
        body: { reviewedText: form.reviewedText },
      });
      await api(`/admin/sources/${created.publicId}/approve`, {
        method: "POST",
        body: { approve: true, reviewer: "local-admin" },
      });
      setMessage("Đã tạo, nạp và duyệt nguồn chính thống.");
      setForm((f) => ({ ...f, title: "", reviewedText: "", summary: "" }));
      await refresh({ preserveMessage: true });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Thao tác thất bại.");
    }
  }

  async function withdraw(publicId: string) {
    try {
      await api(`/admin/sources/${publicId}/withdraw`, {
        method: "POST",
        body: {},
      });
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không rút được nguồn.");
    }
  }

  return (
    <AppShell showNav={false} wide>
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-3xl">Quản trị tri thức</h1>
          <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
            Production dùng Cloudflare Access. Local/staging có thể cần Bearer token
            (không lưu vào localStorage).
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2 rounded-2xl bg-white/70 p-4">
          <label className="block min-w-[240px] flex-1 text-sm">
            Admin bearer token (tuỳ chọn)
            <input
              type="password"
              autoComplete="off"
              className="mt-1 min-h-12 w-full rounded-lg border px-3"
              value={adminToken}
              onChange={(e) => setAdminToken(e.target.value)}
              placeholder="Để trống nếu môi trường development mở"
            />
          </label>
          <Button type="button" variant="secondary" onClick={applyToken}>
            Áp dụng token
          </Button>
        </div>

        <form onSubmit={createSource} className="space-y-3 rounded-2xl bg-white/70 p-4">
          <h2 className="font-display text-xl">Thêm nguồn đã duyệt</h2>
          <label className="block text-sm">
            Tiêu đề
            <input
              className="mt-1 min-h-12 w-full rounded-lg border px-3"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </label>
          <label className="block text-sm">
            Tóm tắt
            <input
              className="mt-1 min-h-12 w-full rounded-lg border px-3"
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            Tổ chức ban hành
            <input
              className="mt-1 min-h-12 w-full rounded-lg border px-3"
              value={form.issuer}
              onChange={(e) => setForm({ ...form, issuer: e.target.value })}
              required
            />
          </label>
          <label className="block text-sm">
            Mức tin cậy
            <select
              className="mt-1 min-h-12 w-full rounded-lg border px-3"
              value={form.trustTier}
              onChange={(e) =>
                setForm({
                  ...form,
                  trustTier: e.target.value as
                    | "official_vn"
                    | "intl_guideline"
                    | "editorial",
                })
              }
            >
              <option value="official_vn">Chính thống VN (official_vn)</option>
              <option value="intl_guideline">Hướng dẫn quốc tế (WHO…)</option>
              <option value="editorial">Biên tập nội bộ (không dùng làm bằng chứng chat)</option>
            </select>
          </label>
          <label className="block text-sm">
            URL nguồn gốc (bắt buộc với nguồn chính thống)
            <input
              type="url"
              className="mt-1 min-h-12 w-full rounded-lg border px-3"
              value={form.originalUrl}
              onChange={(e) => setForm({ ...form, originalUrl: e.target.value })}
              placeholder="https://"
              required={form.trustTier !== "editorial"}
            />
          </label>
          <label className="block text-sm">
            Loại văn bản
            <select
              className="mt-1 min-h-12 w-full rounded-lg border px-3"
              value={form.documentType}
              onChange={(e) =>
                setForm({
                  ...form,
                  documentType: e.target.value as
                    | "guideline"
                    | "education"
                    | "policy",
                })
              }
            >
              <option value="guideline">Guideline</option>
              <option value="policy">Policy</option>
              <option value="education">Education</option>
            </select>
          </label>
          <label className="block text-sm">
            Nhóm
            <select
              className="mt-1 min-h-12 w-full rounded-lg border px-3"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {LIBRARY_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Văn bản đã duyệt (Markdown/HTML/text)
            <textarea
              className="mt-1 min-h-40 w-full rounded-lg border px-3 py-2"
              value={form.reviewedText}
              onChange={(e) => setForm({ ...form, reviewedText: e.target.value })}
              required
            />
          </label>
          <Button type="submit">Tạo + nạp + duyệt</Button>
        </form>

        {message ? (
          <p role="status" className="text-sm">
            {message}
          </p>
        ) : null}

        <section>
          <h2 className="font-display text-xl">Nguồn</h2>
          <ul className="mt-3 space-y-2">
            {sources.map((s) => (
              <li
                key={s.public_id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/70 px-4 py-3"
              >
                <div>
                  <p className="font-medium">{s.title}</p>
                  <p className="text-xs text-[var(--color-ink-muted)]">
                    {s.issuer} · {s.trust_tier ?? "?"} · {s.status}/{s.review_status} ·{" "}
                    {s.category}
                  </p>
                  {s.original_url ? (
                    <a
                      href={s.original_url}
                      className="text-xs text-[var(--color-blue)] underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {s.original_url}
                    </a>
                  ) : null}
                </div>
                <Button variant="ghost" onClick={() => withdraw(s.public_id)}>
                  Rút nguồn
                </Button>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl">Job nạp liệu</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {jobs.map((j, i) => (
              <li key={i} className="rounded-lg bg-white/60 px-3 py-2">
                {String(j.title)} — {String(j.status)}
                {j.error_message ? ` · ${String(j.error_message)}` : ""}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
