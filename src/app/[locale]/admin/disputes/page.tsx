import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/admin/page-header";
import { DisputeResolveActions } from "@/components/admin/dispute-resolve-actions";
import { db, DisputeStatus, DisputeReason } from "@/lib/db";

const PAGE_SIZE = 25;
const STALE_AGE_MS = 72 * 60 * 60 * 1000;

const STATUS_OPTIONS: Array<{
  key: DisputeStatus | "ACTIVE";
  label: string;
}> = [
  { key: "ACTIVE", label: "เปิดอยู่" },
  { key: DisputeStatus.OPEN, label: "ยังไม่จัด" },
  { key: DisputeStatus.AWAITING_SHOP_RESPONSE, label: "รอร้านตอบ" },
  { key: DisputeStatus.AWAITING_BUYER_RESPONSE, label: "รอลูกค้าตอบ" },
  { key: DisputeStatus.RESOLVED_REFUND, label: "คืนเงิน" },
  { key: DisputeStatus.RESOLVED_REPLACE, label: "เปลี่ยนของ" },
  { key: DisputeStatus.RESOLVED_NO_ACTION, label: "ยกฟ้อง" },
];

const REASON_LABEL: Record<DisputeReason, string> = {
  NOT_RECEIVED: "ของไม่มาส่ง",
  WRONG_ITEM: "ของผิด",
  DAMAGED: "ของเสียหาย",
  NOT_AS_DESCRIBED: "ของไม่ตรงปก",
  PAYMENT_ISSUE: "ปัญหาเงิน",
  OTHER: "อื่นๆ",
};

const STATUS_BADGE_TONE: Record<DisputeStatus, string> = {
  OPEN: "bg-rose-100 text-rose-700",
  AWAITING_SHOP_RESPONSE: "bg-amber-100 text-amber-700",
  AWAITING_BUYER_RESPONSE: "bg-zinc-100 text-zinc-700",
  RESOLVED_REFUND: "bg-rose-50 text-rose-600",
  RESOLVED_REPLACE: "bg-amber-50 text-amber-600",
  RESOLVED_NO_ACTION: "bg-zinc-50 text-zinc-500",
  CLOSED: "bg-zinc-50 text-zinc-500",
};

interface Props {
  searchParams: Promise<{ status?: string; page?: string }>;
}

/**
 * Non-React helper so `Date.now()` lives outside any component body. React
 * 19's `react-hooks/purity` rule forbids impure calls during render; lifting
 * the call into a plain function with a return value keeps the linter happy
 * while still computing fresh staleness for every request.
 */
function pickStaleDisputeIds<
  T extends { id: string; status: DisputeStatus; createdAt: Date },
>(disputes: T[]): Set<string> {
  const nowMs = Date.now();
  const stale = new Set<string>();
  for (const d of disputes) {
    const isTerminal =
      d.status === DisputeStatus.RESOLVED_REFUND ||
      d.status === DisputeStatus.RESOLVED_REPLACE ||
      d.status === DisputeStatus.RESOLVED_NO_ACTION ||
      d.status === DisputeStatus.CLOSED;
    if (isTerminal) continue;
    if (nowMs - d.createdAt.getTime() > STALE_AGE_MS) stale.add(d.id);
  }
  return stale;
}

