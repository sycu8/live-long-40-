import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { EmptyState } from "../components/ui";
import { MarkdownBody } from "../components/MarkdownBody";
import { Button } from "../components/Button";
import { api } from "../lib/api";

type BlogItem = {
  slug: string;
  title: string;
  excerpt: string;
  theme: string;
  themeLabel: string;
  readingMinutes: number;
  publishedAt: string;
  authorName: string;
  bodyMarkdown?: string;
};

const THEME_FILTERS = [
  { id: "", label: "Tất cả" },
  { id: "tinh-than", label: "Tinh thần" },
  { id: "thoi-quen", label: "Thói quen" },
  { id: "suc-khoe", label: "Sức khỏe" },
  { id: "tai-chinh", label: "Tài chính" },
  { id: "cham-soc", label: "Chăm sóc" },
] as const;

function formatDate(iso: string | null | undefined) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

export function BlogPage() {
  const [items, setItems] = useState<BlogItem[]>([]);
  const [theme, setTheme] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      const q = theme ? `?theme=${encodeURIComponent(theme)}` : "";
      try {
        const data = await api<{ items: BlogItem[]; cadenceDays: number }>(
          `/blog${q}`,
        );
        setItems(data.items);
      } catch (e) {
        setItems([]);
        setError(e instanceof Error ? e.message : "Không tải được blog.");
      } finally {
        setLoading(false);
      }
    })();
  }, [theme]);

  return (
    <AppShell>
      <div className="space-y-6 fade-up">
        <div>
          <h1 className="font-display text-3xl">Góc động viên</h1>
          <p className="mt-2 text-[var(--color-ink-muted)]">
            Bài viết dài hơi, ấm áp — giúp bạn bớt tiêu cực và thích nghi với hành
            trình tuổi ngoài 40 đến tuổi già. Cập nhật mỗi ngày.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {THEME_FILTERS.map((t) => (
            <button
              key={t.id || "all"}
              type="button"
              onClick={() => setTheme(t.id)}
              className={`rounded-lg px-3 py-2 text-sm ${
                theme === t.id
                  ? "bg-[var(--color-green)] text-white"
                  : "bg-white/70"
              }`}
            >
              {t.label}
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
            title="Chưa có bài mới"
            description="Bài viết mới được lên lịch mỗi ngày. Bạn có thể đọc Thư viện hoặc hỏi Sống An trong lúc chờ."
            action={
              <Link to="/thu-vien">
                <Button variant="secondary">Xem Thư viện</Button>
              </Link>
            }
          />
        ) : null}

        {!loading && items.length > 0 ? (
          <ul className="space-y-5 lg:grid lg:grid-cols-2 lg:gap-8 lg:space-y-0">
            {items.map((item) => (
              <li key={item.slug} className="lg:rounded-2xl lg:bg-white/60 lg:p-5">
                <Link
                  to={`/blog/${item.slug}`}
                  className="block border-b border-[var(--color-sand)]/45 pb-5 transition hover:opacity-90 lg:border-0 lg:pb-0"
                >
                  <p className="text-xs text-[var(--color-ink-muted)]">
                    {item.themeLabel} · {item.readingMinutes} phút đọc ·{" "}
                    {formatDate(item.publishedAt)}
                  </p>
                  <h2 className="mt-2 font-display text-2xl text-[var(--color-ink)]">
                    {item.title}
                  </h2>
                  <p className="mt-2 text-[var(--color-ink-muted)]">{item.excerpt}</p>
                  <p className="mt-3 text-sm font-medium text-[var(--color-green)]">
                    Đọc tiếp →
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </AppShell>
  );
}

export function BlogDetailPage() {
  const { slug } = useParams();
  const [item, setItem] = useState<BlogItem | null>(null);
  const [related, setRelated] = useState<BlogItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        const data = await api<{ item: BlogItem; related: BlogItem[] }>(
          `/blog/${slug}`,
        );
        setItem(data.item);
        setRelated(data.related ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Không tìm thấy bài viết.");
      }
    })();
  }, [slug]);

  if (error) {
    return (
      <AppShell>
        <p role="alert">{error}</p>
        <Link to="/blog" className="text-[var(--color-green)]">
          Quay lại Góc động viên
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
      <article className="fade-up lg:grid lg:grid-cols-[minmax(0,42rem)_16rem] lg:justify-between lg:gap-14">
        <div className="space-y-5">
          <Link to="/blog" className="text-sm text-[var(--color-blue)]">
            ← Góc động viên
          </Link>
          <p className="text-xs text-[var(--color-ink-muted)]">
            {item.themeLabel} · {item.readingMinutes} phút ·{" "}
            {formatDate(item.publishedAt)} · {item.authorName}
          </p>
          <h1 className="font-display text-3xl leading-snug lg:text-4xl">{item.title}</h1>
          <p className="text-lg text-[var(--color-ink-muted)]">{item.excerpt}</p>
          <div className="border-t border-[var(--color-sand)]/40 pt-5">
            <MarkdownBody source={item.bodyMarkdown ?? ""} />
          </div>
          <div className="border-t border-[var(--color-sand)]/40 pt-6">
            <p className="text-sm text-[var(--color-ink-muted)]">
              Nếu bài viết này chạm đến bạn, hãy làm một việc nhỏ hôm nay — hoặc hỏi
              Sống An một câu đang khiến bạn băn khoăn.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <Link to="/danh-gia">
                <Button>Kiểm tra mức độ sẵn sàng</Button>
              </Link>
              <Link to="/hoi">
                <Button variant="secondary">Hỏi Sống An</Button>
              </Link>
            </div>
          </div>
        </div>

        {related.length > 0 ? (
          <aside className="mt-8 border-t border-[var(--color-sand)]/40 pt-6 lg:mt-0 lg:border-t-0 lg:pt-10">
            <h2 className="font-display text-xl">Bạn có thể thích</h2>
            <ul className="mt-3 space-y-4">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link
                    to={`/blog/${r.slug}`}
                    className="font-medium text-[var(--color-green)] hover:underline"
                  >
                    {r.title}
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        ) : null}
      </article>
    </AppShell>
  );
}
