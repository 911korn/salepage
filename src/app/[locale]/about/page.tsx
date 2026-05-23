import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { LogoLockup } from "@/components/ui/logo";
import type { Locale } from "@/i18n/routing";

export const metadata: Metadata = {
  title: "About · SalePage",
  description:
    "SalePage is a Thai e-commerce platform built by BANPUEN 911 — direct PromptPay payments, AI slip verification, no per-order fee.",
};

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-[color:var(--color-border)]">
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

      <main className="container-page py-16 sm:py-24">
        <article className="mx-auto max-w-3xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--color-brand-50)] px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[color:var(--color-brand-700)]">
            <Sparkles className="size-3.5" /> เกี่ยวกับเรา
          </span>
          <h1 className="font-display mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            สร้างเครื่องมือให้ร้านไทยขายของได้ง่ายขึ้น
          </h1>

          <div className="prose prose-zinc mt-8 max-w-none">
            <p className="text-[17px] leading-relaxed text-zinc-700">
              <strong>SalePage</strong> เกิดจากความเชื่อง่ายๆ ว่าคนไทยควรเปิดร้านออนไลน์ได้ในไม่กี่นาที โดยไม่ต้องเสียค่าธรรมเนียมต่อออเดอร์ ไม่ต้องเขียนโค้ด และไม่ต้องผ่านตัวกลางทางการเงิน
            </p>

            <h2 className="font-display mt-10 text-2xl font-bold tracking-tight">
              ผู้สร้าง
            </h2>
            <p>
              พัฒนาและให้บริการโดย <strong>BANPUEN 911</strong>{" "}
              ทีมเทคโนโลยีไทยที่อยู่เบื้องหลังผลิตภัณฑ์ SaaS
              และเครื่องมือสำหรับธุรกิจออนไลน์ในประเทศไทยหลายตัว
            </p>
            <ul className="text-[15px] text-zinc-700">
              <li>สำนักงาน: กรุงเทพมหานคร ประเทศไทย</li>
              <li>ติดต่อทั่วไป: hello@salepage.in.th</li>
              <li>ติดต่อนักพัฒนา: dev@salepage.in.th</li>
              <li>ติดต่อสื่อ / press: press@salepage.in.th</li>
            </ul>

            <h2 className="font-display mt-10 text-2xl font-bold tracking-tight">
              สิ่งที่เราต่างจากค่ายอื่น
            </h2>
            <ul className="text-[15px] leading-relaxed text-zinc-700">
              <li>
                <strong>ไม่หักค่าธรรมเนียมต่อออเดอร์</strong> — ลูกค้าโอนเงินตรงเข้าบัญชี PromptPay ของร้าน เราไม่เป็นตัวกลางทางการเงิน
              </li>
              <li>
                <strong>AI ตรวจสลิปอัตโนมัติ</strong> — เช็คยอด ผู้รับ และเวลา ภายในไม่กี่วินาที จับสลิปปลอมได้แม่นยำ
              </li>
              <li>
                <strong>API-first</strong> — ทุกฟีเจอร์เปิดเป็น REST endpoint ทำให้ทั้งเว็บและแอปมือถือใช้ระบบเดียวกันได้
              </li>
              <li>
                <strong>เปิดร้านได้ใน 30 วินาที</strong> — 3 ขั้นตอนสั้นๆ ก็พร้อมขาย — ไม่ต้องเขียนโค้ด ไม่ต้องดีไซน์เอง
              </li>
            </ul>

            <h2 className="font-display mt-10 text-2xl font-bold tracking-tight">
              คุณค่าที่เรายึด
            </h2>
            <p>
              ทุกฟีเจอร์ของ SalePage ผ่านการคิดด้วยกฎ 3 ข้อ —{" "}
              <strong>ดีกว่า</strong>, <strong>เท่กว่า</strong>,{" "}
              <strong>ง่ายกว่า</strong> ทุกระบบ SalePage แบบเดิมที่เคยใช้
            </p>

            <p className="mt-10 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-soft)] p-5 text-[14px] text-zinc-700">
              อยากร่วมงานกับเรา? เปิดร้านเทสตัวเองที่{" "}
              <Link href="/" className="font-medium text-[color:var(--color-brand-700)] hover:underline">
                salepage.in.th
              </Link>{" "}
              หรือทักไปคุยที่ hello@salepage.in.th
            </p>
          </div>
        </article>
      </main>
    </div>
  );
}
