import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { EmptyState } from "../components/ui";
import { api } from "../lib/api";
import { LIBRARY_CATEGORIES, PILLAR_LABELS } from "@shared/constants/product";
import type { Pillar } from "@shared/constants/product";

type Item = {
  slug: string;
  title: string;
  summary: string;
  category: string;
  pillar: Pillar;
  issuer: string;
  publicationDate: string;
  lastReviewedAt: string;
  status: string;
  estimatedReadingMinutes: number;
  bodyMarkdown?: string;
  source?: {
    title: string;
    issuer: string;
    url?: string | null;
    trustTier?: string | null;
    publicationDate?: string | null;
    summary?: string | null;
  } | null;
};

export function LibraryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [category, setCategory] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      const q = category ? `?category=${encodeURIComponent(category)}` : "";
      try {
        const data = await api<{ items: Item[] }>(`/library${q}`);
        setItems(data.items);
      } catch (e) {
        setItems([]);
        setError(e instanceof Error ? e.message : "Không tải được thư viện.");
      } finally {
        setLoading(false);
      }
    })();
  }, [category]);

  return (
    <AppShell>
      <div className="space-y-5 fade-up">
        <div>
          <h1 className="font-display text-3xl">Thư viện</h1>
          <p className="mt-2 text-[var(--color-ink-muted)]">
            Bài học ngắn kèm nguồn chính thống (tổ chức ban hành và đường dẫn gốc).
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategory("")}
            className={`rounded-lg px-3 py-2 text-sm ${
              !category ? "bg-[var(--color-green)] text-white" : "bg-white/70"
            }`}
          >
            Tất cả
          </button>
          {LIBRARY_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={`rounded-lg px-3 py-2 text-sm ${
                category === c.id
                  ? "bg-[var(--color-green)] text-white"
                  : "bg-white/70"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {loading ? <p>Đang tải…</p> : null}
        {error ? (
          <p role="alert" className="text-[var(--color-danger)]">
            {error}
          </p>
        ) : null}
        {!loading && !error && items.length === 0 ? (
          <EmptyState
            title="Thư viện đang trống"
            description="Chưa có bài học công khai. Quản trị viên có thể thêm nguồn đã duyệt."
          />
        ) : null}
        {!loading && items.length > 0 ? (
          <ul className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0 xl:grid-cols-3">
            {items.map((item) => (
              <li key={item.slug}>
                <Link
                  to={`/thu-vien/${item.slug}`}
                  className="block h-full rounded-2xl bg-white/75 p-4 hover:bg-white"
                >
                  <p className="text-xs text-[var(--color-ink-muted)]">
                    {PILLAR_LABELS[item.pillar]} · {item.estimatedReadingMinutes} phút
                  </p>
                  <h2 className="mt-1 font-display text-xl">{item.title}</h2>
                  <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
                    {item.summary}
                  </p>
                  <p className="mt-2 text-xs text-[var(--color-ink-muted)]">
                    {item.issuer} · XB {item.publicationDate} · Rà soát{" "}
                    {item.lastReviewedAt}
                  </p>
                  {item.source?.url ? (
                    <p className="mt-1 text-xs text-[var(--color-green)]">
                      Nguồn: {item.source.issuer}
                    </p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </AppShell>
  );
}

export function LibraryDetailPage() {
  const { slug } = useParams();
  const [item, setItem] = useState<Item | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        const data = await api<{ item: Item }>(`/library/${slug}`);
        setItem(data.item);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Không tìm thấy bài.");
      }
    })();
  }, [slug]);

  if (error) {
    return (
      <AppShell>
        <p role="alert">{error}</p>
        <Link to="/thu-vien" className="text-[var(--color-green)]">
          Quay lại thư viện
        </Link>
      </AppShell>
    );
  }

  if (!item) {
    return (
      <AppShell>
        <p>Đang tải…</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <article className="fade-up mx-auto max-w-3xl space-y-4">
        <Link to="/thu-vien" className="text-sm text-[var(--color-blue)]">
          ← Thư viện
        </Link>
        <h1 className="font-display text-3xl lg:text-4xl">{item.title}</h1>
        <p className="text-sm text-[var(--color-ink-muted)]">
          {item.issuer} · Xuất bản {item.publicationDate} · Rà soát{" "}
          {item.lastReviewedAt} · Trạng thái {item.status}
        </p>
        {item.source ? (
          <aside className="rounded-2xl border border-[var(--color-green-soft)] bg-[var(--color-green-soft)]/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-green)]">
              Nguồn chính thống
            </p>
            <p className="mt-1 font-medium text-[var(--color-ink)]">{item.source.title}</p>
            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
              {item.source.issuer}
              {item.source.publicationDate ? ` · ${item.source.publicationDate}` : ""}
            </p>
            {item.source.summary ? (
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">
                {item.source.summary}
              </p>
            ) : null}
            {item.source.url ? (
              <a
                href={item.source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block break-all text-sm text-[var(--color-blue)] underline"
              >
                Mở nguồn gốc
              </a>
            ) : null}
          </aside>
        ) : (
          <p className="text-sm text-[var(--color-danger)]">
            Bài này chưa gắn nguồn chính thống — nội dung chỉ mang tính tham khảo chung.
          </p>
        )}
        <p className="text-[var(--color-ink-muted)] lg:text-lg">{item.summary}</p>
        <div className="whitespace-pre-wrap rounded-2xl bg-white/70 p-4 leading-relaxed lg:p-8">
          {item.bodyMarkdown}
        </div>
      </article>
    </AppShell>
  );
}
