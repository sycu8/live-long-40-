import { Link } from "react-router-dom";
import { Button } from "../components/Button";
import { BrandLogo } from "../components/BrandLogo";
import { EXAMPLE_QUESTIONS, PILLAR_LABELS } from "@shared/constants/product";

export function LandingPage() {
  return (
    <div className="min-h-dvh">
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10"
          aria-hidden="true"
          style={{
            background:
              "linear-gradient(160deg, rgba(31,92,69,0.12) 0%, transparent 45%), linear-gradient(20deg, rgba(61,90,115,0.10) 0%, transparent 40%), radial-gradient(ellipse at 70% 20%, #dce8e1 0%, transparent 55%)",
          }}
        />
        <div className="mx-auto flex min-h-[100dvh] max-w-lg flex-col justify-between px-4 pb-10 pt-8">
          <header className="fade-in">
            <BrandLogo size="lg" />
            <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
              Chuẩn bị cho tuổi già từ trung niên
            </p>
          </header>

          <div className="fade-up py-10">
            <h1 className="font-display text-[2rem] leading-tight text-[var(--color-ink)] sm:text-[2.35rem]">
              Bắt đầu từ tuổi 40 để sống khỏe và tự chủ lâu hơn.
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-[var(--color-ink-muted)]">
              Công cụ giáo dục giúp bạn nhìn rõ mức độ sẵn sàng về sức khỏe, tài
              chính và kỹ năng chăm sóc — rồi làm những việc nhỏ mỗi tuần.
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

          <div className="fade-in space-y-6">
            <ul className="grid grid-cols-3 gap-2 text-center text-sm">
              {(["health", "finance", "caregiving"] as const).map((p) => (
                <li
                  key={p}
                  className="rounded-xl bg-white/60 px-2 py-3 text-[var(--color-green)]"
                >
                  {PILLAR_LABELS[p]}
                </li>
              ))}
            </ul>
            <div>
              <p className="mb-2 text-sm font-medium text-[var(--color-ink)]">
                Câu hỏi thường gặp
              </p>
              <ul className="space-y-2">
                {EXAMPLE_QUESTIONS.map((q) => (
                  <li key={q}>
                    <Link
                      to={`/hoi?q=${encodeURIComponent(q)}`}
                      className="block rounded-lg bg-white/50 px-3 py-3 text-[var(--color-blue)] hover:bg-white/80"
                    >
                      “{q}”
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-xs leading-relaxed text-[var(--color-ink-muted)]">
              Sống An 40+ phù hợp với ưu tiên già hóa khỏe mạnh, không do Nhà nước
              vận hành hay chứng nhận. Không thay thế bác sĩ, tư vấn tài chính
              hay tư vấn pháp lý.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
