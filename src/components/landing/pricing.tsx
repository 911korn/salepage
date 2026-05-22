"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Check, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { cn } from "@/lib/cn";

interface Plan {
  id: string;
  name: string;
  price: string;
  priceSuffix?: string;
  description: string;
  cta: string;
  href: string;
  highlight?: boolean;
  features: string[];
}

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Starter",
    price: "฿0",
    priceSuffix: "ตลอดชีพ",
    description: "เริ่มต้นขาย ไม่มีค่าใช้จ่าย",
    cta: "เริ่มฟรี",
    href: "/signup",
    features: [
      "สินค้าสูงสุด 5 รายการ",
      "รูปสินค้า 2 รูป/ชิ้น",
      "PromptPay QR อัตโนมัติ",
      "ตรวจสลิปด้วยตา (manual)",
      "subdomain salepage.in.th/{ชื่อร้าน}",
      "ระบบหลังบ้านพื้นฐาน",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "฿299",
    priceSuffix: "/เดือน",
    description: "ร้านขายดี ที่ต้องการพลังเต็มที่",
    cta: "เริ่ม Pro ฟรี 14 วัน",
    href: "/signup?plan=pro",
    highlight: true,
    features: [
      "สินค้าไม่จำกัด",
      "รูปสินค้า 10 รูป/ชิ้น",
      "AI ตรวจสลิปอัตโนมัติ ฿0.50/รายการ",
      "ระบบคูปองส่วนลด + คะแนนสะสม",
      "Analytics + Funnel report",
      "Custom domain ของคุณเอง",
      "Verified ✓ badge",
      "ซัพพอร์ต VIP ภายใน 1 ชม.",
    ],
  },
  {
    id: "business",
    name: "Business",
    price: "฿790",
    priceSuffix: "/เดือน",
    description: "หลายร้าน หลายแบรนด์ บัญชีเดียว",
    cta: "ติดต่อทีมขาย",
    href: "/contact",
    features: [
      "ทุกอย่างใน Pro",
      "สูงสุด 5 ร้านในบัญชีเดียว",
      "AI ตรวจสลิป ฿0/รายการ (ไม่จำกัด)",
      "API + Webhook สำหรับ ERP",
      "Webhook → LINE OA / Slack",
      "พนักงาน 10 user / สาขา",
      "SLA 99.9% + Account Manager",
    ],
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="py-20 sm:py-24">
      <div className="container-page">
        <div className="mx-auto max-w-2xl text-center">
          <Badge tone="soft-brand">
            <Sparkles className="size-3.5" /> ราคาเริ่มต้นฟรี
          </Badge>
          <h2 className="font-display mt-4 text-balance text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            จ่ายแค่ที่คุณใช้ — <br className="hidden sm:block" />
            <span className="text-[color:var(--color-brand-600)]">
              ถูกกว่าคู่แข่งกว่า 30%
            </span>
          </h2>
          <p className="mt-4 text-balance text-[17px] leading-relaxed text-zinc-600">
            เริ่มต้นฟรีตลอดชีพ ไม่มีค่าธรรมเนียมต่อออเดอร์ ลูกค้าโอนเข้าบัญชีคุณตรงๆ
          </p>
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-3 lg:gap-6">
          {PLANS.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
              className={cn(
                "relative flex flex-col rounded-3xl border bg-white p-6 transition-shadow sm:p-7",
                p.highlight
                  ? "border-[color:var(--color-brand-300)] shadow-xl shadow-rose-100/60 lg:scale-[1.02]"
                  : "border-[color:var(--color-border)] shadow-sm",
              )}
            >
              {p.highlight ? (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[color:var(--color-brand-600)] px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white shadow-md">
                  แนะนำ
                </span>
              ) : null}

              <div>
                <h3 className="font-display text-lg font-bold sm:text-xl">
                  {p.name}
                </h3>
                <p className="mt-1 text-sm text-zinc-600">{p.description}</p>
              </div>

              <div className="mt-5 flex items-baseline gap-1.5">
                <span
                  className={cn(
                    "font-display text-4xl font-bold sm:text-5xl",
                    p.highlight && "text-[color:var(--color-brand-600)]",
                  )}
                >
                  {p.price}
                </span>
                {p.priceSuffix ? (
                  <span className="text-sm text-zinc-500">{p.priceSuffix}</span>
                ) : null}
              </div>

              <Link
                href={p.href}
                className={cn(
                  buttonStyles({
                    size: "lg",
                    variant: p.highlight ? "primary" : "outline",
                  }),
                  "mt-6 w-full",
                )}
              >
                {p.cta}
              </Link>

              <ul className="mt-6 space-y-3 text-[14px]">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check
                      className={cn(
                        "mt-0.5 size-4 shrink-0",
                        p.highlight
                          ? "text-[color:var(--color-brand-600)]"
                          : "text-emerald-600",
                      )}
                    />
                    <span className="text-zinc-700">{f}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-zinc-500">
          ราคารวม VAT 7% แล้ว · ยกเลิกได้ทุกเมื่อ · เปลี่ยนแพ็กเกจขึ้น-ลงได้ทุกเดือน
        </p>
      </div>
    </section>
  );
}
