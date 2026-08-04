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

export function LandingPage() {
  return (
    <div className="min-h-dvh">
      {/* Hero: one composition — brand, headline, support, CTAs, visual */}
      <section className="relative isolate min-h-[100dvh] overflow-hidden">
        <img
          src="/hero-scene.svg"
          alt=""
          className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover object-[center_30%] hero-drift"
          decoding="async"
        />
        <div
          className="absolute inset-0 -z-10 bg-gradient-to-b from-[var(--color-cream)]/55 via-[var(--color-cream)]/75 to-[var(--color-cream)]"
          aria-hidden="true"
        />
        <div className="mx-auto flex min-h-[100dvh] max-w-lg flex-col justify-between px-4 pb-12 pt-8">
          <header className="fade-in">
            <BrandLogo size="lg" to="/" />
          </header>

          <div className="fade-up py-8">
            <h1 className="font-display text-[2rem] leading-tight text-[var(--color-ink)] sm:text-[2.4rem]">
              Bắt đầu từ tuổi 40 để sống khỏe và tự chủ lâu hơn.
            </h1>
            <p className="mt-4 max-w-[34ch] text-lg leading-relaxed text-[var(--color-ink-muted)]">
              Hiểu mức độ sẵn sàng, rồi làm những việc nhỏ mỗi tuần — không ồn ào,
              không hứa hẹn thần kỳ.
            </p>
            <div className="mt-8 flex flex-col gap-3">
              <Link to="/danh-gia">
                <Button className="w-full">
                  Kiểm tra mức độ sẵn sàng trong 7 phút
                </Button>
              </Link>
              <Link to="/hoi">
                <Button variant="secondary" className="w-full">
                  Hỏi một câu hỏi
                </Button>
              </Link>
            </div>
          </div>

          <p className="fade-in text-sm text-[var(--color-ink-muted)]">
            Cuộn xuống để xem Sống An 40+ giúp gì cho bạn
          </p>
        </div>
      </section>

      <section className="border-t border-[var(--color-sand)]/35 px-4 py-14">
        <div className="mx-auto max-w-lg fade-up">
          <h2 className="font-display text-2xl text-[var(--color-ink)]">
            Dành cho ai?
          </h2>
          <p className="mt-3 text-base leading-relaxed text-[var(--color-ink-muted)]">
            {LANDING_AUDIENCE}
          </p>
        </div>
      </section>

      <section className="bg-[var(--color-green-soft)]/45 px-4 py-14">
        <div className="mx-auto max-w-lg">
          <h2 className="font-display text-2xl text-[var(--color-ink)]">
            Ba trụ cột chuẩn bị
          </h2>
          <p className="mt-2 text-[var(--color-ink-muted)]">
            Mỗi trụ cột là một mảng đời sống bạn có thể chủ động cải thiện dần.
          </p>
          <ol className="mt-8 space-y-8">
            {LANDING_PILLARS.map((pillar, index) => (
              <li
                key={pillar.id}
                className="fade-up"
                style={{ animationDelay: `${index * 90}ms` }}
              >
                <p className="text-sm font-medium tracking-wide text-[var(--color-green)]">
                  0{index + 1}
                </p>
                <h3 className="mt-1 font-display text-xl text-[var(--color-ink)]">
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

      <section className="px-4 py-14">
        <div className="mx-auto max-w-lg">
          <h2 className="font-display text-2xl text-[var(--color-ink)]">
            Cách Sống An 40+ hoạt động
          </h2>
          <p className="mt-2 text-[var(--color-ink-muted)]">
            Ba bước rõ ràng — bạn luôn kiểm soát tốc độ của mình.
          </p>
          <ol className="mt-8 space-y-8">
            {LANDING_STEPS.map((item, index) => (
              <li
                key={item.step}
                className="fade-up grid grid-cols-[auto_1fr] gap-4"
                style={{ animationDelay: `${index * 90}ms` }}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-green)] font-display text-white">
                  {item.step}
                </span>
                <div>
                  <h3 className="font-display text-xl text-[var(--color-ink)]">
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

      <section className="border-y border-[var(--color-sand)]/35 bg-white/40 px-4 py-14">
        <div className="mx-auto max-w-lg">
          <h2 className="font-display text-2xl text-[var(--color-ink)]">
            Bạn nhận được gì
          </h2>
          <p className="mt-2 text-[var(--color-ink-muted)]">
            Công cụ thực tế để theo dõi và hành động — không phải bảng xếp hạng.
          </p>
          <ul className="mt-8 space-y-7">
            {LANDING_OUTCOMES.map((item) => (
              <li key={item.title}>
                <h3 className="font-display text-xl text-[var(--color-ink)]">
                  {item.title}
                </h3>
                <p className="mt-2 leading-relaxed text-[var(--color-ink-muted)]">
                  {item.body}
                </p>
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <Link to="/thu-vien">
              <Button variant="secondary">Xem Thư viện bài học</Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="px-4 py-14">
        <div className="mx-auto max-w-lg">
          <h2 className="font-display text-2xl text-[var(--color-ink)]">
            Câu hỏi bạn có thể hỏi ngay
          </h2>
          <p className="mt-2 text-[var(--color-ink-muted)]">
            Chọn một câu để mở Hỏi Sống An — hoặc tự đặt câu hỏi của bạn.
          </p>
          <ul className="mt-6 space-y-3">
            {EXAMPLE_QUESTIONS.map((q) => (
              <li key={q}>
                <Link
                  to={`/hoi?q=${encodeURIComponent(q)}`}
                  className="block border-b border-[var(--color-sand)]/50 py-3 text-[var(--color-blue)] transition hover:text-[var(--color-green)]"
                >
                  “{q}”
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="bg-[var(--color-ink)] px-4 py-14 text-[var(--color-cream)]">
        <div className="mx-auto max-w-lg">
          <h2 className="font-display text-2xl">Rõ ràng về giới hạn</h2>
          <p className="mt-2 text-[var(--color-cream)]/75">
            Minh bạch giúp bạn dùng công cụ đúng việc.
          </p>
          <div className="mt-8 grid gap-10 sm:grid-cols-2">
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

      <section className="px-4 py-16">
        <div className="mx-auto max-w-lg text-center">
          <h2 className="font-display text-2xl text-[var(--color-ink)]">
            Bắt đầu bằng một bước nhỏ
          </h2>
          <p className="mx-auto mt-3 max-w-[36ch] text-[var(--color-ink-muted)]">
            Bài đánh giá không lưu dữ liệu nhạy cảm ngoài phiên làm việc của bạn.
            Bạn có thể hỏi đáp mà không cần hoàn thành đánh giá.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:mx-auto sm:max-w-sm">
            <Link to="/danh-gia">
              <Button className="w-full">Làm bài đánh giá</Button>
            </Link>
            <Link to="/thu-vien">
              <Button variant="ghost" className="w-full">
                Đọc bài học trước
              </Button>
            </Link>
          </div>
          <p className="mt-10 text-left text-xs leading-relaxed text-[var(--color-ink-muted)]">
            {DISCLAIMER}
          </p>
        </div>
      </section>
    </div>
  );
}
