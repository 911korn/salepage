import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/admin/page-header";
import { KycReviewActions } from "@/components/admin/kyc-review-actions";
import { db, KycStatus } from "@/lib/db";

const PAGE_SIZE = 25;

const STATUS_OPTIONS: Array<{ key: KycStatus; label: string }> = [
  { key: KycStatus.PENDING, label: "รอตรวจ" },
  { key: KycStatus.VERIFIED, label: "ยืนยันแล้ว" },
  { key: KycStatus.REJECTED, label: "ปฏิเสธ" },
  { key: KycStatus.EXPIRED, label: "หมดอายุ" },
];

const DOC_TYPE_LABEL: Record<string, string> = {
  NID: "บัตรประชาชน",
  PASSPORT: "พาสปอร์ต",
  COMPANY_REG: "ทะเบียนบริษัท",
};

interface Props {
  searchParams: Promise<{ status?: string; page?: string }>;
}

export default async function AdminKycPage({ searchParams }: Props) {
  const sp = await searchParams;
  const status =
    sp.status && Object.values(KycStatus).includes(sp.status as KycStatus)
      ? (sp.status as KycStatus)
      : KycStatus.PENDING;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const [submissions, total] = await Promise.all([
    db.shop.findMany({
      where: { kycStatus: status },
      orderBy: { kycSubmittedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        slug: true,
        name: true,
        themeColor: true,
        logoText: true,
        logoUrl: true,
        trustScore: true,
        kycStatus: true,
        kycDocType: true,
        kycLegalName: true,
        kycIdLast4: true,
        kycDocFrontUrl: true,
        kycDocBackUrl: true,
        kycSelfieUrl: true,
        kycSubmittedAt: true,
        kycReviewedAt: true,
        kycRejectedReason: true,
        owner: { select: { id: true, email: true, name: true } },
      },
    }),
    db.shop.count({ where: { kycStatus: status } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        title="KYC review"
        description={`${total.toLocaleString()} ${status.toLowerCase()} submission(s)`}
      />

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((opt) => {
          const active = opt.key === status;
          return (
            <Link
              key={opt.key}
              href={{ pathname: "/admin/kyc", query: { status: opt.key } }}
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

      {submissions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-10 text-center text-sm text-zinc-500">
          ไม่มีรายการที่ตรงกับสถานะนี้
        </div>
      ) : (
        <div className="space-y-3">
          {submissions.map((s) => (
            <div
              key={s.id}
              className="overflow-hidden rounded-2xl border border-zinc-200 bg-white"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div
                    className="flex size-9 items-center justify-center rounded-lg text-sm font-bold text-white"
                    style={{ backgroundColor: s.themeColor }}
                  >
                    {s.logoText ?? s.name.slice(0, 1)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/shops/${s.id}`}
                        className="text-sm font-semibold text-zinc-900 hover:underline"
                      >
                        {s.name}
                      </Link>
                      <span className="text-xs text-zinc-500">
                        @{s.slug}
                      </span>
                      <Badge>{s.kycDocType ? DOC_TYPE_LABEL[s.kycDocType] : "—"}</Badge>
                      <Badge>Trust {s.trustScore}</Badge>
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-500">
                      {s.owner.name ?? "—"} · {s.owner.email}
                    </div>
                  </div>
                </div>
                <div className="text-right text-xs text-zinc-500">
                  {s.kycSubmittedAt
                    ? new Date(s.kycSubmittedAt).toLocaleString("th-TH", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "—"}
                </div>
              </div>

              {/* Body */}
              <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-[2fr_1fr]">
                <div className="grid grid-cols-3 gap-3">
                  <DocPreview label="เอกสารด้านหน้า" url={s.kycDocFrontUrl} />
                  <DocPreview label="เอกสารด้านหลัง" url={s.kycDocBackUrl} />
                  <DocPreview label="เซลฟี่ถือเอกสาร" url={s.kycSelfieUrl} />
                </div>

                <div className="space-y-3 rounded-xl bg-zinc-50 p-3 text-sm">
                  <Field label="ชื่อตามเอกสาร" value={s.kycLegalName ?? "—"} />
                  <Field
                    label="เลขท้าย 4 หลัก"
                    value={s.kycIdLast4 ?? "—"}
                  />
                  {s.kycRejectedReason ? (
                    <Field
                      label="เหตุผลปฏิเสธก่อนหน้า"
                      value={s.kycRejectedReason}
                    />
                  ) : null}
                  {s.kycReviewedAt ? (
                    <Field
                      label="ตรวจสอบเมื่อ"
                      value={new Date(s.kycReviewedAt).toLocaleString("th-TH")}
                    />
                  ) : null}
                </div>
              </div>

              {/* Action bar — only render approve/reject for PENDING. */}
              {status === KycStatus.PENDING ? (
                <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-3">
                  <KycReviewActions shopId={s.id} shopName={s.name} />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-2 pt-4">
          {page > 1 ? (
            <Link
              href={{
                pathname: "/admin/kyc",
                query: { status, page: String(page - 1) },
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
                pathname: "/admin/kyc",
                query: { status, page: String(page + 1) },
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

function DocPreview({
  label,
  url,
}: {
  label: string;
  url: string | null;
}) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-zinc-500">{label}</div>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="block overflow-hidden rounded-lg border border-zinc-200 bg-white"
        >
          {/* Plain <img> on purpose — Next/Image's loader rejects arbitrary
              CDN domains, and Vercel Blob URLs are stable enough. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={label}
            className="h-40 w-full object-cover transition hover:scale-105"
          />
        </a>
      ) : (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-zinc-200 bg-zinc-50 text-xs text-zinc-400">
          ไม่มีเอกสาร
        </div>
      )}
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
