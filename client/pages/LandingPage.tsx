import { Link } from "react-router-dom";
import { Button } from "../components/Button";
import { BrandLogo } from "../components/BrandLogo";
import { BRAND } from "@shared/brand";
import {
  LANDING_AGE40,
  LANDING_ASK,
  LANDING_CLOSING,
  LANDING_FAQ,
  LANDING_HERO,
  LANDING_NAME_STORY,
  LANDING_PATHS,
  LANDING_PILLARS,
  LANDING_PLAN,
  LANDING_READINESS,
  LANDING_TRUST,
} from "../content/landing";

const shell = "mx-auto w-full max-w-lg px-4 lg:max-w-6xl lg:px-10";

export function LandingPage() {
  return (
    <div className="min-h-dvh">
      <div className="absolute inset-x-0 top-0 z-20 hidden lg:block">
        <div className={`${shell} flex items-center justify-between py-5`}>
          <BrandLogo size="lg" to="/" />
          <nav
            className="flex items-center gap-6 text-sm"
            aria-label="Liên kết trang chủ"
          >
            <Link
              className="text-[var(--color-ink-muted)] hover:text-[var(--color-green)]"
              to="/thu-vien"
            >
              Thư viện
            </Link>
            <Link
              className="text-[var(--color-ink-muted)] hover:text-[var(--color-green)]"
              to="/hoi"
            >
              {BRAND.askLabel}
            </Link>
            <Link to="/danh-gia">
              <Button>Kiểm tra mức độ sẵn sàng</Button>
            </Link>
          </nav>
        </div>
      </div>

      {/* Hero — brand first, one composition */}
      <section className="relative isolate min-h-[100dvh] overflow-hidden lg:min-h-[min(100dvh,820px)]">
        <img
          src="/hero-scene.svg"
          alt=""
          className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover object-[center_30%] hero-drift lg:object-[center_40%]"
          decoding="async"
          fetchPriority="high"
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
            <p className="mb-2 font-display text-4xl leading-none text-[var(--color-green)] sm:text-5xl lg:text-6xl">
              {BRAND.name}
            </p>
            <p className="mb-5 text-sm text-[var(--color-ink-muted)] lg:text-base">
              {BRAND.taglineLockup}
            </p>
            <h1 className="font-display text-[1.85rem] leading-tight text-[var(--color-ink)] sm:text-[2.35rem] lg:text-5xl lg:leading-[1.15]">
              {LANDING_HERO.headline}
            </h1>
            <p className="mt-4 max-w-[40ch] text-lg leading-relaxed text-[var(--color-ink-muted)] lg:max-w-xl lg:text-xl">
              {LANDING_HERO.body}
            </p>
            <p className="mt-3 max-w-[40ch] text-base leading-relaxed text-[var(--color-ink-muted)] lg:max-w-xl lg:text-lg">
              {LANDING_HERO.bodySecondary}
            </p>
            <div className="mt-8 flex flex-col gap-3 lg:flex-row lg:items-center">
              <Link to="/danh-gia" className="lg:w-auto">
                <Button className="w-full lg:w-auto lg:px-8">
                  {LANDING_HERO.primaryCta}
                </Button>
              </Link>
              <Link to="/hoi" className="lg:w-auto">
                <Button variant="secondary" className="w-full lg:w-auto lg:px-8">
                  {LANDING_HERO.secondaryCta}
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-sm text-[var(--color-ink-muted)]">
              {LANDING_HERO.note}
            </p>
          </div>

          <p className="fade-in text-sm text-[var(--color-ink-muted)] lg:mt-16 lg:self-start">
            Cuộn xuống để tìm hiểu VivaAge
          </p>
        </div>
      </section>

      <section className="border-t border-[var(--color-sand)]/35 py-14 lg:py-20">
        <div className={`${shell} fade-up max-w-3xl`}>
          <h2 className="font-display text-2xl text-[var(--color-ink)] lg:text-4xl">
            {LANDING_NAME_STORY.title}
          </h2>
          <ul className="mt-6 space-y-4 text-lg leading-relaxed text-[var(--color-ink-muted)]">
            <li>{LANDING_NAME_STORY.viva}</li>
            <li>{LANDING_NAME_STORY.age}</li>
          </ul>
          <p className="mt-6 font-display text-xl text-[var(--color-green)] lg:text-2xl">
            {LANDING_NAME_STORY.tagline}
          </p>
        </div>
      </section>

      <section className="bg-[var(--color-green-soft)]/45 py-14 lg:py-20">
        <div className={`${shell} fade-up lg:grid lg:grid-cols-[1fr_1.1fr] lg:gap-16`}>
          <div>
            <h2 className="font-display text-2xl text-[var(--color-ink)] lg:text-4xl">
              {LANDING_AGE40.title}
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-[var(--color-ink-muted)]">
              {LANDING_AGE40.lead}
            </p>
          </div>
          <div>
            <p className="text-[var(--color-ink-muted)] lg:text-lg">
              {LANDING_AGE40.intro}
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-[var(--color-ink)]">
              {LANDING_AGE40.questions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
            <p className="mt-6 text-lg leading-relaxed text-[var(--color-ink-muted)]">
              {LANDING_AGE40.close}
            </p>
          </div>
        </div>
      </section>

      <section className="py-14 lg:py-20">
        <div className={shell}>
          <h2 className="font-display text-2xl text-[var(--color-ink)] lg:text-4xl">
            Ba nền tảng cho một tương lai tự chủ
          </h2>
          <div className="mt-10 space-y-14 lg:mt-14 lg:space-y-20">
            {LANDING_PILLARS.map((pillar, index) => (
              <article
                key={pillar.id}
                className="fade-up lg:grid lg:grid-cols-[0.85fr_1.15fr] lg:gap-12"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <div>
                  <p className="text-sm font-medium tracking-wide text-[var(--color-green)]">
                    0{index + 1}
                  </p>
                  <h3 className="mt-2 font-display text-2xl text-[var(--color-ink)] lg:text-3xl">
                    {pillar.title}
                  </h3>
                  <p className="mt-3 leading-relaxed text-[var(--color-ink-muted)] lg:text-lg">
                    {pillar.body}
                  </p>
                </div>
                <div>
                  <p className="text-[var(--color-ink-muted)]">
                    {pillar.pointsIntro}
                  </p>
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-[var(--color-ink)]">
                    {pillar.points.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                  {"note" in pillar && pillar.note ? (
                    <p className="mt-4 text-sm leading-relaxed text-[var(--color-ink-muted)]">
                      {pillar.note}
                    </p>
                  ) : null}
                  <div className="mt-6">
                    <Link to={pillar.to}>
                      <Button variant="secondary">{pillar.cta}</Button>
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-[var(--color-sand)]/35 bg-white/40 py-14 lg:py-20">
        <div className={shell}>
          <h2 className="font-display text-2xl text-[var(--color-ink)] lg:text-4xl">
            {LANDING_ASK.title}
          </h2>
          <p className="mt-2 font-display text-xl text-[var(--color-green)] lg:text-2xl">
            {LANDING_ASK.subtitle}
          </p>
          <p className="mt-4 max-w-3xl text-lg text-[var(--color-ink-muted)]">
            {LANDING_ASK.lead}
          </p>
          <p className="mt-6 text-[var(--color-ink-muted)]">{LANDING_ASK.prompt}</p>
          <ul className="mt-4 space-y-2 lg:grid lg:grid-cols-2 lg:gap-x-10 lg:gap-y-2 lg:space-y-0">
            {LANDING_ASK.examples.map((q) => (
              <li key={q}>
                <Link
                  to={`/hoi?q=${encodeURIComponent(q)}`}
                  className="block border-b border-[var(--color-sand)]/45 py-3 text-[var(--color-blue)] transition hover:text-[var(--color-green)]"
                >
                  “{q}”
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-[var(--color-ink-muted)]">
            {LANDING_ASK.structureIntro}
          </p>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-[var(--color-ink)]">
            {LANDING_ASK.structure.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <div className="mt-8">
            <Link to="/hoi">
              <Button>{LANDING_ASK.cta}</Button>
            </Link>
          </div>
          <p className="mt-6 max-w-3xl text-sm leading-relaxed text-[var(--color-ink-muted)]">
            {LANDING_ASK.disclaimer}
          </p>
        </div>
      </section>

      <section className="py-14 lg:py-20">
        <div className={`${shell} lg:grid lg:grid-cols-2 lg:gap-16`}>
          <div>
            <h2 className="font-display text-2xl text-[var(--color-ink)] lg:text-4xl">
              {LANDING_READINESS.title}
            </h2>
            <p className="mt-2 font-display text-xl text-[var(--color-green)] lg:text-2xl">
              {LANDING_READINESS.subtitle}
            </p>
            <p className="mt-4 text-lg text-[var(--color-ink-muted)]">
              {LANDING_READINESS.lead}
            </p>
          </div>
          <div>
            <p className="text-[var(--color-ink-muted)]">{LANDING_READINESS.after}</p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-[var(--color-ink)]">
              {LANDING_READINESS.outcomes.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-[var(--color-ink-muted)]">
              {LANDING_READINESS.note}
            </p>
            <div className="mt-6">
              <Link to="/danh-gia">
                <Button>{LANDING_READINESS.cta}</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[var(--color-green-soft)]/35 py-14 lg:py-20">
        <div className={shell}>
          <h2 className="font-display text-2xl text-[var(--color-ink)] lg:text-4xl">
            {LANDING_PLAN.title}
          </h2>
          <p className="mt-4 max-w-3xl text-lg text-[var(--color-ink-muted)]">
            {LANDING_PLAN.lead}
          </p>
          <p className="mt-4 text-[var(--color-ink-muted)]">{LANDING_PLAN.intro}</p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:gap-x-10">
            {LANDING_PLAN.examples.map((e) => (
              <li
                key={e}
                className="border-b border-[var(--color-sand)]/40 py-3 text-[var(--color-ink)]"
              >
                {e}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-[var(--color-ink-muted)]">{LANDING_PLAN.close}</p>
          <div className="mt-6">
            <Link to="/ke-hoach">
              <Button variant="secondary">{LANDING_PLAN.cta}</Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-14 lg:py-20">
        <div className={`${shell} max-w-3xl`}>
          <h2 className="font-display text-2xl text-[var(--color-ink)] lg:text-4xl">
            {LANDING_TRUST.title}
          </h2>
          <p className="mt-4 text-lg text-[var(--color-ink-muted)]">
            {LANDING_TRUST.lead}
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-[var(--color-ink)]">
            {LANDING_TRUST.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <p className="mt-6 text-[var(--color-ink-muted)]">{LANDING_TRUST.close}</p>
        </div>
      </section>

      <section className="border-y border-[var(--color-sand)]/35 bg-white/35 py-14 lg:py-20">
        <div className={shell}>
          <h2 className="font-display text-2xl text-[var(--color-ink)] lg:text-4xl">
            {LANDING_PATHS.title}
          </h2>
          <ul className="mt-10 space-y-10 lg:grid lg:grid-cols-3 lg:gap-10 lg:space-y-0">
            {LANDING_PATHS.items.map((item) => (
              <li key={item.title}>
                <h3 className="font-display text-xl text-[var(--color-ink)] lg:text-2xl">
                  {item.title}
                </h3>
                <p className="mt-3 leading-relaxed text-[var(--color-ink-muted)]">
                  {item.body}
                </p>
                <div className="mt-5">
                  <Link to={item.to}>
                    <Button variant="secondary">{item.cta}</Button>
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="py-14 lg:py-20">
        <div className={`${shell} max-w-3xl`}>
          <h2 className="font-display text-2xl text-[var(--color-ink)] lg:text-4xl">
            Câu hỏi thường gặp
          </h2>
          <dl className="mt-8 space-y-8">
            {LANDING_FAQ.map((item) => (
              <div key={item.q}>
                <dt className="font-display text-xl text-[var(--color-ink)]">
                  {item.q}
                </dt>
                <dd className="mt-2 leading-relaxed text-[var(--color-ink-muted)]">
                  {item.a}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="bg-[var(--color-ink)] py-16 text-[var(--color-cream)] lg:py-24">
        <div className={`${shell} text-center lg:max-w-3xl`}>
          <h2 className="font-display text-2xl lg:text-4xl">
            {LANDING_CLOSING.title}
          </h2>
          <p className="mx-auto mt-4 max-w-[40ch] text-[var(--color-cream)]/80 lg:max-w-xl lg:text-lg">
            {LANDING_CLOSING.body}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:mx-auto sm:max-w-sm lg:max-w-none lg:flex-row lg:justify-center">
            <Link to="/danh-gia">
              <Button className="w-full lg:w-auto lg:px-8">
                {LANDING_CLOSING.primaryCta}
              </Button>
            </Link>
            <Link to="/hoi">
              <Button variant="secondary" className="w-full lg:w-auto lg:px-8">
                {LANDING_CLOSING.secondaryCta}
              </Button>
            </Link>
          </div>
          <p className="mt-10 text-left text-xs leading-relaxed text-[var(--color-cream)]/65 lg:mx-auto lg:max-w-3xl">
            {LANDING_CLOSING.disclaimer}
          </p>
        </div>
      </section>
    </div>
  );
}
