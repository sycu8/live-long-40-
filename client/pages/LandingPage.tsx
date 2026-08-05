import { Link } from "react-router-dom";
import { Button } from "../components/Button";
import { BrandLogo } from "../components/BrandLogo";
import { EXAMPLE_QUESTIONS, DISCLAIMER } from "@shared/constants/product";
import {
  LANDING_AUDIENCE,
  LANDING_BOUNDARIES,
  LANDING_OUTCOMES,
  LANDING_PILLARS,
  LANDING_STEPS,
} from "../content/landing";

const shell = "mx-auto w-full max-w-lg px-4 lg:max-w-6xl lg:px-10";

export function LandingPage() {
  return (
    <div className="min-h-dvh">
      {/* Desktop: top marketing nav (no bottom-tab chrome) */}
      <div className="absolute inset-x-0 top-0 z-20 hidden lg:block">
        <div className={`${shell} flex items-center justify-between py-5`}>
          <BrandLogo size="lg" to="/" />
          <nav className="flex items-center gap-6 text-sm" aria-label="Liên kết trang chủ">
            <Link className="text-[var(--color-ink-muted)] hover:text-[var(--color-green)]" to="/blog">
              Góc động viên
            </Link>
            <Link className="text-[var(--color-ink-muted)] hover:text-[var(--color-green)]" to="/thu-vien">
              Thư viện
            </Link>
            <Link className="text-[var(--color-ink-muted)] hover:text-[var(--color-green)]" to="/hoi">
              Hỏi Sống An
            </Link>
            <Link to="/danh-gia">
              <Button>Bắt đầu đánh giá</Button>
            </Link>
          </nav>
        </div>
      </div>

      <section className="relative isolate min-h-[100dvh] overflow-hidden lg:min-h-[min(100dvh,820px)]">
        <img
          src="/hero-scene.svg"
          alt=""
          className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover object-[center_30%] hero-drift lg:object-[center_40%]"
          decoding="async"
        />
        <div
          className="absolute inset-0 -z-10 bg-gradient-to-b from-[var(--color-cream)]/55 via-[var(--color-cream)]/75 to-[var(--color-cream)] lg:bg-gradient-to-r lg:from-[var(--color-cream)]/92 lg:via-[var(--color-cream)]/70 lg:to-transparent"
          aria-hidden="true"
        />
        <div
          className={`${shell} flex min-h-[100dvh] flex-col justify-between pb-12 pt-8 lg:min-h-[min(100dvh,820px)] lg:justify-center lg:pb-20 lg:pt-28`}
        >
          <header className="fade-in lg:hidden">
            <BrandLogo size="lg" to="/" />
          </header>

          <div className="fade-up max-w-xl py-8 lg:max-w-2xl lg:py-0">
            <p className="mb-3 hidden text-sm font-medium tracking-wide text-[var(--color-green)] lg:block">
              Sống An 40+
            </p>
            <h1 className="font-display text-[2rem] leading-tight text-[var(--color-ink)] sm:text-[2.4rem] lg:text-5xl lg:leading-[1.15]">
              Bắt đầu từ tuổi 40 để sống khỏe và tự chủ lâu hơn.
            </h1>
            <p className="mt-4 max-w-[34ch] text-lg leading-relaxed text-[var(--color-ink-muted)] lg:max-w-xl lg:text-xl">
              Hiểu mình đang chuẩn bị đến đâu, rồi làm từng việc nhỏ mỗi tuần — không
              ồn ào, không hứa hẹn thần kỳ.
            </p>
            <div className="mt-8 flex flex-col gap-3 lg:flex-row lg:items-center">
              <Link to="/danh-gia" className="lg:w-auto">
                <Button className="w-full lg:w-auto lg:px-8">
                  Kiểm tra mức độ chuẩn bị trong 7 phút
                </Button>
              </Link>
              <Link to="/hoi" className="lg:w-auto">
                <Button variant="secondary" className="w-full lg:w-auto lg:px-8">
                  Hỏi một câu hỏi
                </Button>
              </Link>
            </div>
          </div>

          <p className="fade-in text-sm text-[var(--color-ink-muted)] lg:mt-16 lg:self-start">
            Cuộn xuống để xem Sống An 40+ giúp gì cho bạn
          </p>
        </div>
      </section>

      <section className="border-t border-[var(--color-sand)]/35 py-14 lg:py-20">
        <div className={`${shell} fade-up lg:grid lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:items-end`}>
          <h2 className="font-display text-2xl text-[var(--color-ink)] lg:text-4xl">
            Dành cho ai?
          </h2>
          <p className="mt-3 text-base leading-relaxed text-[var(--color-ink-muted)] lg:mt-0 lg:text-lg">
            {LANDING_AUDIENCE}
          </p>
        </div>
      </section>

      <section className="bg-[var(--color-green-soft)]/45 py-14 lg:py-20">
        <div className={shell}>
          <h2 className="font-display text-2xl text-[var(--color-ink)] lg:text-4xl">
            Ba trụ cột chuẩn bị
          </h2>
          <p className="mt-2 max-w-2xl text-[var(--color-ink-muted)] lg:text-lg">
            Mỗi trụ cột là một mảng đời sống bạn có thể chủ động cải thiện dần.
          </p>
          <ol className="mt-8 space-y-8 lg:mt-12 lg:grid lg:grid-cols-3 lg:gap-10 lg:space-y-0">
            {LANDING_PILLARS.map((pillar, index) => (
              <li
                key={pillar.id}
                className="fade-up"
                style={{ animationDelay: `${index * 90}ms` }}
              >
                <p className="text-sm font-medium tracking-wide text-[var(--color-green)]">
                  0{index + 1}
                </p>
                <h3 className="mt-1 font-display text-xl text-[var(--color-ink)] lg:text-2xl">
                  {pillar.title}
                </h3>
                <p className="mt-2 leading-relaxed text-[var(--color-ink-muted)]">
                  {pillar.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="py-14 lg:py-20">
        <div className={shell}>
          <h2 className="font-display text-2xl text-[var(--color-ink)] lg:text-4xl">
            Cách Sống An 40+ hoạt động
          </h2>
          <p className="mt-2 max-w-2xl text-[var(--color-ink-muted)] lg:text-lg">
            Ba bước rõ ràng — bạn luôn kiểm soát tốc độ của mình.
          </p>
          <ol className="mt-8 space-y-8 lg:mt-12 lg:grid lg:grid-cols-3 lg:gap-10 lg:space-y-0">
            {LANDING_STEPS.map((item, index) => (
              <li
                key={item.step}
                className="fade-up grid grid-cols-[auto_1fr] gap-4 lg:block"
                style={{ animationDelay: `${index * 90}ms` }}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-green)] font-display text-white lg:mb-4">
                  {item.step}
                </span>
                <div>
                  <h3 className="font-display text-xl text-[var(--color-ink)] lg:text-2xl">
                    {item.title}
                  </h3>
                  <p className="mt-2 leading-relaxed text-[var(--color-ink-muted)]">
                    {item.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-y border-[var(--color-sand)]/35 bg-white/40 py-14 lg:py-20">
        <div className={shell}>
          <h2 className="font-display text-2xl text-[var(--color-ink)] lg:text-4xl">
            Bạn nhận được gì
          </h2>
          <p className="mt-2 max-w-2xl text-[var(--color-ink-muted)] lg:text-lg">
            Công cụ thực tế để theo dõi và hành động — không phải bảng xếp hạng.
          </p>
          <ul className="mt-8 space-y-7 lg:mt-12 lg:grid lg:grid-cols-2 lg:gap-x-12 lg:gap-y-10 lg:space-y-0">
            {LANDING_OUTCOMES.map((item) => (
              <li key={item.title}>
                <h3 className="font-display text-xl text-[var(--color-ink)] lg:text-2xl">
                  {item.title}
                </h3>
                <p className="mt-2 leading-relaxed text-[var(--color-ink-muted)]">
                  {item.body}
                </p>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row lg:mt-12">
            <Link to="/thu-vien">
              <Button variant="secondary">Xem Thư viện bài học</Button>
            </Link>
            <Link to="/blog">
              <Button variant="ghost">Đọc Góc động viên</Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-14 lg:py-20">
        <div className={`${shell} lg:grid lg:grid-cols-2 lg:items-center lg:gap-16`}>
          <div>
            <h2 className="font-display text-2xl text-[var(--color-ink)] lg:text-4xl">
              Góc động viên
            </h2>
            <p className="mt-2 text-[var(--color-ink-muted)] lg:mt-4 lg:text-lg">
              Bài viết dài, ấm áp — cập nhật khoảng hai ngày một lần — để bạn không bị
              cuốn vào tiêu cực khi nghĩ về tuổi già, mà biết cách thích nghi từng bước.
            </p>
          </div>
          <div className="mt-6 lg:mt-0 lg:justify-self-start">
            <Link to="/blog">
              <Button>Vào Góc động viên</Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-14 lg:py-20">
        <div className={shell}>
          <h2 className="font-display text-2xl text-[var(--color-ink)] lg:text-4xl">
            Câu hỏi bạn có thể hỏi ngay
          </h2>
          <p className="mt-2 max-w-2xl text-[var(--color-ink-muted)] lg:text-lg">
            Chọn một câu để mở Hỏi Sống An — hoặc tự đặt câu hỏi của bạn.
          </p>
          <ul className="mt-6 space-y-3 lg:mt-10 lg:grid lg:grid-cols-2 lg:gap-x-12 lg:gap-y-1 lg:space-y-0">
            {EXAMPLE_QUESTIONS.map((q) => (
              <li key={q}>
                <Link
                  to={`/hoi?q=${encodeURIComponent(q)}`}
                  className="block border-b border-[var(--color-sand)]/50 py-3 text-[var(--color-blue)] transition hover:text-[var(--color-green)] lg:py-4"
                >
                  “{q}”
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="bg-[var(--color-ink)] py-14 text-[var(--color-cream)] lg:py-20">
        <div className={shell}>
          <h2 className="font-display text-2xl lg:text-4xl">Rõ ràng về giới hạn</h2>
          <p className="mt-2 text-[var(--color-cream)]/75 lg:text-lg">
            Minh bạch giúp bạn dùng công cụ đúng việc.
          </p>
          <div className="mt-8 grid gap-10 sm:grid-cols-2 lg:mt-12 lg:gap-16">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-green-soft)]">
                Sống An 40+ là
              </h3>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-[var(--color-cream)]/90">
                {LANDING_BOUNDARIES.is.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-sand)]">
                Không phải
              </h3>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-[var(--color-cream)]/90">
                {LANDING_BOUNDARIES.isNot.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 lg:py-24">
        <div className={`${shell} text-center lg:max-w-3xl`}>
          <h2 className="font-display text-2xl text-[var(--color-ink)] lg:text-4xl">
            Bắt đầu bằng một bước nhỏ
          </h2>
          <p className="mx-auto mt-3 max-w-[36ch] text-[var(--color-ink-muted)] lg:max-w-xl lg:text-lg">
            Bài đánh giá không lưu dữ liệu nhạy cảm ngoài phiên làm việc của bạn.
            Bạn có thể hỏi đáp mà không cần hoàn thành đánh giá.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:mx-auto sm:max-w-sm lg:max-w-none lg:flex-row lg:justify-center">
            <Link to="/danh-gia">
              <Button className="w-full lg:w-auto lg:px-8">Làm bài đánh giá</Button>
            </Link>
            <Link to="/thu-vien">
              <Button variant="ghost" className="w-full lg:w-auto lg:px-8">
                Đọc bài học trước
              </Button>
            </Link>
          </div>
          <p className="mt-10 text-left text-xs leading-relaxed text-[var(--color-ink-muted)] lg:mx-auto lg:max-w-3xl">
            {DISCLAIMER}
          </p>
        </div>
      </section>
    </div>
  );
}
