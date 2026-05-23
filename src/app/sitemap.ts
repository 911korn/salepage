import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

const SITE = "https://salepage.in.th";

/**
 * Sitemap covers:
 *  - landing (+ EN variant)
 *  - signup / signin
 *  - terms / privacy
 *  - one URL per active shop + one per active product inside each shop
 *
 * Order tracking pages (/o/:token) are intentionally excluded — they're
 * unguessable + per-customer; indexing leaks order data.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticPaths: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${SITE}/en`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE}/signup`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE}/brand`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE}/en/brand`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE}/en/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE}/en/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];

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
        url: `${SITE}/s/${s.slug}`,
        lastModified: s.updatedAt,
        changeFrequency: "daily" as const,
        priority: 0.7,
      },
      ...s.products.map((p) => ({
        url: `${SITE}/s/${s.slug}/${p.slug}`,
        lastModified: p.updatedAt,
        changeFrequency: "daily" as const,
        priority: 0.6,
      })),
    ]);
  } catch (e) {
    // DB outage shouldn't kill sitemap generation
    console.warn("[sitemap] DB query failed:", e);
  }

  return [...staticPaths, ...shopUrls];
}
