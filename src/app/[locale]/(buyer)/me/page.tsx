import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { Package, Store, Heart, MapPin, LogOut, ShieldCheck } from "lucide-react";
import { auth, signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "บัญชีของฉัน · SalePage",
};

interface PageProps {
  params: Promise<{ locale: Locale }>;
}

export default async function MePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/me")}`);
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      image: true,
      lineUserId: true,
      _count: { select: { shops: true } },
    },
  });
  if (!user) {
    redirect("/signin");
  }

  return (
    <div className="container-page max-w-2xl py-8">
      <h1 className="mb-4 text-2xl font-bold">บัญชีของฉัน</h1>

      <section className="flex items-center gap-4 rounded-3xl border border-[color:var(--color-border)] bg-white p-5">
        <div className="h-16 w-16 overflow-hidden rounded-2xl bg-[color:var(--color-soft)]">
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.image} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xl font-bold text-zinc-500">
              {(user.name ?? user.email)[0]?.toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold">
            {user.name ?? user.email.split("@")[0]}
          </p>
          <p className="truncate text-sm text-zinc-500">{user.email}</p>
          {user.lineUserId ? (
            <p className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
              <ShieldCheck size={10} /> เชื่อมต่อกับ LINE แล้ว
            </p>
          ) : null}
        </div>
      </section>

      <section className="mt-4 overflow-hidden rounded-3xl border border-[color:var(--color-border)] bg-white">
        <MenuRow href="/me/orders" icon={<Package size={18} />} label="คำสั่งซื้อของฉัน" />
        <MenuRow
          href={user._count.shops > 0 ? "/dashboard" : "/dashboard"}
          icon={<Store size={18} />}
          label={user._count.shops > 0 ? `จัดการร้านค้า (${user._count.shops})` : "เริ่มขายบน SalePage"}
        />
        <MenuRow href="/shops" icon={<Heart size={18} />} label="ร้านค้าทั้งหมด" />
        <MenuRow href="/cart" icon={<MapPin size={18} />} label="ตะกร้าสินค้า" last />
      </section>

      <form
        className="mt-4"
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 py-3 text-sm font-semibold text-rose-700 hover:bg-rose-100"
        >
          <LogOut size={16} />
          ออกจากระบบ
        </button>
      </form>
    </div>
  );
}

function MenuRow({
  href,
  icon,
  label,
  last,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  last?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-5 py-3.5 hover:bg-[color:var(--color-soft)]/60 ${
        last ? "" : "border-b border-[color:var(--color-border)]"
      }`}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--color-soft)] text-zinc-700">
        {icon}
      </div>
      <span className="flex-1 text-sm">{label}</span>
      <span className="text-zinc-400">›</span>
    </Link>
  );
}
