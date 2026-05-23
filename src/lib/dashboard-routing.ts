export type DashboardSearchParamValue = string | string[] | null | undefined;

export function normalizeDashboardShopSlug(value: DashboardSearchParamValue) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function resolveDashboardShop<T extends { slug: string }>(
  shops: T[],
  shopSlug: DashboardSearchParamValue,
) {
  const normalized = normalizeDashboardShopSlug(shopSlug);
  return shops.find((shop) => shop.slug === normalized) ?? shops[0] ?? null;
}

export function dashboardHref(
  path: string,
  shopSlug?: string | null,
  params?: Record<string, string | null | undefined>,
) {
  const searchParams = new URLSearchParams();
  if (shopSlug) searchParams.set("shop", shopSlug);

  for (const [key, value] of Object.entries(params ?? {})) {
    if (value) searchParams.set(key, value);
  }

  const query = searchParams.toString();
  return query ? `${path}?${query}` : path;
}
