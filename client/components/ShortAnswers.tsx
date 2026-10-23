import { SHORT_ANSWERS } from "@shared/brand";

/** Direct answers in Vietnamese and English, matching FAQPage JSON-LD. */
export function ShortAnswers() {
  return (
    <section className="py-14 lg:py-20" aria-labelledby="short-answers-heading">
      <div className="mx-auto w-full max-w-lg px-4 lg:max-w-3xl lg:px-10">
        <h2
          id="short-answers-heading"
          className="font-display text-2xl text-[var(--color-ink)] lg:text-4xl"
        >
          Trả lời ngắn
        </h2>
        <dl className="mt-8 space-y-8">
          {SHORT_ANSWERS.map((item) => (
            <div key={item.questionVi}>
              <dt className="font-display text-xl text-[var(--color-ink)]">
                {item.questionVi}
              </dt>
              <dd className="mt-2 leading-relaxed text-[var(--color-ink-muted)]">
                {item.answerVi}
              </dd>
            </div>
          ))}
        </dl>

        <h3
          lang="en"
          className="font-display mt-12 text-xl text-[var(--color-ink)] lg:text-2xl"
        >
          Short answers
        </h3>
        <dl lang="en" className="mt-6 space-y-8">
          {SHORT_ANSWERS.map((item) => (
            <div key={item.questionEn}>
              <dt className="font-display text-xl text-[var(--color-ink)]">
                {item.questionEn}
              </dt>
              <dd className="mt-2 leading-relaxed text-[var(--color-ink-muted)]">
                {item.answerEn}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
