import { ok } from "@/lib/api";
import { requireAdminApi } from "@/lib/admin";
import { db, KycStatus } from "@/lib/db";

/**
 * GET /api/v1/admin/kyc?status=PENDING&cursor=<shopId>
 *
 * Admin-only paginated list of KYC submissions for review. Default filter is
 * PENDING because that's the active queue, but admins can pass any status to
 * audit historic decisions or look up an EXPIRED shop.
 *
 * Returns full submission payload including doc URLs — admin UI displays
 * these inline via Vercel Blob's public CDN.
 */
const PAGE_SIZE = 25;

export async function GET(request: Request) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const cursor = searchParams.get("cursor");

  const status = (statusParam && (statusParam.toUpperCase() as keyof typeof KycStatus)) || "PENDING";
  if (!(status in KycStatus)) {
    // Fallback to PENDING for any unknown filter rather than 400 — admins
    // typing the URL by hand shouldn't crash the dashboard.
  }

  const submissions = await db.shop.findMany({
    where: { kycStatus: KycStatus[status as keyof typeof KycStatus] ?? KycStatus.PENDING },
    take: PAGE_SIZE + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    orderBy: { kycSubmittedAt: "desc" },
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
      owner: {
        select: { id: true, email: true, name: true },
      },
    },
  });

  const hasMore = submissions.length > PAGE_SIZE;
  const items = hasMore ? submissions.slice(0, PAGE_SIZE) : submissions;
  const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

  return ok({ submissions: items, nextCursor });
}
