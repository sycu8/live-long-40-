import { NavLink } from "react-router-dom";
import { clsx } from "clsx";

const items = [
  { to: "/hom-nay", label: "Hôm nay" },
  { to: "/ke-hoach", label: "Kế hoạch" },
  { to: "/hoi", label: "Hỏi Sống An" },
  { to: "/thu-vien", label: "Thư viện" },
  { to: "/ho-so", label: "Hồ sơ" },
];

export function BottomNav() {
  return (
    <nav
      aria-label="Điều hướng chính"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-sand)]/50 bg-[var(--color-cream)]/95 backdrop-blur"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-between px-1">
        {items.map((item) => (
          <li key={item.to} className="flex-1">
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                clsx(
                  "flex min-h-14 flex-col items-center justify-center px-1 text-center text-sm",
                  isActive
                    ? "font-semibold text-[var(--color-green)]"
                    : "text-[var(--color-ink-muted)]",
                )
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
