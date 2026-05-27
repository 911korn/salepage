import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { storefrontPath } from "@/lib/storefront-url";

const SITE = "https://salepage.in.th";

/**
 * Sitemap covers:
 *  - landing (+ EN variant)
 *  - signup / signin
 *  - shops directory, product search, public discovery
 *  - about / contact / docs (marketing surfaces)
 *  - terms / privacy / account deletion (legal + Play data-safety)
 *  - one URL per active shop + one per active product inside each shop
 *
 * Order tracking pages (/o/:token) and signed-in surfaces (/me, /cart, /billing)
 * are excluded — see robots.ts for the explicit deny rules.
 *
 * `revalidate = 3600` keeps the generated XML warm in the Vercel CDN for 1h.
 * Without it, Next.js treats DB-querying sitemaps as fully dynamic and
 * regenerates on every Googlebot/Bingbot hit, which slows crawl budget.
 */
export const revalidate = 3600;

// Static surface paths, each emitted with a TH canonical + EN alternate so
// Google's hreflang map links the two locales together. The `alternates`
// branch only fires for paths that actually have an EN translation — pages
// like /contact that are TH-only stay single-locale.
type LocaleMap = { th: string; en?: string };
const STATIC_PATHS: Array<{
  paths: LocaleMap;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}> = [
  { paths: { th: "/", en: "/en" }, changeFrequency: "weekly", priority: 1.0 },
  { paths: { th: "/signup", en: "/en/signup" }, changeFrequency: "monthly", priority: 0.9 },
  { paths: { th: "/signin", en: "/en/signin" }, changeFrequency: "monthly", priority: 0.7 },
  { paths: { th: "/shops", en: "/en/shops" }, changeFrequency: "daily", priority: 0.9 },
  { paths: { th: "/search", en: "/en/search" }, changeFrequency: "daily", priority: 0.8 },
  { paths: { th: "/about", en: "/en/about" }, changeFrequency: "monthly", priority: 0.6 },
  { paths: { th: "/contact" }, changeFrequency: "monthly", priority: 0.5 },
  { paths: { th: "/docs", en: "/en/docs" }, changeFrequency: "monthly", priority: 0.6 },
  { paths: { th: "/brand", en: "/en/brand" }, changeFrequency: "monthly", priority: 0.5 },
  { paths: { th: "/account/delete", en: "/en/account/delete" }, changeFrequency: "yearly", priority: 0.4 },
  { paths: { th: "/terms", en: "/en/terms" }, changeFrequency: "yearly", priority: 0.3 },
  { paths: { th: "/privacy", en: "/en/privacy" }, changeFrequency: "yearly", priority: 0.3 },
];

function withAlternates(thPath: string, enPath?: string) {
  if (!enPath) return undefined;
  return {
    languages: {
      th: `${SITE}${thPath}`,
      en: `${SITE}${enPath}`,
      "x-default": `${SITE}${thPath}`,
    },
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.flatMap((s) => {
    const entries: MetadataRoute.Sitemap = [
      {
        url: `${SITE}${s.paths.th}`,
        lastModified: now,
        changeFrequency: s.changeFrequency,
        priority: s.priority,
        alternates: withAlternates(s.paths.th, s.paths.en),
      },
    ];
    if (s.paths.en) {
      entries.push({
        url: `${SITE}${s.paths.en}`,
        lastModified: now,
        changeFrequency: s.changeFrequency,
        // EN at slightly lower priority — primary audience is TH.
        priority: Math.max(0.1, s.priority - 0.1),
        alternates: withAlternates(s.paths.th, s.paths.en),
      });
    }
    return entries;
  });

  // Live shops + their products. Cap to a sane number to keep the sitemap small.
  let shopUrls: MetadataRoute.Sitemap = [];
  try {
    const shops = await db.shop.findMany({
      where: { status: "ACTIVE" },
      orderBy: { totalSold: "desc" },
      take: 500,
      select: {
        slug: true,
        updatedAt: true,
        products: {
          where: { status: "ACTIVE" },
          orderBy: { sold: "desc" },
          take: 100,
          select: { slug: true, updatedAt: true },
        },
      },
    });
    shopUrls = shops.flatMap((s) => [
      {
        url: `${SITE}${storefrontPath(s.slug)}`,
        lastModified: s.updatedAt,
        changeFrequency: "daily" as const,
        priority: 0.7,
      },
      ...s.products.map((p) => ({
        url: `${SITE}${storefrontPath(s.slug, p.slug)}`,
        lastModified: p.updatedAt,
        changeFrequency: "daily" as const,
        priority: 0.6,
      })),
    ]);
  } catch (e) {
    // DB outage shouldn't kill sitemap generation
    console.warn("[sitemap] DB query failed:", e);
  }

  return [...staticEntries, ...shopUrls];
}
