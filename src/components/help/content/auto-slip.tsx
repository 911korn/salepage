/* eslint-disable react/no-unescaped-entities */
import { Zap, CheckCircle2, AlertCircle } from "lucide-react";
import {
  HelpHeader,
  Steps,
  Step,
  Mock,
  Tip,
  Warn,
  Note,
} from "../help-primitives";

export function AutoSlip() {
  return (
    <>
      <HelpHeader
        title="ตรวจสลิปอัตโนมัติ (Auto Slip)"
        intro="AI ตรวจสลิปลูกค้าใน 3 วินาที — เช็คยอด ผู้รับ เวลา จับสลิปปลอมได้แม่นยำ"
      />

      <Steps>
        <Step n={1} title="ระบบทำงานยังไง">
          <p>
            พอลูกค้าโอน PromptPay + อัปสลิปบนหน้าออเดอร์ → ระบบส่งสลิปไป API ของ SlipOK (พาร์ทเนอร์รายใหญ่ของไทย) → ได้ผลกลับมาภายใน 3 วินาที:
          </p>
          <ul className="ml-4 list-disc space-y-1 text-[13px]">
            <li>
              <strong>ผ่าน</strong> — ยอดตรง ผู้รับตรง ไม่ใช่สลิปซ้ำ → ออเดอร์เปลี่ยนเป็น "จ่ายแล้ว" ทันที
            </li>
            <li>
              <strong>ยอดไม่ตรง</strong> — แจ้งลูกค้า + ออเดอร์ยังอยู่ "รอชำระ"
            </li>
            <li>
              <strong>ผู้รับไม่ตรง</strong> — โอนเข้าผิดบัญชี เตือนลูกค้าให้ติดต่อร้านโดยตรง
            </li>
            <li>
              <strong>สลิปซ้ำ</strong> — สลิปนี้เคยใช้แล้ว แจ้งลูกค้า + แจ้งร้าน
            </li>
          </ul>
        </Step>

        <Step n={2} title="ใครได้ใช้ได้บ้าง">
          <Mock>
            <div className="overflow-hidden">
              <div className="grid grid-cols-3 divide-x divide-zinc-100 text-center">
                <div className="p-3">
                  <p className="text-[11px] font-bold">FREE / Starter</p>
                  <p className="mt-1 text-[10px] text-zinc-500">
                    0 สลิป/เดือน
                  </p>
                  <p className="mt-1 text-[10px] text-rose-700">
                    ต้องซื้อเครดิตเพิ่ม
                  </p>
                </div>
                <div className="bg-rose-50 p-3">
                  <p className="text-[11px] font-bold text-rose-700">Pro</p>
                  <p className="mt-1 font-mono text-[11px] font-bold">
                    300/เดือน
                  </p>
                  <p className="mt-1 text-[10px] text-zinc-500">฿299/เดือน</p>
                </div>
                <div className="bg-emerald-50 p-3">
                  <p className="text-[11px] font-bold text-emerald-700">
                    Business
                  </p>
                  <p className="mt-1 font-mono text-[11px] font-bold">
                    1,500/เดือน
                  </p>
                  <p className="mt-1 text-[10px] text-zinc-500">฿790/เดือน</p>
                </div>
              </div>
            </div>
          </Mock>
          <Note>
            <strong>FREE/Starter ใช้ได้ด้วย</strong> — แค่ต้องซื้อ "เครดิตตรวจสลิป" แยก (pack เริ่มต้น 50 สลิป ฿125 = ฿2.50 ต่อสลิป) — ดูคู่มือ <em>"เครดิตตรวจสลิป"</em>
          </Note>
        </Step>

        <Step n={3} title="ตั้งค่ายังไง — ตอบ: ไม่ต้องตั้งเลย">
          <p>
            ระบบเปิดให้อัตโนมัติทุกร้านที่มีโควต้า/เครดิต — แค่ใส่ PromptPay ที่ถูกต้องในหน้า "ตั้งค่าร้าน" → ทุกครั้งที่ลูกค้าอัปสลิป AI ตรวจให้ทันที
          </p>
          <Mock>
            <div className="space-y-2 p-3">
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-2.5">
                <Zap className="size-4 text-emerald-700" />
                <p className="text-[11.5px] font-bold text-emerald-900">
                  AI ตรวจสลิปสำเร็จ
                </p>
                <span className="ml-auto font-mono text-[10px] text-zinc-500">
                  2.4 วิ
                </span>
              </div>
              <ul className="space-y-1 px-2 text-[11.5px] text-zinc-700">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3 text-emerald-600" /> ยอด ฿290 ตรง
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3 text-emerald-600" /> ผู้รับ
                  promptpay 081-xxx-5678 ตรง
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3 text-emerald-600" /> ไม่ซ้ำ
                </li>
              </ul>
            </div>
          </Mock>
        </Step>

        <Step n={4} title="ถ้า AI หาว่าไม่ตรง — ลูกค้าเห็นอะไร">
          <p>
            ลูกค้าจะเห็นแบนเนอร์แดงในหน้าออเดอร์: "ตรวจสลิปไม่ผ่าน" + บอกเหตุผล → ลูกค้าโอนใหม่ + อัปสลิปใหม่ได้เลย ไม่ต้องสร้างออเดอร์ใหม่
          </p>
          <Mock>
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 size-4 text-amber-700" />
                <div>
                  <p className="text-[11.5px] font-bold text-amber-900">
                    ตรวจสลิปไม่ผ่าน
                  </p>
                  <ul className="mt-1 list-disc pl-4 text-[11px] text-amber-800">
                    <li>ยอดในสลิป (฿200) ไม่ตรงกับยอดสั่งซื้อ (฿290)</li>
                  </ul>
                </div>
              </div>
            </div>
          </Mock>
        </Step>

        <Step n={5} title="ถ้า AI อ่านไม่ออกหรือเครดิตหมด">
          <p>
            ระบบไม่ทำลูกค้าตกขอบ — สลิปที่อ่านไม่ออก/ไม่มีเครดิต จะเก็บไว้ในออเดอร์ทันที + ขึ้นแจ้งคุณในหลังบ้านว่า "มีสลิปรอตรวจด้วยมือ"
          </p>
          <Warn>
            <strong>ถ้าสลิปไม่ใช่รูปสลิปจริง</strong> (selfie, screenshot อื่นๆ) → ระบบใช้ AI pre-flight ตรวจให้ทันที + แจ้งลูกค้าให้อัปใหม่ ไม่ปนเข้าออเดอร์
          </Warn>
        </Step>
      </Steps>

      <Tip>
        <strong>ขั้นต่อไป:</strong> ดูคู่มือ <em>"เครดิตตรวจสลิป"</em> ถ้าใช้แผน FREE/Starter หรือ <em>"แผน Free / Pro / Business / Agency"</em> ถ้าจะอัปเกรด
      </Tip>
    </>
  );
}
