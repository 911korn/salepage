/* eslint-disable react/no-unescaped-entities */
import { Award } from "lucide-react";
import {
  HelpHeader,
  Steps,
  Step,
  Mock,
  Tip,
} from "../help-primitives";

export function Coupons() {
  return (
    <>
      <HelpHeader
        title="คูปองส่วนลด + Loyalty"
        intro="ทำคูปองออกแคมเปญ — % discount, จำนวนเงิน, ส่งฟรี · Loyalty: สะสมแต้ม → แลกส่วนลด"
      />

      <Steps>
        <Step n={1} title="ไปที่เมนู 'คูปอง'">
          <p>
            ในแถบเครื่องมือ → กด "คูปอง" → กดปุ่ม "+ คูปองใหม่" ที่มุมขวาบน
          </p>
        </Step>

        <Step n={2} title="ตั้งค่าคูปอง">
          <Mock>
            <div className="space-y-2 p-3">
              <div>
                <p className="text-[10.5px] font-semibold text-zinc-500">
                  รหัสคูปอง
                </p>
                <span className="block w-full rounded-xl border-2 border-rose-300 bg-white p-2.5 font-mono text-[13px]">
                  SUMMER10
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border-2 border-rose-300 bg-rose-50 p-2 text-center">
                  <p className="text-[10px] font-bold">% ส่วนลด</p>
                </div>
                <div className="rounded-xl border border-zinc-200 p-2 text-center">
                  <p className="text-[10px] font-semibold text-zinc-600">
                    จำนวนเงิน
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10.5px] font-semibold text-zinc-500">
                    ส่วนลด (%)
                  </p>
                  <span className="block rounded-xl border border-zinc-200 p-2.5 font-mono text-[13px]">
                    10
                  </span>
                </div>
                <div>
                  <p className="text-[10.5px] font-semibold text-zinc-500">
                    ใช้ได้ขั้นต่ำ (บาท)
                  </p>
                  <span className="block rounded-xl border border-zinc-200 p-2.5 font-mono text-[13px]">
                    200
                  </span>
                </div>
              </div>
              <div>
                <p className="text-[10.5px] font-semibold text-zinc-500">
                  หมดอายุ
                </p>
                <span className="block rounded-xl border border-zinc-200 p-2.5 font-mono text-[13px]">
                  2026-06-30
                </span>
              </div>
            </div>
          </Mock>
          <Tip>
            <strong>ทิป:</strong> ใช้รหัสที่จำง่าย (SUMMER10, NEW100) เพื่อให้ลูกค้าจดจำได้ — แต่อย่าตั้งคล้ายๆ กัน
          </Tip>
        </Step>

        <Step n={3} title="แชร์คูปองให้ลูกค้า">
          <p>
            ลูกค้าใส่รหัสคูปองในหน้า checkout — จะมีปุ่ม "ใส่คูปอง" ใต้สรุปยอด
          </p>
          <Tip>
            แชร์รหัสผ่าน Facebook post, LINE OA broadcast, หรือใบเสร็จที่ปริ๊น → ติดบน packaging
          </Tip>
        </Step>

        <Step n={4} title="Loyalty Points (Business+)">
          <p>
            เปิดในตั้งค่า → "Loyalty" → ลูกค้าได้แต้มตามยอดซื้อ (เช่น 1 แต้มต่อ 10 บาท) → สะสมแลกเป็นส่วนลดในรอบถัดไป
          </p>
          <Mock>
            <div className="space-y-2 p-3">
              <div className="flex items-center gap-2 rounded-xl bg-amber-50 p-2.5">
                <Award className="size-4 text-amber-700" />
                <p className="flex-1 text-[11.5px] font-bold">
                  ลูกค้าใหม่ — 240 แต้ม
                </p>
                <p className="font-mono text-[11px] text-zinc-700">
                  ฿2,400 ยอดรวม
                </p>
              </div>
              <p className="px-1 text-[10.5px] text-zinc-500">
                100 แต้ม = ส่วนลด ฿10 ในรอบถัดไป
              </p>
            </div>
          </Mock>
        </Step>
      </Steps>
    </>
  );
}
