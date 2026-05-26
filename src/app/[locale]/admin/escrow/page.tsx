import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { EscrowActions } from "@/components/admin/escrow-actions";
import { db, EscrowStatus } from "@/lib/db";

const PAGE_SIZE = 25;

const STATUS_OPTIONS: Array<{
  key: EscrowStatus | "ACTIVE";
  label: string;
}> = [
  { key: "ACTIVE", label: "ค้างอยู่" },
  { key: EscrowStatus.HELD, label: "ถือเงิน" },
  { key: EscrowStatus.DISPUTED, label: "พิพาท" },
  { key: EscrowStatus.RELEASED, label: "ปล่อยแล้ว" },
  { key: EscrowStatus.REFUNDED, label: "คืนแล้ว" },
];

const STATUS_BADGE_TONE: Record<EscrowStatus, string> = {
  HELD: "bg-amber-100 text-amber-700",
  DISPUTED: "bg-rose-100 text-rose-700",
  RELEASED: "bg-emerald-50 text-emerald-700",
  REFUNDED: "bg-zinc-50 text-zinc-500",
};

interface Props {
  searchParams: Promise<{ status?: string; page?: string }>;
}

/**
 * Non-React helper so `Date.now()` lives outside the component body. React
 * 19's `react-hooks/purity` rule forbids impure calls during render; lifting
 * the call into a plain function keeps the linter happy while still freshly
 * recomputing the overdue set on every request.
 */
function pickOverdueHoldIds<
  T extends { id: string; status: EscrowStatus; scheduledReleaseAt: Date | null },
>(holds: T[]): Set<string> {
  const nowMs = Date.now();
  const overdue = new Set<string>();
  for (const h of holds) {
    if (
      h.status === EscrowStatus.HELD &&
      h.scheduledReleaseAt !== null &&
      h.scheduledReleaseAt.getTime() < nowMs
    ) {
      overdue.add(h.id);
    }
  }
  return overdue;
}

/**
 * /admin/escrow — Protected Pay queue.
 *
 * Default view (`ACTIVE`) is HELD + DISPUTED rows so admins see only the
 * stuff that might need their attention. We surface "outstanding" totals
 * for HELD (money queued to ship to shops) and DISPUTED (money frozen by
 * an open dispute) so the operator can scan the platform's exposure at
 * a glance.
 */
export default async function AdminEscrowPage({ searchParams }: Props) {
  const sp = await searchParams;
  const filter = sp.status ?? "ACTIVE";
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const where =
    filter === "ACTIVE"
      ? {
          status: { in: [EscrowStatus.HELD, EscrowStatus.DISPUTED] },
        }
      : Object.values(EscrowStatus).includes(filter as EscrowStatus)
        ? { status: filter as EscrowStatus }
        : { status: EscrowStatus.HELD };

  const [holds, total, heldSum, disputedSum] = await Promise.all([
    db.escrowHold.findMany({
      where,
      orderBy: [{ status: "asc" }, { heldAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        status: true,
        amountSatang: true,
        feeSatang: true,
        scheduledReleaseAt: true,
        heldAt: true,
        releasedAt: true,
        refundedAt: true,
        closeReason: true,
        providerRef: true,
        order: {
          select: {
            id: true,
            publicToken: true,
            customerName: true,
            customerPhone: true,
            customerEmail: true,
            status: true,
            shop: { select: { id: true, slug: true, name: true } },
          },
        },
      },
    }),
    db.escrowHold.count({ where }),
    db.escrowHold.aggregate({
      where: { status: EscrowStatus.HELD },
      _sum: { amountSatang: true },
    }),
    db.escrowHold.aggregate({
      where: { status: EscrowStatus.DISPUTED },
      _sum: { amountSatang: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const heldBaht = (heldSum._sum?.amountSatang ?? 0) / 100;
  const disputedBaht = (disputedSum._sum?.amountSatang ?? 0) / 100;
  const overdueIds = pickOverdueHoldIds(holds);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        title="Protected Pay (Escrow)"
        description={`${total.toLocaleString()} holds in view · HELD ${heldBaht.toLocaleString()} ฿ · DISPUTED ${disputedBaht.toLocaleString()} ฿`}
      />

      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((opt) => {
          const active = opt.key === filter;
          return (
            <Link
              key={opt.key}
              href={{
                pathname: "/admin/escrow",
                query: { status: opt.key },
              }}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                active
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              {opt.label}
            </Link>
          );
        })}
      </div>

      {holds.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-10 text-center text-sm text-zinc-500">
          ไม่มี escrow hold ในกลุ่มนี้
        </div>
      ) : (
        <div className="space-y-3">
          {holds.map((h) => {
            const overdue = overdueIds.has(h.id);
            return (
              <div
                key={h.id}
                className={`overflow-hidden rounded-2xl border bg-white ${
                  overdue ? "border-amber-300" : "border-zinc-200"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/shops/${h.order.shop.id}`}
                        className="text-sm font-semibold text-zinc-900 hover:underline"
                      >
                        {h.order.shop.name}
                      </Link>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_BADGE_TONE[h.status]}`}
                      >
                        {h.status}
                      </span>
                      {overdue ? (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                          เกินกำหนด — auto-release ค้าง
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-500">
                      Order #{h.order.publicToken.slice(0, 12)} · {h.order.customerName}
                      {h.order.customerPhone ? ` · ${h.order.customerPhone}` : ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-zinc-900">
                      {(h.amountSatang / 100).toLocaleString()} ฿
                    </div>
                    <div className="text-xs text-zinc-500">
                      fee {(h.feeSatang / 100).toLocaleString()} ฿
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 px-4 py-3 text-sm sm:grid-cols-3">
                  <Field
                    label="เริ่มถือ"
                    value={h.heldAt.toLocaleString("th-TH", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  />
                  <Field
                    label="กำหนดปล่อย"
                    value={
                      h.scheduledReleaseAt
                        ? h.scheduledReleaseAt.toLocaleString("th-TH", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : "— (รอ DELIVERED)"
                    }
                  />
                  <Field
                    label="Order status"
                    value={h.order.status}
                  />
                  {h.releasedAt ? (
                    <Field
                      label="ปล่อยเมื่อ"
                      value={h.releasedAt.toLocaleString("th-TH", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    />
                  ) : null}
                  {h.refundedAt ? (
                    <Field
                      label="คืนเมื่อ"
                      value={h.refundedAt.toLocaleString("th-TH", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    />
                  ) : null}
                  {h.closeReason ? (
                    <Field label="สาเหตุ" value={h.closeReason} />
                  ) : null}
                  {h.providerRef ? (
                    <Field label="Provider ref" value={h.providerRef} />
                  ) : null}
                </div>

                <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-3">
                  <EscrowActions
                    holdId={h.id}
                    status={h.status}
                    amountSatang={h.amountSatang}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-2 pt-4">
          {page > 1 ? (
            <Link
              href={{
                pathname: "/admin/escrow",
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
                pathname: "/admin/escrow",
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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-medium text-zinc-900">{value}</div>
    </div>
  );
}
