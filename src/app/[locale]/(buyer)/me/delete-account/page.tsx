import { setRequestLocale } from "next-intl/server";
import { Trash2, Mail, ShieldAlert } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

export const metadata = {
  title: "ลบบัญชี · SalePage",
  description:
    "ขั้นตอนการลบบัญชี SalePage และข้อมูลที่เกี่ยวข้อง ส่งคำขอลบบัญชีถาวรได้ที่ support@salepage.in.th",
};

interface PageProps {
  params: Promise<{ locale: Locale }>;
}

export default async function DeleteAccountPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="container-page max-w-2xl py-8">
      <h1 className="mb-3 flex items-center gap-2 text-2xl font-bold">
        <Trash2 className="h-6 w-6 text-rose-600" />
        ขอลบบัญชี SalePage
      </h1>
      <p className="mb-6 text-sm text-zinc-600">
        คุณสามารถขอลบบัญชี SalePage และข้อมูลที่เกี่ยวข้องได้ตลอดเวลา ทำตามขั้นตอนด้านล่าง
      </p>

      <section className="mb-6 rounded-3xl border border-[color:var(--color-border)] bg-white p-5">
        <h2 className="mb-3 text-lg font-semibold">วิธีขอลบบัญชี</h2>
        <ol className="list-decimal space-y-3 pl-5 text-sm leading-6 text-zinc-700">
          <li>
            ส่งอีเมลจากที่อยู่อีเมลที่ใช้สมัคร SalePage ไปที่{" "}
            <a
              href="mailto:support@salepage.in.th?subject=%E0%B8%82%E0%B8%AD%E0%B8%A5%E0%B8%9A%E0%B8%9A%E0%B8%B1%E0%B8%8D%E0%B8%8A%E0%B8%B5%20SalePage"
              className="font-medium text-rose-600 underline"
            >
              support@salepage.in.th
            </a>{" "}
            พร้อมแจ้ง “ขอลบบัญชี”
          </li>
          <li>ทีมงานจะยืนยันตัวตนภายใน 24 ชั่วโมงทำการ</li>
          <li>หลังยืนยันแล้ว เราจะลบบัญชีและข้อมูลส่วนตัวที่เกี่ยวข้องภายใน 30 วัน</li>
        </ol>
      </section>

      <section className="mb-6 rounded-3xl border border-[color:var(--color-border)] bg-white p-5">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <ShieldAlert className="h-5 w-5 text-amber-600" />
          ข้อมูลที่จะถูกลบและที่เก็บไว้
        </h2>
        <div className="space-y-4 text-sm leading-6 text-zinc-700">
          <div>
            <p className="font-medium text-zinc-900">ลบทันที (ภายใน 30 วัน):</p>
            <ul className="ml-5 list-disc space-y-1">
              <li>ชื่อ อีเมล เบอร์โทร ที่อยู่จัดส่ง</li>
              <li>รูปโปรไฟล์และรูปสินค้าที่อัปโหลด</li>
              <li>ประวัติการเข้าระบบและการกระทำในแอป</li>
              <li>ข้อความที่ส่งในระบบแชทร้าน</li>
              <li>ร้านค้าและสินค้าที่คุณสร้าง (หากเป็นเจ้าของร้าน)</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-zinc-900">เก็บไว้ตามกฎหมายไทย:</p>
            <ul className="ml-5 list-disc space-y-1">
              <li>
                ประวัติคำสั่งซื้อและใบเสร็จ (กฎหมายภาษีสรรพากร เก็บ 5 ปี) — ข้อมูลส่วนตัวจะถูกปกปิด
                เหลือเฉพาะตัวเลขรายการ
              </li>
              <li>บันทึก Logs การชำระเงิน (เก็บ 2 ปี เพื่อตรวจสอบทุจริต)</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-[color:var(--color-border)] bg-white p-5">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Mail className="h-5 w-5 text-zinc-600" />
          ติดต่อทีมสนับสนุน
        </h2>
        <p className="text-sm leading-6 text-zinc-700">
          อีเมล:{" "}
          <a
            href="mailto:support@salepage.in.th"
            className="font-medium text-rose-600 underline"
          >
            support@salepage.in.th
          </a>
          <br />
          เปิดบริการ จันทร์–ศุกร์ 9.00–18.00 (เวลาประเทศไทย)
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/me"
            className="rounded-full border border-[color:var(--color-border)] px-4 py-2 text-sm font-medium hover:bg-[color:var(--color-soft)]"
          >
            กลับไปบัญชีของฉัน
          </Link>
          <Link
            href="/privacy"
            className="rounded-full border border-[color:var(--color-border)] px-4 py-2 text-sm font-medium hover:bg-[color:var(--color-soft)]"
          >
            อ่านนโยบายความเป็นส่วนตัว
          </Link>
        </div>
      </section>
    </div>
  );
}
