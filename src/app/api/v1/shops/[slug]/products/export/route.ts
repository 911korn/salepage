import { fail } from "@/lib/api";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { rowsToCsv } from "@/lib/csv";

/**
 * GET /api/v1/shops/:slug/products/export — owner-only CSV download of every
 * product in the shop. Columns match the import schema 1:1.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return fail("unauthorized", "Sign in required", 401);

  const { slug } = await context.params;
  const shop = await db.shop.findUnique({
    where: { slug },
    select: { id: true, ownerId: true, slug: true },
  });
  if (!shop) return fail("not_found", "ไม่พบร้านค้านี้", 404);
  if (shop.ownerId !== session.user.id)
    return fail("forbidden", "ไม่มีสิทธิ์", 403);

  const products = await db.product.findMany({
    where: { shopId: shop.id },
    orderBy: { createdAt: "asc" },
  });

  const headers = [
    "slug",
    "name",
    "description",
    "priceBaht",
    "compareAtBaht",
    "type",
    "stock",
    "badge",
    "status",
    "imageUrl",
  ];

  const rows = products.map((p) => [
    p.slug,
    p.name,
    p.description ?? "",
    (p.priceSatang / 100).toFixed(2),
    p.compareAtSatang ? (p.compareAtSatang / 100).toFixed(2) : "",
    p.type,
    p.stock ?? "",
    p.badge ?? "",
    p.status,
    p.imageUrls[0] ?? "",
  ]);

  const csv = "﻿" + rowsToCsv(headers, rows); // BOM for Excel UTF-8
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="salepage-${shop.slug}-products.csv"`,
    },
  });
}
