import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { PayoutActions } from "@/components/admin/payout-actions";
import { db, AffiliatePayoutStatus } from "@/lib/db";

const PAGE_SIZE = 25;

const STATUS_OPTIONS: Array<{
  key: AffiliatePayoutStatus | "ACTIVE";
  label: string;
}> = [
  { key: "ACTIVE", label: "รอจ่าย" },
  { key: AffiliatePayoutStatus.REQUESTED, label: "ขอใหม่" },
  { key: AffiliatePayoutStatus.APPROVED, label: "อนุมัติแล้ว" },
  { key: AffiliatePayoutStatus.PAID, label: "โอนแล้ว" },
  { key: AffiliatePayoutStatus.REJECTED, label: "ปฏิเสธ" },
  { key: AffiliatePayoutStatus.CANCELLED, label: "ยกเลิก" },
];

const STATUS_BADGE_TONE: Record<AffiliatePayoutStatus, string> = {
  REQUESTED: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  PAID: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-rose-50 text-rose-600",
  CANCELLED: "bg-zinc-50 text-zinc-500",
};

interface Props {
  searchParams: Promise<{ status?: string; page?: string }>;
}

export default async function AdminPayoutsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const filter = sp.status ?? "ACTIVE";
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  // "ACTIVE" = REQUESTED + APPROVED (anything that admin still owes action on)
  const where =
    filter === "ACTIVE"
      ? {
          status: {
            in: [
              AffiliatePayoutStatus.REQUESTED,
              AffiliatePayoutStatus.APPROVED,
            ],
          },
        }
      : Object.values(AffiliatePayoutStatus).includes(
            filter as AffiliatePayoutStatus,
          )
        ? { status: filter as AffiliatePayoutStatus }
        : { status: AffiliatePayoutStatus.REQUESTED };

  const [payouts, total, pendingSum] = await Promise.all([
    db.affiliatePayout.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        amountSatang: true,
        promptpayId: true,
        status: true,
        providerRef: true,
        rejectedReason: true,
        reviewedAt: true,
        paidAt: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
          },
        },
      },
    }),
    db.affiliatePayout.count({ where }),
    // Total outstanding sum across all active payouts — useful for "we owe
    // affiliates X" metric in the page header.
    db.affiliatePayout.aggregate({
      where: {
        status: {
          in: [
            AffiliatePayoutStatus.REQUESTED,
            AffiliatePayoutStatus.APPROVED,
          ],
        },
      },
      _sum: { amountSatang: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const outstandingBaht =
    (pendingSum._sum?.amountSatang ?? 0) / 100;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        title="Affiliate payouts"
        description={`${total.toLocaleString()} requests · ${outstandingBaht.toLocaleString()} ฿ outstanding`}
      />

      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((opt) => {
          const active = opt.key === filter;
          return (
            <Link
              key={opt.key}
              href={{
                pathname: "/admin/payouts",
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

      {payouts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-10 text-center text-sm text-zinc-500">
          ไม่มีคำขอเบิกในกลุ่มนี้
        </div>
      ) : (
        <div className="space-y-3">
          {payouts.map((p) => (
            <div
              key={p.id}
              className="overflow-hidden rounded-2xl border border-zinc-200 bg-white"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center overflow-hidden rounded-full bg-zinc-200 text-sm font-bold text-zinc-700">
                    {p.user.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.user.image}
                        alt={p.user.name ?? p.user.email}
                        className="size-full object-cover"
                      />
                    ) : (
                      (p.user.name ?? p.user.email).slice(0, 1).toUpperCase()
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/users/${p.user.id}`}
                        className="text-sm font-semibold text-zinc-900 hover:underline"
                      >
                        {p.user.name ?? p.user.email}
                      </Link>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_BADGE_TONE[p.status]}`}
                      >
                        {p.status}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-500">
                      {p.user.email}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-zinc-900">
                    {(p.amountSatang / 100).toLocaleString()} ฿
                  </div>
                  <div className="text-xs text-zinc-500">
                    PromptPay {p.promptpayId}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 px-4 py-3 text-sm sm:grid-cols-3">
                <Field
                  label="ขอเมื่อ"
                  value={p.createdAt.toLocaleString("th-TH", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                />
                <Field
                  label="ตรวจสอบเมื่อ"
                  value={
                    p.reviewedAt
                      ? p.reviewedAt.toLocaleString("th-TH", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "—"
                  }
                />
                <Field
                  label="โอนเมื่อ"
                  value={
                    p.paidAt
                      ? p.paidAt.toLocaleString("th-TH", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "—"
                  }
                />
                {p.providerRef ? (
                  <Field
                    label="Transaction ref"
                    value={p.providerRef}
                  />
                ) : null}
                {p.rejectedReason ? (
                  <div className="sm:col-span-3">
                    <div className="text-xs uppercase tracking-wide text-zinc-500">
                      เหตุผลปฏิเสธ
                    </div>
                    <div className="mt-1 rounded-lg bg-rose-50 p-2 text-sm text-rose-800">
                      {p.rejectedReason}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-3">
                <PayoutActions
                  payoutId={p.id}
                  status={p.status}
                  amountSatang={p.amountSatang}
                  promptpayId={p.promptpayId}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-2 pt-4">
          {page > 1 ? (
            <Link
              href={{
                pathname: "/admin/payouts",
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
                pathname: "/admin/payouts",
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
