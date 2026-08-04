import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { BrandLogo } from "./BrandLogo";
import { DISCLAIMER } from "@shared/constants/product";

export function AppShell({
  children,
  showNav = true,
  wide = false,
}: {
  children: ReactNode;
  showNav?: boolean;
  wide?: boolean;
}) {
  return (
    <div className="min-h-dvh pb-24">
      <header className="border-b border-[var(--color-sand)]/40 bg-[var(--color-cream)]/80 backdrop-blur">
        <div
          className={clsxMax(
            "mx-auto flex items-center justify-between px-4 py-3",
            wide ? "max-w-5xl" : "max-w-lg",
          )}
        >
          <BrandLogo size="md" />
          <p className="max-w-[50%] text-right text-xs text-[var(--color-ink-muted)]">
            Công cụ giáo dục, không phải dịch vụ y tế
          </p>
        </div>
      </header>
      <main
        className={clsxMax(
          "mx-auto px-4 py-6",
          wide ? "max-w-5xl" : "max-w-lg",
        )}
      >
        {children}
      </main>
      <footer className="mx-auto max-w-lg px-4 pb-8 text-xs leading-relaxed text-[var(--color-ink-muted)]">
        {DISCLAIMER}
      </footer>
      {showNav ? <BottomNav /> : null}
    </div>
  );
}

function clsxMax(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}
