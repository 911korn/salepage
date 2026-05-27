import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import {
  logAdminAction,
  requireAdminApi,
  requireSuperAdminApi,
} from "@/lib/admin";
import {
  DEFAULTS,
  getAllPlatformSettings,
  setPlatformSetting,
  type PlatformSettingKey,
} from "@/lib/platform-settings";

/// Per-key value schemas. Keep in sync with PlatformSettingsMap in
/// src/lib/platform-settings.ts.
const SCHEMAS: Record<PlatformSettingKey, z.ZodSchema> = {
  announcement_banner: z.object({
    enabled: z.boolean(),
    text: z.string().max(280),
    tone: z.enum(["info", "warning"]),
  }),
  maintenance_mode: z.object({
    enabled: z.boolean(),
    message: z.string().max(280),
    allowedRoles: z.array(z.string()).default(["ADMIN", "SUPER_ADMIN"]),
  }),
  email_from_override: z.object({
    from: z.string().max(160),
  }),
  slip_verify_provider: z.object({
    provider: z.enum(["slipok", "easyslip", "mock"]),
  }),
  default_plan_caps: z.object({
    products: z.number().int().min(0).max(100000),
    ordersPerMonth: z.number().int().min(0).max(1000000),
    slipsPerMonth: z.number().int().min(0).max(1000000),
  }),
  feed_pro_only: z.object({
    enabled: z.boolean(),
  }),
};

/// Keys that any ADMIN can edit. Keys requiring SUPER_ADMIN are everything else
/// (maintenance_mode + default_plan_caps — can lock the entire platform out).
const ADMIN_EDITABLE: ReadonlySet<PlatformSettingKey> = new Set([
  "announcement_banner",
  "email_from_override",
  "slip_verify_provider",
]);

const Body = z.object({ value: z.unknown() });

interface RouteCtx {
  params: Promise<{ key: string }>;
}

export async function GET() {
  // Public to admins only (settings can leak provider names + maintenance flag).
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const settings = await getAllPlatformSettings();
  return ok({ settings });
}

export async function PUT(request: Request, { params }: RouteCtx) {
  const { key } = await params;
  const settingKey = key as PlatformSettingKey;

  if (!(settingKey in SCHEMAS)) {
    return fail("invalid_key", "Unknown setting key", 404);
  }

  const guard = ADMIN_EDITABLE.has(settingKey)
    ? await requireAdminApi()
    : await requireSuperAdminApi();
  if (!guard.ok) return guard.response;
  const ctx = guard.ctx;

  const parsed = await parseJson(request, Body);
  if (!parsed.ok) return parsed.response;

  const valueResult = SCHEMAS[settingKey].safeParse(parsed.data.value);
  if (!valueResult.success) {
    return fail(
      "validation_error",
      "ข้อมูลไม่ผ่านการตรวจสอบ",
      422,
      valueResult.error.issues,
    );
  }

  // Merge with defaults so partial bodies don't drop fields.
  const merged = { ...DEFAULTS[settingKey], ...(valueResult.data as object) };
  await setPlatformSetting(settingKey, merged as never, ctx.userId);

  await logAdminAction(
    ctx.userId,
    "settings.update",
    { type: "setting", id: settingKey },
    { value: merged },
  );

  return ok({ key: settingKey, value: merged });
}
