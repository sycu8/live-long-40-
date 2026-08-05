import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { SideNav } from "./SideNav";
import { BrandLogo } from "./BrandLogo";
import { DISCLAIMER } from "@shared/constants/product";

/**
 * Responsive app chrome:
 * - Mobile: top bar + bottom tabs + narrow reading column
 * - Desktop (lg+): persistent sidebar + wide main stage (not a stretched phone UI)
 */
export function AppShell({
  children,
  showNav = true,
  wide = false,
}: {
  children: ReactNode;
  showNav?: boolean;
  wide?: boolean;
}) {
  const mainMax = wide
    ? "max-w-lg lg:max-w-6xl lg:w-full"
    : "max-w-lg lg:max-w-5xl lg:w-full";

  return (
    <div className="min-h-dvh lg:flex">
      {showNav ? <SideNav /> : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-[var(--color-sand)]/40 bg-[var(--color-cream)]/80 backdrop-blur lg:bg-[var(--color-cream)]/60">
          <div
            className={join(
              "mx-auto flex items-center justify-between px-4 py-3 lg:px-10",
              mainMax,
            )}
          >
            <div className={showNav ? "lg:hidden" : undefined}>
              <BrandLogo size="md" />
            </div>
            {!showNav ? <BrandLogo size="md" /> : null}
            <p className="ml-auto max-w-[55%] text-right text-xs text-[var(--color-ink-muted)] lg:max-w-none lg:text-sm">
              <span className="lg:hidden">
                Thông tin tham khảo, không thay bác sĩ
              </span>
              <span className="hidden lg:inline">
                Phiên bản máy tính · Thông tin tham khảo, không thay bác sĩ
              </span>
            </p>
          </div>
        </header>

        <main
          className={join(
            "mx-auto w-full flex-1 px-4 py-6 lg:px-10 lg:py-10",
            /* Mobile keeps phone-friendly column; desktop uses full stage width */
            "pb-24 lg:pb-10",
            mainMax,
          )}
        >
          {children}
        </main>

        <footer
          className={join(
            "mx-auto w-full px-4 pb-8 text-xs leading-relaxed text-[var(--color-ink-muted)] lg:px-10 lg:pb-10",
            mainMax,
          )}
        >
          {DISCLAIMER}
        </footer>
      </div>

      {showNav ? <BottomNav /> : null}
    </div>
  );
}

function join(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}
