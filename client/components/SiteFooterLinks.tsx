import { HUB_SITE, SIBLING_SITES } from "@shared/brand";

/** Hub plus sibling projects. Kept separate from the health disclaimer. */
export function SiteFooterLinks() {
  return (
    <nav aria-label="Dự án liên quan" className="mt-4 space-y-2">
      <p>
        Dự án cá nhân trên{" "}
        <a
          className="underline decoration-[var(--color-sand)] underline-offset-2 hover:text-[var(--color-green)]"
          href={HUB_SITE.href}
        >
          {HUB_SITE.nameVi}
        </a>
        .
      </p>
      <p lang="en">
        A personal project on{" "}
        <a
          className="underline decoration-[var(--color-sand)] underline-offset-2 hover:text-[var(--color-green)]"
          href={HUB_SITE.href}
        >
          {HUB_SITE.nameEn}
        </a>
        .
      </p>
      <ul className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-x-4">
        {SIBLING_SITES.map((site) => (
          <li key={site.href}>
            <a
              className="underline decoration-[var(--color-sand)] underline-offset-2 hover:text-[var(--color-green)]"
              href={site.href}
            >
              {site.nameVi}
            </a>
            <span lang="en"> — {site.nameEn}</span>
          </li>
        ))}
      </ul>
    </nav>
  );
}
