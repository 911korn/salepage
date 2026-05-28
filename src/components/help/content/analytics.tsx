/* eslint-disable react/no-unescaped-entities */
import { TrendingUp } from "lucide-react";
import {
  HelpHeader,
  Steps,
  Step,
  Mock,
  Tip,
} from "../help-primitives";

export function Analytics() {
  return (
    <>
      <HelpHeader
        title="Analytics — ดูรายงานยอดขาย"
        intro="ดูยอดวันนี้ / 7 วัน / 30 วัน · สินค้าขายดี · ลูกค้าใหม่ vs กลับมาซื้อ"
      />

      <Steps>
        <Step n={1} title="เปิดเมนู 'Analytics'">
          <p>เครื่องมือ → กด "Analytics" → เห็น dashboard กราฟ + ตาราง</p>
        </Step>

        <Step n={2} title="ตัวเลขที่สำคัญ">
          <Mock>
            <div className="grid grid-cols-2 gap-2 p-3">
              <div className="rounded-xl border border-zinc-200 p-3">
                <p className="text-[10px] uppercase text-zinc-500">
                  ยอดวันนี้
                </p>
                <p className="font-display mt-1 text-xl font-bold">฿2,490</p>
                <p className="mt-0.5 flex items-center gap-1 text-[10px] text-emerald-700">
                  <TrendingUp className="size-3" /> +18% จากเมื่อวาน
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 p-3">
                <p className="text-[10px] uppercase text-zinc-500">
                  ออเดอร์ 7 วัน
                </p>
                <p className="font-display mt-1 text-xl font-bold">47</p>
                <p className="mt-0.5 text-[10px] text-zinc-500">
                  เฉลี่ย 6.7/วัน
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 p-3">
                <p className="text-[10px] uppercase text-zinc-500">
                  AOV (Average Order Value)
                </p>
                <p className="font-display mt-1 text-xl font-bold">฿176</p>
              </div>
              <div className="rounded-xl border border-zinc-200 p-3">
                <p className="text-[10px] uppercase text-zinc-500">
                  ลูกค้ากลับมาซื้อ
                </p>
                <p className="font-display mt-1 text-xl font-bold">23%</p>
              </div>
            </div>
          </Mock>
        </Step>

        <Step n={3} title="ดูสินค้าขายดี">
          <p>
            เลื่อนลงไปดู Top Products — แสดง 10 อันดับสินค้าขายดีในช่วงที่เลือก พร้อม % ของยอดรวม
          </p>
          <Tip>
            ใช้ข้อมูลนี้เพื่อ: เพิ่มสต็อกสินค้าขายดี · เอาสินค้าขายไม่ออกออก · ตั้งคูปอง bundle
          </Tip>
        </Step>
      </Steps>
    </>
  );
}
