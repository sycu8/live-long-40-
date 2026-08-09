import { useEffect, useState } from "react";
import { clsx } from "clsx";

const SHOW_AFTER_PX = 400;

/**
 * Floating control to return to the top of the page.
 * Shown after the user scrolls past a short threshold; sits above the
 * mobile bottom nav so it stays tappable for 40+ readers.
 */
export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let ticking = false;

    const update = () => {
      setVisible(window.scrollY > SHOW_AFTER_PX);
      ticking = false;
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    window.scrollTo({
      top: 0,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  };

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Về đầu trang"
      title="Về đầu trang"
      className={clsx(
        "fixed right-4 z-50 flex h-12 w-12 items-center justify-center rounded-xl",
        "bg-[var(--color-green)] text-white shadow-md",
        "transition-[opacity,transform,background-color] duration-200",
        "hover:bg-[var(--color-green-dark)]",
        /* Clear of BottomNav on mobile; lower on desktop */
        "bottom-20 lg:bottom-8 lg:right-8",
        visible
          ? "pointer-events-auto translate-y-0 opacity-100"
          : "pointer-events-none translate-y-2 opacity-0",
      )}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M12 5v14M6 11l6-6 6 6"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
