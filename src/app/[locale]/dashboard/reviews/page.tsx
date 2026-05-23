import { Star } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireDashboardSession } from "@/lib/dashboard";
import { resolveDashboardShop } from "@/lib/dashboard-routing";
import {
  ReviewsManager,
  type ReviewView,
} from "@/components/dashboard/reviews-manager";
import type { Locale } from "@/i18n/routing";

export default async function ReviewsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ shop?: string | string[] }>;
}) {
  const { locale } = await params;
  const { shop: shopParam } = await searchParams;
  setRequestLocale(locale);

  const { shops } = await requireDashboardSession();
  const activeShop = resolveDashboardShop(shops, shopParam);
  if (!activeShop) return null;

  const [reviews, agg] = await Promise.all([
    db.review.findMany({
      where: { shopId: activeShop.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { product: { select: { name: true, slug: true } } },
    }),
    db.review.aggregate({
      where: { shopId: activeShop.id },
      _avg: { rating: true },
      _count: { _all: true },
    }),
  ]);

  const view: ReviewView[] = reviews.map((r) => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    customerName: r.customerName,
    reply: r.reply,
    repliedAt: r.repliedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    productName: r.product?.name ?? null,
    productSlug: r.product?.slug ?? null,
  }));

  const avg = agg._avg.rating ? Number(agg._avg.rating.toFixed(2)) : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <div className="flex items-center gap-2">
          <Star className="size-5 text-[color:var(--color-brand-600)]" />
          <h1 className="font-display text-2xl font-bold tracking-tight">
            รีวิวลูกค้า
          </h1>
        </div>
        <p className="mt-1 text-[13px] text-zinc-500">
          {agg._count._all > 0
            ? `รีวิวเฉลี่ย ${avg} จาก 5 (${agg._count._all} รีวิว)`
            : "ลูกค้าให้รีวิวได้หลังจากออเดอร์ถูกจัดส่ง"}
        </p>
      </header>

      <ReviewsManager shopSlug={activeShop.slug} initial={view} />
    </div>
  );
}