export default async function AdminDisputesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const filter = sp.status ?? "ACTIVE";
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  // "ACTIVE" is the default landing view — combines all not-yet-resolved
  // dispute statuses so admins see their queue at a glance.
  const where =
    filter === "ACTIVE"
      ? {
          status: {
            in: [
              DisputeStatus.OPEN,
              DisputeStatus.AWAITING_SHOP_RESPONSE,
              DisputeStatus.AWAITING_BUYER_RESPONSE,
            ],
          },
        }
      : Object.values(DisputeStatus).includes(filter as DisputeStatus)
        ? { status: filter as DisputeStatus }
        : { status: DisputeStatus.OPEN };

  const [disputes, total] = await Promise.all([
    db.dispute.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        reason: true,
        description: true,
        evidence: true,
        status: true,
        resolution: true,
        resolvedAt: true,
        createdAt: true,
        updatedAt: true,
        openedByName: true,
        openedByPhone: true,
        order: {
          select: {
            id: true,
            publicToken: true,
            totalSatang: true,
            status: true,
            createdAt: true,
            shop: {
              select: {
                id: true,
                slug: true,
                name: true,
                logoText: true,
                themeColor: true,
                trustScore: true,
              },
            },
          },
        },
      },
    }),
    db.dispute.count({ where }),
  ]);

  const staleIds = pickStaleDisputeIds(disputes);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        title="Disputes"
        description={`${total.toLocaleString()} dispute(s) · 72-hour SLA before auto-resolve`}
      />

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((opt) => {
          const active = opt.key === filter;
          return (
            <Link
              key={opt.key}
              href={{
                pathname: "/admin/disputes",
                query: { status: opt.key },
              }}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                active
                  ? "border-rose-300 bg-rose-50 text-rose-700"
                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              {opt.label}
            </Link>
          );
        })}
      </div>

      {disputes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-10 text-center text-sm text-zinc-500">
          ไม่มีข้อพิพาทในกลุ่มนี้
        </div>
      ) : (
        <div className="space-y-3">
          {disputes.map((d) => {
            const evidence = parseEvidence(d.evidence);
            const isTerminal =
              d.status === DisputeStatus.RESOLVED_REFUND ||
              d.status === DisputeStatus.RESOLVED_REPLACE ||
              d.status === DisputeStatus.RESOLVED_NO_ACTION ||
              d.status === DisputeStatus.CLOSED;
            const isStale = staleIds.has(d.id);

            return (
              <div
                key={d.id}
                className="overflow-hidden rounded-2xl border border-zinc-200 bg-white"
              >
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex size-9 items-center justify-center rounded-lg text-sm font-bold text-white"
                      style={{ backgroundColor: d.order.shop.themeColor }}
                    >
                      {d.order.shop.logoText ?? d.order.shop.name.slice(0, 1)}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/admin/shops/${d.order.shop.id}`}
                          className="text-sm font-semibold text-zinc-900 hover:underline"
                        >
                          {d.order.shop.name}
                        </Link>
                        <span className="text-xs text-zinc-500">
                          @{d.order.shop.slug}
                        </span>
                        <Badge>Trust {d.order.shop.trustScore}</Badge>
                        <Badge>{REASON_LABEL[d.reason]}</Badge>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_BADGE_TONE[d.status]}`}
                        >
                          {d.status.replace(/_/g, " ")}
                        </span>
                        {isStale ? (
                          <span className="inline-flex items-center rounded-full bg-rose-200 px-2 py-0.5 text-[11px] font-bold text-rose-900">
                            ⏰ เกิน 72 ชม.
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-500">
                        {d.openedByName} ·{" "}
                        {d.openedByPhone ?? "(ไม่มีเบอร์)"}
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-xs text-zinc-500">
                    <div>เปิดเมื่อ {formatDate(d.createdAt)}</div>
                    <div>
                      Order #{d.order.publicToken.slice(0, 8)} ·{" "}
                      {(d.order.totalSatang / 100).toLocaleString()} ฿
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-[1fr_320px]">
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-zinc-500">
                        คำอธิบายจากลูกค้า
                      </div>
                      <div className="mt-1 whitespace-pre-wrap rounded-xl bg-zinc-50 p-3 text-sm text-zinc-800">
                        {d.description}
                      </div>
                    </div>
                    {d.resolution ? (
                      <div>
                        <div className="text-xs uppercase tracking-wide text-zinc-500">
                          คำตัดสิน
                        </div>
                        <div className="mt-1 whitespace-pre-wrap rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                          {d.resolution}
                          {d.resolvedAt ? (
                            <div className="mt-1 text-[11px] text-emerald-700">
                              ปิดเมื่อ {formatDate(d.resolvedAt)}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-zinc-500">
                      หลักฐาน ({evidence.length})
                    </div>
                    <div className="mt-1 grid grid-cols-3 gap-2">
                      {evidence.length === 0 ? (
                        <div className="col-span-3 flex h-24 items-center justify-center rounded-lg border border-dashed border-zinc-200 bg-zinc-50 text-xs text-zinc-400">
                          ไม่มีหลักฐาน
                        </div>
                      ) : (
                        evidence.map((e, idx) =>
                          e.kind === "image" ? (
                            <a
                              key={idx}
                              href={e.value}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block overflow-hidden rounded-lg border border-zinc-200 bg-white"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={e.value}
                                alt={`evidence ${idx + 1}`}
                                className="h-24 w-full object-cover transition hover:scale-105"
                              />
                            </a>
                          ) : (
                            <div
                              key={idx}
                              className="col-span-3 rounded-lg bg-zinc-100 p-2 text-xs text-zinc-700"
                            >
                              {e.value}
                            </div>
                          ),
                        )
                      )}
                    </div>
                  </div>
                </div>

                {/* Action bar — hide for terminal states. */}
                {!isTerminal ? (
                  <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-3">
                    <DisputeResolveActions
                      disputeId={d.id}
                      shopName={d.order.shop.name}
                      orderTokenShort={d.order.publicToken.slice(0, 8)}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-2 pt-4">
          {page > 1 ? (
            <Link
              href={{
                pathname: "/admin/disputes",
                query: { status: filter, page: String(page - 1) },
              }}
              className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50"
            >
              ‹ Prev
            </Link>
          ) : null}
          <span className="text-sm text-zinc-500">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={{
                pathname: "/admin/disputes",
                query: { status: filter, page: String(page + 1) },
              }}
              className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50"
            >
              Next ›
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function formatDate(d: Date): string {
  return d.toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function parseEvidence(raw: unknown): Array<{ kind: string; value: string }> {
  // Stored as JSON in Prisma; we soft-coerce to be defensive.
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((e) => {
    if (
      typeof e === "object" &&
      e !== null &&
      "kind" in e &&
      "value" in e &&
      typeof (e as { value: unknown }).value === "string"
    ) {
      return [
        {
          kind: String((e as { kind: unknown }).kind),
          value: (e as { value: string }).value,
        },
      ];
    }
    return [];
  });
}
