import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LogoMark, Wordmark } from "@/components/ui/logo";
import { storefrontPath } from "@/lib/storefront-url";

export async function Footer() {
  const t = await getTranslations("footer");

  // `external: true` means render as a raw <a href> (skip next-intl Link,
  // which would prepend the locale prefix for the non-default locale and
  // break /api/* URLs which are not under [locale]).
  const cols: {
    titleKey: string;
    links: { href: string; labelKey: string; external?: boolean }[];
  }[] = [
    {
      titleKey: "colProduct",
      links: [
        { href: "#features", labelKey: "nav.features" },
        { href: "#promptpay", labelKey: "nav.promptpay" },
        { href: "#pricing", labelKey: "nav.pricing" },
        { href: storefrontPath("siam-snack"), labelKey: "footer.linkExample" },
      ],
    },
    {
      titleKey: "colDevs",
      links: [
        { href: "/api/v1/health", labelKey: "footer.linkApiV1", external: true },
        { href: "/docs", labelKey: "footer.linkDocs" },
      ],
    },
    {
      titleKey: "colCompany",
      links: [
        { href: "/about", labelKey: "footer.linkAbout" },
        { href: "/contact", labelKey: "footer.linkContact" },
        { href: "/brand", labelKey: "footer.linkBrand" },
        { href: "/terms", labelKey: "footer.linkTerms" },
        { href: "/privacy", labelKey: "footer.linkPrivacy" },
      ],
    },
  ];

  const tRoot = await getTranslations();

  return (
    <footer className="border-t border-[color:var(--color-border)] bg-white">
      <div className="container-page py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="flex items-center gap-2">
              <LogoMark />
              <Wordmark />
            </Link>
            <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-zinc-600">
              {t("tagline")}
            </p>
          </div>

          {cols.map((col) => (
            <div key={col.titleKey}>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                {t(col.titleKey)}
              </p>
              <ul className="mt-4 space-y-3">
                {col.links.map((l) =>
                  l.external ? (
                    <li key={l.href}>
                      <a
                        href={l.href}
                        className="text-sm text-zinc-700 hover:text-[color:var(--color-brand-700)]"
                      >
                        {tRoot(l.labelKey)}
                      </a>
                    </li>
                  ) : (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        className="text-sm text-zinc-700 hover:text-[color:var(--color-brand-700)]"
                      >
                        {tRoot(l.labelKey)}
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-[color:var(--color-border)] pt-6 sm:flex-row sm:items-center">
          <p className="text-[13px] text-zinc-500">
            {t("copyright", { year: new Date().getFullYear() })}
          </p>
          <p className="text-[13px] text-zinc-500">{t("credit")}</p>
        </div>
      </div>
    </footer>
  );
}
