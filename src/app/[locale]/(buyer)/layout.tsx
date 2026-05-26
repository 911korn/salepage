import { setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { BuyerNav } from "@/components/buyer/buyer-nav";
import { Footer } from "@/components/landing/footer";

/**
 * Buyer-surface layout. Renders the persistent `<BuyerNav>` chrome above
 * every page in the `(buyer)` route group (/shops, /search, /cart,
 * /me/*). Logged-out users still get the nav — the avatar slot becomes
 * a "เข้าสู่ระบบ" CTA.
 */
export default async function BuyerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  // Layout typegen narrows this to plain `string`, not `Locale`. Cast at
  // the use site since next-intl's setRequestLocale validates.
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  let user: React.ComponentProps<typeof BuyerNav>["user"] = null;
  if (session?.user?.id) {
    const row = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        name: true,
        email: true,
        image: true,
        _count: { select: { shops: true } },
      },
    });
    if (row) {
      user = {
        name: row.name,
        email: row.email,
        image: row.image,
        hasShops: row._count.shops > 0,
      };
    }
  }

  return (
    <>
      <BuyerNav user={user} />
      <main className="min-h-[60vh] bg-[color:var(--color-soft)]/40">
        {children}
      </main>
      <Footer />
    </>
  );
}
