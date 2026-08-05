import { Link } from "react-router-dom";
import { BRAND } from "@shared/brand";

type BrandLogoProps = {
  to?: string;
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  className?: string;
};

const SIZES = {
  sm: { mark: 28, text: "text-lg" },
  md: { mark: 36, text: "text-xl" },
  lg: { mark: 48, text: "text-3xl" },
} as const;

export function BrandLogo({
  to = "/",
  size = "md",
  showWordmark = true,
  className = "",
}: BrandLogoProps) {
  const s = SIZES[size];
  const content = (
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
