import { clsx } from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  children: ReactNode;
};

export function Button({
  variant = "primary",
  className,
  children,
  ...props
}: Props) {
  return (
    <button
      className={clsx(
        "inline-flex min-h-12 items-center justify-center rounded-lg px-5 text-base font-semibold transition",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" &&
          "bg-[var(--color-green)] text-white hover:bg-[var(--color-green-dark)]",
        variant === "secondary" &&
          "bg-[var(--color-blue-soft)] text-[var(--color-blue)] hover:bg-[#d5e4ef]",
        variant === "ghost" &&
          "bg-transparent text-[var(--color-green)] underline-offset-4 hover:underline",
        variant === "danger" && "bg-[var(--color-danger)] text-white",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
