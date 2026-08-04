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
    documentType: "education";
    reviewedText: string;
    summary: string;
  }>({
    title: "",
    issuer: "Sống An 40+ Biên tập",
    category: LIBRARY_CATEGORIES[0]!.id,
    documentType: "education",
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
          summary: form.summary,
          reviewedText: form.reviewedText,
          language: "vi",
          jurisdiction: "VN",
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
      setMessage("Đã tạo, nạp và duyệt nguồn.");
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
                    {s.issuer} · {s.status}/{s.review_status} · {s.category}
                  </p>
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
