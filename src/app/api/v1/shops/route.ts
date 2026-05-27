import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { resolveSession } from "@/lib/api-auth";
import { db, ShopStatus } from "@/lib/db";
import { generateSlug } from "@/lib/dashboard";
import { isReservedShopSlug } from "@/lib/storefront-url";

const ALLOWED_CATEGORIES = [
  "fashion",
  "food",
  "tech",
  "beauty",
  "health",
  "furniture",
  "pets",
  "books",
  "sport",
  "other",
] as const;

const Body = z.object({
  name: z.string().min(2).max(60),
  slug: z
    .string()
    .min(3)
    .max(40)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, "kebab-case ASCII only")
    .optional(),
  description: z.string().max(280).optional(),
  category: z.enum(ALLOWED_CATEGORIES).optional(),
  themeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  logoText: z.string().max(2).optional(),
  promptpayId: z.string().min(9).max(20).optional(),
  contact: z
    .object({
      phone: z.string().optional(),
      line: z.string().optional(),
      facebook: z.string().optional(),
    })
    .optional(),
  policies: z
    .object({
      returnPolicy: z.string().optional(),
      shippingTime: z.string().optional(),
    })
    .optional(),
  /// V2.1 ที่อยู่ผู้ส่ง — printed on every shipping label by default.
  /// Optional at create time (some sellers set it later in /settings).
  pickupAddress: z.string().max(500).optional(),
  pickupPostcode: z.string().regex(/^\d{5}$/, "5-digit postcode").optional(),
});

export async function GET(request: Request) {
  // Web cookie session OR mobile Bearer JWT — `resolveSession` handles both.
  const session = await resolveSession(request);
  if (!session.ok) return session.response;
  const shops = await db.shop.findMany({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "asc" },
  });
  return ok({ shops });
}

export async function POST(request: Request) {
  const session = await resolveSession(request);
  if (!session.ok) return session.response;

  const parsed = await parseJson(request, Body);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  const slug = input.slug ?? generateSlug(input.name);
  if (isReservedShopSlug(slug)) {
    return fail(
      "slug_reserved",
      "ลิงก์ร้านนี้ชนกับหน้าระบบ กรุณาใช้ชื่ออื่น",
      409,
    );
  }

  // Slug must be unique. Retry with a -N suffix up to 3 times.
  let finalSlug = slug;
  for (let i = 0; i < 3; i++) {
    const existing = await db.shop.findUnique({ where: { slug: finalSlug } });
    if (!existing) break;
    finalSlug = `${slug}-${Math.floor(Math.random() * 900 + 100)}`;
  }
  const lastCheck = await db.shop.findUnique({ where: { slug: finalSlug } });
  if (lastCheck) {
    return fail("slug_taken", "ลิงก์ร้านนี้ถูกใช้แล้ว ลองชื่ออื่น", 409);
  }

  const shop = await db.shop.create({
    data: {
      slug: finalSlug,
      name: input.name,
      description: input.description,
      category: input.category,
      themeColor: input.themeColor ?? "#e11d48",
      logoText: input.logoText ?? input.name.trim().slice(0, 1).toUpperCase(),
      promptpayId: input.promptpayId,
      contact: input.contact ?? undefined,
      policies: input.policies ?? undefined,
      pickupAddress: input.pickupAddress?.trim() || null,
      pickupPostcode: input.pickupPostcode || null,
      status: ShopStatus.ACTIVE,
      ownerId: session.user.id,
    },
  });

  return ok({ shop }, { status: 201 });
}
