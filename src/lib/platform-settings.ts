import { db } from "@/lib/db";

/// Strongly-typed reserved keys. Adding a new setting?
///   1. Add a key + shape here
///   2. Update DEFAULTS below
///   3. Add an editor in /admin/settings
export interface PlatformSettingsMap {
  announcement_banner: {
    enabled: boolean;
    text: string;
    tone: "info" | "warning";
  };
  maintenance_mode: {
    enabled: boolean;
    message: string;
    /// Roles that bypass maintenance — always at least ADMIN/SUPER_ADMIN.
    allowedRoles: string[];
  };
  email_from_override: {
    from: string;
  };
  slip_verify_provider: {
    provider: "slipok" | "easyslip" | "mock";
  };
  default_plan_caps: {
    products: number;
    ordersPerMonth: number;
    slipsPerMonth: number;
  };
}

export type PlatformSettingKey = keyof PlatformSettingsMap;

export const DEFAULTS: PlatformSettingsMap = {
  announcement_banner: { enabled: false, text: "", tone: "info" },
  maintenance_mode: {
    enabled: false,
    message: "ระบบกำลังปรับปรุง กรุณากลับมาใหม่ในไม่ช้า",
    allowedRoles: ["ADMIN", "SUPER_ADMIN"],
  },
  email_from_override: { from: "" },
  slip_verify_provider: { provider: "mock" },
  default_plan_caps: { products: 10, ordersPerMonth: 100, slipsPerMonth: 0 },
};

interface CacheEntry<T> {
  value: T;
  fetchedAt: number;
}

const CACHE_TTL_MS = 30_000;
const cache = new Map<PlatformSettingKey, CacheEntry<unknown>>();

/// Reads a single setting, falling back to DEFAULTS on missing/invalid rows.
/// Cached for 30 seconds in-process — admin writes call invalidate() to bust.
export async function getPlatformSetting<K extends PlatformSettingKey>(
  key: K,
): Promise<PlatformSettingsMap[K]> {
  const cached = cache.get(key) as CacheEntry<PlatformSettingsMap[K]> | undefined;
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.value;
  }
  const row = await db.platformSetting.findUnique({ where: { key } });
  const value = row?.value
    ? ({ ...DEFAULTS[key], ...(row.value as object) } as PlatformSettingsMap[K])
    : DEFAULTS[key];
  cache.set(key, { value, fetchedAt: Date.now() });
  return value;
}

/// Read all settings in one query — used by /admin/settings page.
export async function getAllPlatformSettings(): Promise<PlatformSettingsMap> {
  const rows = await db.platformSetting.findMany();
  const map = new Map(rows.map((r) => [r.key, r.value as object]));
  const out = {} as Record<PlatformSettingKey, unknown>;
  for (const key of Object.keys(DEFAULTS) as PlatformSettingKey[]) {
    const stored = map.get(key);
    out[key] = stored ? { ...DEFAULTS[key], ...stored } : DEFAULTS[key];
  }
  return out as PlatformSettingsMap;
}

export async function setPlatformSetting<K extends PlatformSettingKey>(
  key: K,
  value: PlatformSettingsMap[K],
  updatedBy: string,
): Promise<void> {
  await db.platformSetting.upsert({
    where: { key },
    create: { key, value: value as never, updatedBy },
    update: { value: value as never, updatedBy },
  });
  cache.delete(key);
}

export function invalidatePlatformSetting(key: PlatformSettingKey): void {
  cache.delete(key);
}

export function invalidateAllPlatformSettings(): void {
  cache.clear();
}
