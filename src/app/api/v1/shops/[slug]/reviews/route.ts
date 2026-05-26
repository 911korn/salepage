import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { db, OrderStatus } from "@/lib/db";

const PostBody = z.object({
  orderToken: z.string().min(8).max(64),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional().nullable(),
  productSlug: z.string().max(120).optional().nullable(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;

  const shop = await db.shop.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!shop) return fail("not_found", "ไม่พบร้านค้านี้", 404);

  const rawReviews = await db.review.findMany({
    where: { shopId: shop.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      rating: true,
      comment: true,
      customerName: true,
      reply: true,
      repliedAt: true,
      createdAt: true,
      product: { select: { slug: true, name: true } },
      // V1.5 Trust signal: every legit review's order has slipVerifiedAt
      // (we enforce that on POST). Surface a flat `verified` boolean to
      // clients so the UI can render a "✓ ยืนยันการชำระแล้ว" pill without
      // needing to expose the full order relation.
      order: { select: { slipVerifiedAt: true } },
    },
  });

  const reviews = rawReviews.map(({ order, ...rest }) => ({
    ...rest,
    verified: Boolean(order?.slipVerifiedAt),
  }));

  const agg = await db.review.aggregate({
    where: { shopId: shop.id },
    _avg: { rating: true },
    _count: { _all: true },
  });

  return ok({
    reviews,
    summary: {
      averageRating: agg._avg.rating ? Number(agg._avg.rating.toFixed(2)) : 0,
      totalReviews: agg._count._all,
    },
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;

  const shop = await db.shop.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!shop) return fail("not_found", "ไม่พบร้านค้านี้", 404);

  const parsed = await parseJson(request, PostBody);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  // Verify the customer actually placed an order with this token in this shop,
  // and the order has reached DELIVERED.
  const order = await db.order.findUnique({
    where: { publicToken: input.orderToken },
    select: {
      id: true,
      shopId: true,
      status: true,
      customerName: true,
      customerPhone: true,
      // V1.5 Trust: require slipVerifiedAt → reviews are only from verified
      // payments. This blocks fake review farms and review-bombing that don't
      // run through the actual AI-verified slip pipeline.
      slipVerifiedAt: true,
    },
  });
  if (!order || order.shopId !== shop.id) {
    return fail("not_found", "ไม่พบออเดอร์", 404);
  }
  if (
    order.status !== OrderStatus.DELIVERED &&
    order.status !== OrderStatus.SHIPPING
  ) {
    return fail(
      "order_not_eligible",
      "รีวิวได้หลังจากออเดอร์ถูกจัดส่งแล้วเท่านั้น",
      400,
    );
  }
  if (!order.slipVerifiedAt) {
    // Hard block — every legit DELIVERED/SHIPPING order goes through
    // slip verification, so a missing `slipVerifiedAt` means this Order
    // was manually flipped by an admin/dev without the receipt trail.
    // We don't want those counting toward marketplace trust signals.
    return fail(
      "slip_not_verified",
      "รีวิวต้องมาจากออเดอร์ที่ระบบยืนยันสลิปแล้วเท่านั้น",
      400,
    );
  }

  // Reject double-review on the same order
  const existing = await db.review.findFirst({
    where: { orderId: order.id },
    select: { id: true },
  });
  if (existing) {
    return fail("already_reviewed", "คุณรีวิวออเดอร์นี้ไปแล้ว", 409);
  }

  let productId: string | null = null;
  if (input.productSlug) {
    const p = await db.product.findUnique({
      where: { shopId_slug: { shopId: shop.id, slug: input.productSlug } },
      select: { id: true },
    });
    productId = p?.id ?? null;
  }

  const review = await db.review.create({
    data: {
      shopId: shop.id,
      orderId: order.id,
      productId,
      rating: input.rating,
      comment: input.comment ?? null,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
    },
  });

  // Roll the average into Shop.rating for fast read at /s/:slug
  const agg = await db.review.aggregate({
    where: { shopId: shop.id },
    _avg: { rating: true },
  });
  if (agg._avg.rating !== null) {
    await db.shop.update({
      where: { id: shop.id },
      data: { rating: Number(agg._avg.rating.toFixed(2)) },
    });
  }

  return ok({ review }, { status: 201 });
}
