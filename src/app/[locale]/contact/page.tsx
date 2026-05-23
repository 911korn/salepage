import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { ArrowLeft, Mail, MessageCircle } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { LogoLockup } from "@/components/ui/logo";
import type { Locale } from "@/i18n/routing";

export const metadata: Metadata = {
  title: "Contact · SalePage",
  description: "Get in touch with the SalePage team.",
};

const CONTACTS = [
  {
    icon: Mail,
    label: "ติดต่อทั่วไป · บริการลูกค้า",
    value: "hello@salepage.in.th",
    href: "mailto:hello@salepage.in.th",
  },
  {
    icon: Mail,
    label: "นักพัฒนา · ตอบคำถาม API",
    value: "dev@salepage.in.th",
    href: "mailto:dev@salepage.in.th",
  },
  {
    icon: Mail,
    label: "ทีมขาย · Enterprise / Business",
    value: "sales@salepage.in.th",
    href: "mailto:sales@salepage.in.th",
  },
  {
    icon: Mail,
    label: "สื่อมวลชน / Press",
    value: "press@salepage.in.th",
    href: "mailto:press@salepage.in.th",
  },
];

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="min-h-screen bg-[color:var(--color-soft)]">
      <header className="border-b border-[color:var(--color-border)] bg-white">
        <div className="container-page flex h-16 items-center justify-between">
          <Link href="/" className="inline-flex">
            <LogoLockup />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-[color:var(--color-fg)]"
          >
            <ArrowLeft className="size-4" /> กลับหน้าแรก
          </Link>
        </div>
      </header>

      <main className="container-page py-16 sm:py-20">
        <div className="mx-auto max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--color-brand-50)] px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[color:var(--color-brand-700)]">
            <MessageCircle className="size-3.5" /> ติดต่อเรา
          </span>
          <h1 className="font-display mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            ทักทาย · ถามคำถาม · บอกฟีเจอร์ที่อยากให้มี
          </h1>
          <p className="mt-4 text-balance text-[16px] leading-relaxed text-zinc-600">
            เลือกอีเมลที่ตรงประเภทคำถามของคุณ — ทีมงานตอบภายใน 24 ชั่วโมงในวันทำการ
          </p>

          <ul className="mt-10 space-y-3">
            {CONTACTS.map((c) => {
              const Icon = c.icon;
              return (
                <li key={c.href}>
                  <a
                    href={c.href}
                    className="flex items-center gap-4 rounded-2xl border border-[color:var(--color-border)] bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-[color:var(--color-brand-200)] hover:shadow-md"
                  >
                    <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-700)]">
                      <Icon className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                        {c.label}
                      </p>
                      <p className="font-mono text-[15px] font-medium text-zinc-900">
                        {c.value}
                      </p>
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>

          <div className="mt-10 rounded-2xl border border-dashed border-[color:var(--color-border)] bg-white p-5 text-[14px] leading-relaxed text-zinc-600">
            <p>
              <strong>บริษัท BANPUEN 911</strong>
              <br />
              กรุงเทพมหานคร ประเทศไทย
            </p>
            <p className="mt-3">
              สำหรับคำขอใช้สิทธิ์ตาม PDPA (เข้าถึง / ลบ / ส่งออกข้อมูล) ส่งมาที่ hello@salepage.in.th — ตอบภายใน 30 วันตามที่กฎหมายกำหนด
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
