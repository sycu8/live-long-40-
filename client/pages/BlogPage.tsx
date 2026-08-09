import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { EmptyState } from "../components/ui";
import { MarkdownBody } from "../components/MarkdownBody";
import { Button } from "../components/Button";
import { api } from "../lib/api";
import { BLOG_PAGE_SIZE_DEFAULT } from "@shared/constants/blog";

type BlogSource = {
  id: string;
  title: string;
  issuer: string;
  url: string;
  publicationDate: string;
  snippet: string;
  trustTier: string;
};

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
  coverImageUrl?: string | null;
  coverAlt?: string | null;
  sources?: BlogSource[];
  sourceCount?: number;
  featured?: boolean;
};

type Backlink = { to: string; label: string };

const THEME_FILTERS = [
  { id: "", label: "Tất cả" },
  { id: "tinh-than", label: "Tinh thần" },
  { id: "thoi-quen", label: "Thói quen" },
  { id: "suc-khoe", label: "Sức khỏe" },
  { id: "tai-chinh", label: "Tiền bạc" },
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

function PostMeta({ item }: { item: BlogItem }) {
  return (
    <p className="text-xs text-[var(--color-ink-muted)]">
      {item.themeLabel} · {item.readingMinutes} phút đọc ·{" "}
      {formatDate(item.publishedAt)}
      {item.sourceCount ? ` · ${item.sourceCount} nguồn` : null}
    </p>
  );
}

function FeaturedHero({ item }: { item: BlogItem }) {
  return (
    <Link
      to={`/blog/${item.slug}`}
      className="group relative block overflow-hidden rounded-2xl bg-[var(--color-green-dark)] text-white shadow-sm transition hover:opacity-[0.98]"
    >
      {item.coverImageUrl ? (
        <img
          src={item.coverImageUrl}
          alt={item.coverAlt || ""}
          className="absolute inset-0 h-full w-full object-cover opacity-40 transition duration-500 group-hover:scale-[1.02]"
          fetchPriority="high"
        />
      ) : (
        <div
          className="absolute inset-0 bg-gradient-to-br from-[var(--color-green)] to-[var(--color-green-dark)]"
          aria-hidden
        />
      )}
      <div className="relative flex min-h-[280px] flex-col justify-end p-6 sm:min-h-[320px] sm:p-8 lg:min-h-[360px] lg:p-10">
        <span className="mb-3 inline-flex w-fit rounded-md bg-white/15 px-2.5 py-1 text-xs font-semibold tracking-wide uppercase backdrop-blur-sm">
          Bài nổi bật
        </span>
        <p className="text-xs text-white/80">
          {item.themeLabel} · {item.readingMinutes} phút ·{" "}
          {formatDate(item.publishedAt)}
        </p>
        <h2 className="mt-2 font-display text-2xl leading-snug sm:text-3xl lg:text-4xl">
          {item.title}
        </h2>
        <p className="mt-3 max-w-2xl text-sm text-white/90 sm:text-base">
          {item.excerpt}
        </p>
        <p className="mt-4 text-sm font-medium text-white">Đọc bài nổi bật →</p>
      </div>
    </Link>
  );
}

function FeaturedSecondary({ item }: { item: BlogItem }) {
  return (
    <Link
      to={`/blog/${item.slug}`}
      className="flex flex-col overflow-hidden rounded-2xl border border-[var(--color-sand)]/50 bg-white/70 transition hover:border-[var(--color-green)]/40 hover:bg-white"
    >
      {item.coverImageUrl ? (
        <img
          src={item.coverImageUrl}
          alt={item.coverAlt || ""}
          className="aspect-[16/9] w-full object-cover"
          loading="lazy"
        />
      ) : null}
      <div className="flex flex-1 flex-col p-4">
        <span className="text-xs font-semibold text-[var(--color-green)]">
          Nổi bật
        </span>
        <PostMeta item={item} />
        <h3 className="mt-2 font-display text-xl text-[var(--color-ink)]">
          {item.title}
        </h3>
        <p className="mt-2 line-clamp-3 flex-1 text-sm text-[var(--color-ink-muted)]">
          {item.excerpt}
        </p>
        <p className="mt-3 text-sm font-medium text-[var(--color-green)]">
          Đọc tiếp →
        </p>
      </div>
    </Link>
  );
}

function PostCard({ item }: { item: BlogItem }) {
  return (
    <Link
      to={`/blog/${item.slug}`}
      className="block border-b border-[var(--color-sand)]/45 pb-5 transition hover:opacity-90 lg:rounded-2xl lg:border-0 lg:bg-white/60 lg:p-5 lg:pb-5"
    >
      {item.coverImageUrl ? (
        <img
          src={item.coverImageUrl}
          alt={item.coverAlt || ""}
          className="mb-3 aspect-[16/9] w-full rounded-xl object-cover"
          loading="lazy"
        />
      ) : null}
      <PostMeta item={item} />
      <h2 className="mt-2 font-display text-2xl text-[var(--color-ink)]">
        {item.title}
      </h2>
      <p className="mt-2 text-[var(--color-ink-muted)]">{item.excerpt}</p>
      <p className="mt-3 text-sm font-medium text-[var(--color-green)]">
        Đọc tiếp →
      </p>
    </Link>
  );
}

export function BlogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const theme = searchParams.get("theme") ?? "";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  const [items, setItems] = useState<BlogItem[]>([]);
  const [featured, setFeatured] = useState<BlogItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(BLOG_PAGE_SIZE_DEFAULT);
  const [postsPerDay, setPostsPerDay] = useState(2);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (theme) params.set("theme", theme);
      params.set("page", String(page));
      params.set("pageSize", String(BLOG_PAGE_SIZE_DEFAULT));
      try {
        const data = await api<{
          items: BlogItem[];
          featured?: BlogItem[];
          cadenceDays: number;
          postsPerDay?: number;
          page: number;
          pageSize: number;
          total: number;
          totalPages: number;
        }>(`/blog?${params.toString()}`);
        setItems(data.items);
        setFeatured(data.featured ?? []);
        setTotalPages(data.totalPages || 1);
        setTotal(data.total || 0);
        setPageSize(data.pageSize || BLOG_PAGE_SIZE_DEFAULT);
        if (data.postsPerDay) setPostsPerDay(data.postsPerDay);
        if (data.page && data.page !== page) {
          const next = new URLSearchParams(searchParams);
          next.set("page", String(data.page));
          setSearchParams(next, { replace: true });
        }
      } catch (e) {
        setItems([]);
        setFeatured([]);
        setError(e instanceof Error ? e.message : "Không tải được blog.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync URL page from API clamp
  }, [theme, page]);

  function setTheme(nextTheme: string) {
    const next = new URLSearchParams();
    if (nextTheme) next.set("theme", nextTheme);
    next.set("page", "1");
    setSearchParams(next);
  }

  function goToPage(nextPage: number) {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(nextPage));
    setSearchParams(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const hero = featured[0] ?? null;
  const secondaryFeatured = featured.slice(1);

  return (
    <AppShell>
      <div className="space-y-8 fade-up">
        <div>
          <h1 className="font-display text-3xl">Góc động viên</h1>
          <p className="mt-2 text-[var(--color-ink-muted)]">
            Bài viết tư vấn giáo dục cho người lớn tuổi — có nguồn chính thống.
            Mỗi trang {pageSize} bài để tải nhanh; bài nổi bật hiện trước.
            Khoảng {postsPerDay} bài mới mỗi ngày.
          </p>
          <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
            Không thay lời bác sĩ hay tư vấn đầu tư. Câu hỏi chuyên môn nằm ở{" "}
            <Link className="text-[var(--color-green)] underline" to="/hoi">
              Hỏi VivaAge
            </Link>{" "}
            hoặc{" "}
            <Link className="text-[var(--color-green)] underline" to="/thu-vien">
              Thư viện
            </Link>
            .
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

        {!loading && !error && items.length === 0 && featured.length === 0 ? (
          <EmptyState
            title="Chưa có bài mới"
            description="Bài viết được lên lịch mỗi ngày. Bạn có thể đọc Thư viện hoặc hỏi VivaAge trong lúc chờ."
            action={
              <Link to="/thu-vien">
                <Button variant="secondary">Xem Thư viện</Button>
              </Link>
            }
          />
        ) : null}

        {!loading && hero ? (
          <section aria-label="Bài nổi bật" className="space-y-4">
            <FeaturedHero item={hero} />
            {secondaryFeatured.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {secondaryFeatured.map((item) => (
                  <FeaturedSecondary key={item.slug} item={item} />
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {!loading && items.length > 0 ? (
          <section aria-label="Tất cả bài viết" className="space-y-4">
            {page === 1 && featured.length > 0 ? (
              <h2 className="font-display text-xl text-[var(--color-ink)]">
                Bài mới &amp; đang đọc
              </h2>
            ) : null}
            <ul className="space-y-5 lg:grid lg:grid-cols-2 lg:gap-8 lg:space-y-0 xl:grid-cols-3">
              {items.map((item) => (
                <li key={item.slug}>
                  <PostCard item={item} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {!loading && totalPages > 1 ? (
          <nav
            className="flex flex-col items-center gap-3 border-t border-[var(--color-sand)]/40 pt-6 sm:flex-row sm:justify-between"
            aria-label="Phân trang blog"
          >
            <p className="text-sm text-[var(--color-ink-muted)]">
              Trang {page} / {totalPages} · {total} bài
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                variant="secondary"
                disabled={page <= 1}
                onClick={() => goToPage(page - 1)}
              >
                ← Trước
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => {
                  if (totalPages <= 7) return true;
                  return (
                    p === 1 ||
                    p === totalPages ||
                    Math.abs(p - page) <= 1
                  );
                })
                .map((p, idx, arr) => {
                  const prev = arr[idx - 1];
                  const showEllipsis = prev != null && p - prev > 1;
                  return (
                    <span key={p} className="flex items-center gap-2">
                      {showEllipsis ? (
                        <span className="text-[var(--color-ink-muted)]">…</span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => goToPage(p)}
                        className={`min-h-10 min-w-10 rounded-lg px-3 text-sm ${
                          p === page
                            ? "bg-[var(--color-green)] text-white"
                            : "bg-white/70 text-[var(--color-ink)]"
                        }`}
                        aria-current={p === page ? "page" : undefined}
                      >
                        {p}
                      </button>
                    </span>
                  );
                })}
              <Button
                variant="secondary"
                disabled={page >= totalPages}
                onClick={() => goToPage(page + 1)}
              >
                Sau →
              </Button>
            </div>
          </nav>
        ) : null}
      </div>
    </AppShell>
  );
}

export function BlogDetailPage() {
  const { slug } = useParams();
  const [item, setItem] = useState<BlogItem | null>(null);
  const [related, setRelated] = useState<BlogItem[]>([]);
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        const data = await api<{
          item: BlogItem;
          related: BlogItem[];
          backlinks?: Backlink[];
        }>(`/blog/${slug}`);
        setItem(data.item);
        setRelated(data.related ?? []);
        setBacklinks(data.backlinks ?? []);
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
            {item.featured ? "Bài nổi bật · " : null}
            {item.themeLabel} · {item.readingMinutes} phút ·{" "}
            {formatDate(item.publishedAt)} · {item.authorName}
          </p>
          <h1 className="font-display text-3xl leading-snug lg:text-4xl">
            {item.title}
          </h1>
          <p className="text-lg text-[var(--color-ink-muted)]">{item.excerpt}</p>
          {item.coverImageUrl ? (
            <img
              src={item.coverImageUrl}
              alt={item.coverAlt || ""}
              className="aspect-[16/9] w-full rounded-2xl object-cover"
            />
          ) : null}
          <div className="border-t border-[var(--color-sand)]/40 pt-5">
            <MarkdownBody source={item.bodyMarkdown ?? ""} />
          </div>

          {item.sources && item.sources.length > 0 ? (
            <aside className="rounded-2xl border border-[var(--color-green-soft)] bg-[var(--color-green-soft)]/40 p-4">
              <p className="text-xs font-semibold text-[var(--color-green)]">
                Nguồn chính thống
              </p>
              <ul className="mt-3 space-y-3">
                {item.sources.map((s) => (
                  <li key={s.id}>
                    <p className="font-medium text-[var(--color-ink)]">
                      {s.title}
                    </p>
                    <p className="text-sm text-[var(--color-ink-muted)]">
                      {s.issuer}
                      {s.publicationDate ? ` · ${s.publicationDate}` : ""}
                    </p>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block break-all text-sm text-[var(--color-blue)] underline"
                    >
                      Xem tài liệu nguồn
                    </a>
                  </li>
                ))}
              </ul>
            </aside>
          ) : null}

          <div className="border-t border-[var(--color-sand)]/40 pt-6">
            <p className="text-sm text-[var(--color-ink-muted)]">
              Nếu bài viết này hữu ích, hãy làm một việc nhỏ hôm nay — hoặc tiếp
              tục trên VivaAge.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {(backlinks.length
                ? backlinks
                : [
                    { to: "/danh-gia", label: "Kiểm tra mức độ sẵn sàng" },
                    { to: "/hoi", label: "Hỏi VivaAge" },
                  ]
              )
                .slice(0, 4)
                .map((b) => (
                  <Link key={b.to} to={b.to}>
                    <Button
                      variant={b.to === "/danh-gia" ? "primary" : "secondary"}
                    >
                      {b.label}
                    </Button>
                  </Link>
                ))}
            </div>
          </div>
        </div>

        <aside className="mt-8 space-y-8 border-t border-[var(--color-sand)]/40 pt-6 lg:mt-0 lg:border-t-0 lg:pt-10">
          {related.length > 0 ? (
            <div>
              <h2 className="font-display text-xl">Bài liên quan</h2>
              <ul className="mt-3 space-y-4">
                {related.map((r) => (
                  <li key={r.slug}>
                    <Link
                      to={`/blog/${r.slug}`}
                      className="font-medium text-[var(--color-green)] hover:underline"
                    >
                      {r.featured ? "★ " : null}
                      {r.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div>
            <h2 className="font-display text-xl">Trong VivaAge</h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link
                  className="text-[var(--color-green)] underline"
                  to="/ke-hoach"
                >
                  Kế hoạch 30 ngày
                </Link>
              </li>
              <li>
                <Link
                  className="text-[var(--color-green)] underline"
                  to="/thu-vien"
                >
                  Thư viện giáo dục
                </Link>
              </li>
              <li>
                <Link
                  className="text-[var(--color-green)] underline"
                  to="/danh-gia"
                >
                  Đánh giá sẵn sàng
                </Link>
              </li>
              <li>
                <Link className="text-[var(--color-green)] underline" to="/hoi">
                  Hỏi VivaAge
                </Link>
              </li>
            </ul>
          </div>
        </aside>
      </article>
    </AppShell>
  );
}
