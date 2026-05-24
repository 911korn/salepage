const RESERVED_SHOP_SLUGS = new Set([
  "_next",
  "_vercel",
  "admin",
  "api",
  "billing",
  "brand",
  "contact",
  "dashboard",
  "docs",
  "en",
  "favicon.ico",
  "icon.svg",
  "line",
  "monitoring",
  "o",
  "privacy",
  "robots.txt",
  "s",
  "signin",
  "signup",
  "sitemap.xml",
  "terms",
]);

export function isReservedShopSlug(slug: string): boolean {
  return RESERVED_SHOP_SLUGS.has(slug.trim().toLowerCase());
}

export function storefrontPath(slug: string, productSlug?: string): string {
  return productSlug ? `/${slug}/${productSlug}` : `/${slug}`;
}

export function storefrontLabel(slug: string, productSlug?: string): string {
  return `salepage.in.th${storefrontPath(slug, productSlug)}`;
}

export function absoluteStorefrontUrl(
  slug: string,
  productSlug?: string,
): string {
  return `https://salepage.in.th${storefrontPath(slug, productSlug)}`;
}
