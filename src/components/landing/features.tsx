"use client";

import {
  Banknote,
  Bot,
  Clock,
  Layers,
  Link2,
  type LucideIcon,
  QrCode,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Zap,
} from "lucide-react";
import { motion } from "framer-motion";

interface Feature {
  icon: LucideIcon;
  title: string;
  desc: string;
}

const FEATURES: Feature[] = [
  {
    icon: Clock,
    title: "เปิดร้านใน 30 วินาที",
    desc: "3 ขั้นตอน ก็พร้อมขาย — ไม่ต้องเขียนโค้ด ไม่ต้องดีไซน์ ระบบช่วยจัดให้สวยอัตโนมัติ",
  },
  {
    icon: QrCode,
    title: "PromptPay QR อัตโนมัติ",
    desc: "ใส่เบอร์โทรหรือเลขบัตรประชาชน ระบบสร้าง QR + ยอดเงินให้ทันที ลูกค้าสแกนจ่ายได้เลย",
  },
  {
    icon: Bot,
    title: "AI ตรวจสลิปอัตโนมัติ",
    desc: "ลูกค้าอัปสลิป — เช็คยอด เช็คผู้รับ เช็คเวลา ภายใน 2 วินาที จับสลิปปลอมได้แม่นยำ",
  },
  {
    icon: Banknote,
    title: "ไม่หัก ไม่กิน ค่าธรรมเนียม",
    desc: "เงินวิ่งตรงจากบัญชีลูกค้าเข้าบัญชีคุณ — SalePage ไม่เป็นตัวกลางทางการเงินใดๆ",
  },
  {
    icon: Link2,
    title: "ลิงก์เดียวขายได้ทั่ว Bio",
    desc: "salepage.in.th/{ชื่อร้าน} แปะที่ IG, TikTok, LINE OA, FB — เปิดที่ไหนก็ขายได้",
  },
  {
    icon: ShieldCheck,
    title: "ระบบหลังบ้านระดับโปร",
    desc: "ออเดอร์ สต๊อก คูปอง รีวิว แดชบอร์ด — ครบทุกอย่างที่ร้านมืออาชีพต้องมี",
  },
  {
    icon: Smartphone,
    title: "เว็บ + แอปมือถือ",
    desc: "API-first จัดการร้านจากเว็บก็ได้ จากแอปมือถือก็ได้ — ทุกอย่าง sync แบบ real-time",
  },
  {
    icon: Layers,
    title: "ธีมสวยขั้นเทพ พร้อมใช้",
    desc: "ดีไซน์ระดับแบรนด์ใหญ่ ปรับสี-โลโก้-แบนเนอร์เอง หรือเลือก preset ก็ได้",
  },
  {
    icon: Zap,
    title: "เร็วทุกหน้า ทุกครั้ง",
    desc: "เว็บโหลด < 1 วินาที ออเดอร์เข้าทันที แจ้งเตือนสลิป real-time ไม่มีรอ",
  },
];

export function Features() {
  return (
    <section id="features" className="py-20 sm:py-24">
      <div className="container-page">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--color-brand-50)] px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[color:var(--color-brand-700)]">
            <Sparkles className="size-3.5" /> ทำไมต้อง SalePage
          </span>
          <h2 className="font-display mt-4 text-balance text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            ดีกว่า เท่กว่า ง่ายกว่า — <br className="hidden sm:block" />
            <span className="text-[color:var(--color-brand-600)]">
              ทุกระบบ SalePage ที่เคยใช้
            </span>
          </h2>
          <p className="mt-4 text-balance text-[17px] leading-relaxed text-zinc-600">
            ทุกฟีเจอร์ที่ร้านออนไลน์ต้องมี — ออกแบบใหม่ให้เร็วขึ้น สวยขึ้น และใช้ง่ายขึ้น
          </p>
        </div>

        <div className="mt-12 grid gap-3 sm:gap-4 md:grid-cols-2 lg:mt-14 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <FeatureCard key={f.title} feature={f} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ feature, index }: { feature: Feature; index: number }) {
  const Icon = feature.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.3) }}
      className="group relative overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[color:var(--color-brand-200)] hover:shadow-lg hover:shadow-rose-100/60 sm:p-6"
    >
      <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[color:var(--color-brand-200)] to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="flex items-start gap-4">
        <span className="relative grid size-11 shrink-0 place-items-center rounded-xl bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-700)] transition-colors group-hover:bg-[color:var(--color-brand-600)] group-hover:text-white">
          <Icon className="size-5" strokeWidth={2.25} />
        </span>
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold sm:text-lg">
            {feature.title}
          </h3>
          <p className="mt-1.5 text-[14px] leading-relaxed text-zinc-600 sm:text-[15px]">
            {feature.desc}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
