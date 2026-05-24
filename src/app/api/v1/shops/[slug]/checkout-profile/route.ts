import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { db } from "@/lib/db";
import { verifyPlatformLineIdToken } from "@/lib/line";
import {
  extractThaiPostcode,
  makeAddressKey,
  makeAddressLabel,
  normalizeAddress,
  normalizeCustomerPhone,
} from "@/lib/customer-addresses";

export const runtime = "nodejs";

interface Ctx {
  params: Promise<{ slug: string }>;
}

const Body = z.object({
  idToken: z.string().min(20),
});

export async function POST(request: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  const parsed = await parseJson(request, Body);
  if (!parsed.ok) return parsed.response;

  let profile: Awaited<ReturnType<typeof verifyPlatformLineIdToken>>;
  try {
    profile = await verifyPlatformLineIdToken(parsed.data.idToken);
  } catch (e) {
    return fail(
      "line_verify_failed",
      "ยืนยันตัวตน LINE ไม่สำเร็จ กรุณาลองใหม่",
      401,
      e instanceof Error ? e.message : "LINE verify failed",
    );
  }

  const shop = await db.shop.findFirst({
    where: { slug, status: "ACTIVE", suspended: false },
    select: { id: true },
  });
  if (!shop) return fail("shop_not_found", "ไม่พบร้านค้านี้", 404);

  const latestOrder = await db.order.findFirst({
    where: {
      shopId: shop.id,
      customerLineUserId: profile.sub,
    },
    orderBy: { createdAt: "desc" },
    select: {
      customerName: true,
      customerPhone: true,
      customerEmail: true,
      customerAddress: true,
      createdAt: true,
    },
  });

  const phone = normalizeCustomerPhone(latestOrder?.customerPhone ?? "");
  const addresses =
    phone.length >= 9
      ? await db.customerAddress.findMany({
          where: { shopId: shop.id, customerPhone: phone },
          orderBy: [{ lastUsedAt: "desc" }, { useCount: "desc" }],
          take: 3,
          select: {
            id: true,
            label: true,
            customerName: true,
            address: true,
            postcode: true,
            useCount: true,
            lastUsedAt: true,
          },
        })
      : [];

  const fallbackAddress = latestOrder?.customerAddress
    ? normalizeAddress(latestOrder.customerAddress)
    : "";
  const normalizedAddresses = addresses.map((address) => ({
    ...address,
    customerEmail: latestOrder?.customerEmail ?? null,
    lastUsedAt: address.lastUsedAt.toISOString(),
  }));
  const hasFallbackAddress =
    fallbackAddress &&
    !normalizedAddresses.some(
      (address) => makeAddressKey(address.address) === makeAddressKey(fallbackAddress),
    );

  return ok({
    profile: {
      userId: profile.sub,
      displayName: profile.name ?? null,
      pictureUrl: profile.picture ?? null,
    },
    customer: latestOrder
      ? {
          name: latestOrder.customerName || profile.name || null,
          phone: phone || latestOrder.customerPhone || null,
          email: latestOrder.customerEmail || profile.email || null,
          address: fallbackAddress || null,
          lastOrderedAt: latestOrder.createdAt.toISOString(),
        }
      : {
          name: profile.name ?? null,
          phone: null,
          email: profile.email ?? null,
          address: null,
          lastOrderedAt: null,
        },
    addresses: [
      ...normalizedAddresses,
      ...(hasFallbackAddress
        ? [
            {
              id: `last-order-${makeAddressKey(fallbackAddress)}`,
              label: makeAddressLabel(fallbackAddress),
              customerName: latestOrder?.customerName ?? profile.name ?? null,
              customerEmail: latestOrder?.customerEmail ?? profile.email ?? null,
              address: fallbackAddress,
              postcode: extractThaiPostcode(fallbackAddress),
              useCount: 1,
              lastUsedAt: latestOrder?.createdAt.toISOString() ?? new Date().toISOString(),
            },
          ]
        : []),
    ].slice(0, 3),
  });
}
