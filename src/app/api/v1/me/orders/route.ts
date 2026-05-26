import { ok, fail } from "@/lib/api";
import { resolveSession } from "@/lib/api-auth";
import {
  ALLOWED_STATUSES,
  runMeOrdersQuery,
  type AllowedStatus,
} from "@/lib/me-orders-shared";

/**
 * GET /api/v1/me/orders?status=<STATUS>&cursor=<orderId>
 *
 * Thin HTTP wrapper around `runMeOrdersQuery` so this route and the web
 * `/me/orders` server component share one query path (911korn 2026-05-27
 * "ทำให้มันใช้ api อันเดียวกัน").
 */
export async function GET(request: Request) {
  const session = await resolveSession(request);
  if (!session.ok) return session.response;

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const statusParam = url.searchParams.get("status");
  if (
    statusParam &&
    !ALLOWED_STATUSES.includes(statusParam as AllowedStatus)
  ) {
    return fail("invalid_status", "Unknown order status", 400);
  }

  const result = await runMeOrdersQuery({
    userId: session.user.id,
    status: (statusParam as AllowedStatus | null) ?? undefined,
    cursor,
  });
  return ok(result);
}
