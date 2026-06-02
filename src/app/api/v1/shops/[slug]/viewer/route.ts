import { ok } from "@/lib/api";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const session = await auth();
  if (!session?.user?.id) {
    return ok({ isOwner: false }, { headers: NO_STORE });
  }
  const shop = await db.shop.findUnique({
    where: { slug },
    select: { ownerId: true },
  });
  return ok(
    { isOwner: Boolean(shop && shop.ownerId === session.user.id) },
    { headers: NO_STORE },
  );
}
