import { Link } from "react-router-dom";
import { BRAND } from "@shared/brand";

type BrandLogoProps = {
  to?: string | null;
  size?: "sm" | "md" | "lg";
  /** Mark only, or mark + wordmark text */
  showWordmark?: boolean;
  /** Use full lockup SVG instead of mark + HTML text */
  variant?: "mark" | "lockup";
  className?: string;
};

const SIZES = {
  sm: { mark: 28, text: "text-lg", lockupH: 28 },
  md: { mark: 36, text: "text-xl", lockupH: 36 },
  lg: { mark: 48, text: "text-3xl", lockupH: 48 },
} as const;

export function BrandLogo({
  to = "/",
  size = "md",
  showWordmark = true,
  variant = "mark",
  className = "",
}: BrandLogoProps) {
  const s = SIZES[size];

  const content =
    variant === "lockup" ? (
      <img
        src="/logo-lockup.svg"
        height={s.lockupH}
        alt={BRAND.name}
        className={`w-auto ${className}`}
        style={{ height: s.lockupH }}
        decoding="async"
      />
    ) : (
      <span
        className={`inline-flex items-center gap-2.5 text-[var(--color-green)] ${className}`}
      >
        <img
          src="/logo-mark.svg"
          width={s.mark}
          height={s.mark}
          alt=""
          className="shrink-0 rounded-[22%]"
          decoding="async"
        />
        {showWordmark ? (
          <span className={`font-display leading-none tracking-tight ${s.text}`}>
            {BRAND.name}
          </span>
        ) : (
          <span className="sr-only">{BRAND.name}</span>
        )}
      </span>
    );

  if (!to) return content;
  return (
    <Link
      to={to}
      className="inline-flex no-underline"
      aria-label={`${BRAND.name} — trang chủ`}
    >
      {content}
    </Link>
  );
}
