import Link from "next/link";
import { LogoMark, Wordmark } from "@/components/ui/logo";

const COLS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "ผลิตภัณฑ์",
    links: [
      { href: "#features", label: "ฟีเจอร์" },
      { href: "#promptpay", label: "PromptPay & สลิป" },
      { href: "#pricing", label: "ราคา" },
      { href: "/s/siam-snack", label: "ตัวอย่างร้าน" },
    ],
  },
  {
    title: "นักพัฒนา",
    links: [
      { href: "/api/v1/health", label: "API v1" },
      { href: "/docs", label: "เอกสาร" },
      { href: "/docs/promptpay", label: "PromptPay API" },
      { href: "/docs/slip", label: "Slip Verify API" },
    ],
  },
  {
    title: "บริษัท",
    links: [
      { href: "/about", label: "เกี่ยวกับเรา" },
      { href: "/contact", label: "ติดต่อ" },
      { href: "/terms", label: "เงื่อนไขการใช้งาน" },
      { href: "/privacy", label: "ความเป็นส่วนตัว" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-[color:var(--color-border)] bg-white">
      <div className="container-page py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="flex items-center gap-2">
              <LogoMark />
              <Wordmark />
            </Link>
            <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-zinc-600">
              แพลตฟอร์มสร้างร้านสำเร็จรูป รับเงินตรง PromptPay พร้อม AI ตรวจสลิป — สำหรับร้านค้าออนไลน์ไทยทุกขนาด
            </p>
          </div>

          {COLS.map((col) => (
            <div key={col.title}>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                {col.title}
              </p>
              <ul className="mt-4 space-y-3">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-sm text-zinc-700 hover:text-[color:var(--color-brand-700)]"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-[color:var(--color-border)] pt-6 sm:flex-row sm:items-center">
          <p className="text-[13px] text-zinc-500">
            © {new Date().getFullYear()} SalePage. สงวนลิขสิทธิ์ทั้งหมด.
          </p>
          <p className="text-[13px] text-zinc-500">
            สร้างที่ประเทศไทย ด้วย ❤
          </p>
        </div>
      </div>
    </footer>
  );
}
