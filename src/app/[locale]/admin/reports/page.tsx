import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { ResolveActions } from "@/components/admin/report-resolve-actions";
import {
  db,
  ContentReportStatus,
  ContentReportKind,
  ContentReportReason,
} from "@/lib/db";

const PAGE_SIZE = 25;
const SLA_MS = 24 * 60 * 60 * 1000;

const STATUS_FILTERS: Array<{ key: ContentReportStatus | "ACTIVE"; label: string }> = [
  { key: "ACTIVE", label: "ยังไม่จัด" },
  { key: ContentReportStatus.OPEN, label: "เปิด" },
  { key: ContentReportStatus.REVIEWING, label: "กำลังตรวจ" },
  { key: ContentReportStatus.RESOLVED_REMOVED, label: "ลบแล้ว" },
  { key: ContentReportStatus.RESOLVED_KEPT, label: "ปล่อยไว้" },
];

const REASON_LABEL: Record<ContentReportReason, string> = {
  SPAM: "สแปม",
  INAPPROPRIATE: "ไม่เหมาะสม",
  COUNTERFEIT: "ของปลอม",
  HARASSMENT: "ก้าวร้าว",
  ILLEGAL: "ผิดกฎหมาย",
  MISLEADING: "หลอกลวง",
  OTHER: "อื่น ๆ",
};

const KIND_LABEL: Record<ContentReportKind, string> = {
  SHOP: "ร้าน",
  PRODUCT: "สินค้า",
  REVIEW: "รีวิว",
  STORY: "Story",
  LIVE_COMMENT: "Live comment",
};

interface Props {
  searchParams: Promise<{ status?: string; page?: string }>;
}

export const dynamic = "force-dynamic";

export default async function AdminReportsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const filter = sp.status ?? "ACTIVE";
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const where =
    filter === "ACTIVE"
      ? { status: { in: [ContentReportStatus.OPEN, ContentReportStatus.REVIEWING] } }
      : { status: filter as ContentReportStatus };

  const [reports, totalCount] = await Promise.all([
    db.contentReport.findMany({
      where,
      orderBy: { createdAt: "asc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: {
        reporter: { select: { email: true, name: true } },
      },
    }),
    db.contentReport.count({ where }),
  ]);

  // Resolve target previews — show shop/product/review snippets so the admin
  // can act without leaving the page.
  const shopIds = new Set(reports.map((r) => r.shopId).filter(Boolean) as string[]);
  const productIds = new Set(reports.map((r) => r.productId).filter(Boolean) as string[]);
  const reviewIds = new Set(reports.map((r) => r.reviewId).filter(Boolean) as string[]);
  const [shops, products, reviews] = await Promise.all([
    shopIds.size
      ? db.shop.findMany({ where: { id: { in: [...shopIds] } }, select: { id: true, slug: true, name: true } })
      : Promise.resolve([]),
    productIds.size
      ? db.product.findMany({
          where: { id: { in: [...productIds] } },
          select: { id: true, slug: true, name: true, shop: { select: { slug: true } } },
        })
      : Promise.resolve([]),
    reviewIds.size
      ? db.review.findMany({
          where: { id: { in: [...reviewIds] } },
          select: { id: true, rating: true, comment: true, shopId: true },
        })
      : Promise.resolve([]),
  ]);
  const shopById = new Map(shops.map((s) => [s.id, s]));
  const productById = new Map(products.map((p) => [p.id, p]));
  const reviewById = new Map(reviews.map((r) => [r.id, r]));

  const nowMs = Date.now();
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <PageHeader
        title="รายงานเนื้อหา (Content Reports)"
        description="คิวรายงานจากผู้ใช้ — ทีมงานต้องตัดสินใจภายใน 24 ชม. ตามนโยบาย Zero Tolerance"
      />

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((opt) => {
          const active = (sp.status ?? "ACTIVE") === opt.key;
          return (
            <Link
              key={opt.key}
              href={`/admin/reports?status=${opt.key}`}
              className={`rounded-full border px-3 py-1.5 text-[12px] font-medium ${
                active
                  ? "border-rose-600 bg-rose-600 text-white"
                  : "border-[color:var(--color-border)] bg-white text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              {opt.label}
            </Link>
          );
        })}
      </div>

      {reports.length === 0 ? (
        <div className="rounded-3xl border border-[color:var(--color-border)] bg-white p-10 text-center text-sm text-zinc-500">
          ไม่มีรายงานในคิวนี้
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => {
            const ageMs = nowMs - r.createdAt.getTime();
            const stale = ageMs > SLA_MS && r.status === ContentReportStatus.OPEN;
            const shop = r.shopId ? shopById.get(r.shopId) : undefined;
            const product = r.productId ? productById.get(r.productId) : undefined;
            const review = r.reviewId ? reviewById.get(r.reviewId) : undefined;
            return (
              <div
                key={r.id}
                className={`rounded-3xl border bg-white p-4 ${
                  stale ? "border-rose-600 ring-2 ring-rose-200" : "border-[color:var(--color-border)]"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2 text-[12px]">
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-700">
                    {KIND_LABEL[r.kind]}
                  </span>
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 font-medium text-rose-700">
                    {REASON_LABEL[r.reason]}
                  </span>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-600">
                    {r.status}
                  </span>
                  {stale ? (
                    <span className="rounded-full bg-rose-600 px-2 py-0.5 font-semibold text-white">
                      เกิน SLA 24 ชม.
                    </span>
                  ) : null}
                  <span className="ml-auto text-zinc-500">
                    {new Date(r.createdAt).toLocaleString("th-TH")}
                  </span>
                </div>

                <div className="mt-3 text-sm">
                  <div className="font-semibold text-zinc-900">
                    {shop ? (
                      <Link
                        href={`/s/${shop.slug}`}
                        className="hover:underline"
                      >
                        ร้าน: {shop.name}
                      </Link>
                    ) : null}
                    {product ? (
                      <Link
                        href={`/s/${product.shop?.slug}/${product.slug}`}
                        className="hover:underline"
                      >
                        สินค้า: {product.name}
                      </Link>
                    ) : null}
                    {review ? (
                      <span>รีวิว ⭐{review.rating}</span>
                    ) : null}
                  </div>
                  {review?.comment ? (
                    <p className="mt-1 line-clamp-3 rounded-xl bg-zinc-50 p-2 text-[13px] text-zinc-700">
                      “{review.comment}”
                    </p>
                  ) : null}
                  {r.note ? (
                    <p className="mt-2 text-[13px] text-zinc-600">
                      โน้ตจากผู้รายงาน: <span className="text-zinc-800">{r.note}</span>
                    </p>
                  ) : null}
                  <p className="mt-1 text-[11px] text-zinc-500">
                    ผู้รายงาน: {r.reporter.email}
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <ResolveActions
                    reportId={r.id}
                    currentStatus={r.status}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-2 pt-2">
          {Array.from({ length: totalPages }).map((_, i) => {
            const p = i + 1;
            const active = p === page;
            return (
              <Link
                key={p}
                href={`/admin/reports?status=${sp.status ?? "ACTIVE"}&page=${p}`}
                className={`rounded-full px-3 py-1.5 text-[12px] font-medium ${
                  active
                    ? "bg-rose-600 text-white"
                    : "border border-[color:var(--color-border)] bg-white text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                {p}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
