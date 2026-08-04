import { NavLink, Link } from "react-router-dom";
import { clsx } from "clsx";
import { BrandLogo } from "./BrandLogo";
import { APP_NAV_ITEMS } from "../lib/nav";

/** Desktop-only primary navigation (sidebar). Hidden below `lg`. */
export function SideNav() {
  return (
    <aside
      className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-[var(--color-sand)]/45 bg-[var(--color-cream)]/95 px-4 py-6 backdrop-blur lg:flex xl:w-64"
      aria-label="Điều hướng máy tính"
    >
      <BrandLogo size="md" to="/" />
      <p className="mt-3 text-xs leading-relaxed text-[var(--color-ink-muted)]">
        Công cụ giáo dục cho tuổi 40+ — không thay thế bác sĩ.
      </p>
      <nav className="mt-8 flex-1" aria-label="Điều hướng chính">
        <ul className="space-y-1">
          {APP_NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  clsx(
                    "block rounded-xl px-3 py-2.5 text-[15px] transition",
                    isActive
                      ? "bg-[var(--color-green)] font-semibold text-white"
                      : "text-[var(--color-ink)] hover:bg-white/70",
                  )
                }
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="space-y-2 border-t border-[var(--color-sand)]/40 pt-4 text-sm">
        <Link
          to="/danh-gia"
          className="block text-[var(--color-green)] hover:underline"
        >
          Làm bài đánh giá
        </Link>
        <Link to="/" className="block text-[var(--color-ink-muted)] hover:underline">
          Về trang chủ
        </Link>
      </div>
    </aside>
  );
}
