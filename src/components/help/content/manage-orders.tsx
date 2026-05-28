/* eslint-disable react/no-unescaped-entities */
import { CheckCircle2, Clock, Package } from "lucide-react";
import {
  HelpHeader,
  Steps,
  Step,
  Mock,
  Pin,
  Legend,
  Tip,
  Warn,
  Note,
  MockButton,
} from "../help-primitives";

export function ManageOrders() {
  return (
    <>
      <HelpHeader
        title="ดูและจัดการออเดอร์"
        intro="ออเดอร์ทุกใบจะอยู่ในเมนู 'ออเดอร์' — เรียงตามสถานะ ให้รู้ว่าต้องทำอะไรต่อ"
      />

      <Steps>
        <Step n={1} title="เข้าเมนู 'ออเดอร์' ที่แถบซ้าย">
          <p>
            ออเดอร์ทุกใบจะรวมที่นี่ — แบ่งตามสถานะ 5 ระดับ ตั้งแต่ "รอชำระ" จนถึง "ส่งของแล้ว"
          </p>
          <Mock>
            <div className="p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                ตัวกรองสถานะ
              </p>
              <div className="relative mt-2 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800">
                  <Clock className="mr-1 inline size-3" /> รอชำระ (2)
                </span>
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                  <CheckCircle2 className="mr-1 inline size-3" /> จ่ายแล้ว (5)
                </span>
                <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-bold text-rose-800">
                  <Package className="mr-1 inline size-3" /> รอส่ง (3)
                </span>
                <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-700">
                  ส่งแล้ว
                </span>
                <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-700">
                  ยกเลิก
                </span>
                <Pin
                  n={1}
                  className="-right-2 -top-2"
                  style={{ position: "absolute" }}
                />
              </div>
            </div>
          </Mock>
          <Legend
            items={[
              {
                n: 1,
                label:
                  "ตัวเลขในวงเล็บ = จำนวนออเดอร์ในสถานะนั้น · กดเพื่อ filter",
              },
            ]}
          />
        </Step>

        <Step n={2} title="เปิดออเดอร์เพื่อดูรายละเอียด">
          <p>
            กดที่แถวออเดอร์ใดก็ได้ — เปิดหน้ารายละเอียดที่มี: รายการสินค้า, ที่อยู่ลูกค้า, สลิป (ถ้าจ่ายแล้ว), ปุ่มจัดการ
          </p>
          <Mock>
            <div className="space-y-2 p-3">
              <div className="relative rounded-xl border-2 border-amber-300 bg-amber-50 p-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono text-[10px] text-zinc-500">
                      #20260528-AB1Y2
                    </p>
                    <p className="text-[12px] font-semibold">กิตติกร ทวีผล</p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                    รอตรวจสลิป
                  </span>
                </div>
                <p className="mt-1 font-mono text-[11px] font-bold text-rose-700">
                  ฿290
                </p>
                <Pin
                  n={1}
                  className="-right-2 -top-2"
                  style={{ position: "absolute" }}
                />
              </div>
              <div className="rounded-xl border border-zinc-200 p-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono text-[10px] text-zinc-500">
                      #20260528-XY3Z4
                    </p>
                    <p className="text-[12px] font-semibold">วิภาวี ใจดี</p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                    จ่ายแล้ว
                  </span>
                </div>
              </div>
            </div>
          </Mock>
          <Legend
            items={[
              {
                n: 1,
                label:
                  "กรอบเหลือง = ต้องจัดการ (รอตรวจสลิป) · กดเพื่อตรวจสลิป + อนุมัติ",
              },
            ]}
          />
        </Step>

        <Step n={3} title="ตรวจสลิป + อนุมัติออเดอร์">
          <p>
            สำหรับร้าน <strong>FREE/Starter</strong> ที่ยังไม่มีโควต้า AI ตรวจสลิป → ระบบจะส่งสลิปเข้า "รอตรวจด้วยมือ" คุณจะเห็นสลิปลูกค้า + ปุ่มยืนยัน
          </p>
          <Mock>
            <div className="space-y-2 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                สลิปจากลูกค้า
              </p>
              <div className="relative">
                <div className="grid h-32 place-items-center rounded-xl border border-amber-200 bg-amber-50 text-[11px] text-amber-900">
                  รูปสลิปการโอน
                </div>
                <Pin
                  n={1}
                  className="-right-2 -top-2"
                  style={{ position: "absolute" }}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <MockButton variant="outline" className="justify-center">
                  ปฏิเสธ
                </MockButton>
                <MockButton className="justify-center">
                  ✓ ยืนยันว่าจ่ายแล้ว
                </MockButton>
              </div>
              <Pin
                n={2}
                className="-right-2 top-32"
                style={{ position: "absolute" }}
              />
            </div>
          </Mock>
          <Legend
            items={[
              { n: 1, label: "รูปสลิปจากลูกค้า — เช็คยอด, ผู้รับ, เวลาให้ตรง" },
              {
                n: 2,
                label:
                  "ปุ่ม 'ยืนยัน' = อนุมัติ → ออเดอร์เปลี่ยนเป็น 'จ่ายแล้ว' พร้อมส่งของ",
              },
            ]}
          />
          <Tip>
            <strong>อยาก AI ตรวจให้อัตโนมัติ?</strong> ดูคู่มือ <em>"ตรวจสลิปอัตโนมัติ (Auto Slip)"</em> — Pro+ ได้ฟรี Free/Starter ซื้อเครดิตเพิ่มได้
          </Tip>
        </Step>

        <Step n={4} title="กด 'พิมพ์ใบปะหน้า' เพื่อจัดส่ง">
          <p>
            ในหน้าออเดอร์ที่จ่ายแล้ว จะมีปุ่ม <MockButton>พิมพ์ใบปะหน้า</MockButton> สีแดง — กดแล้วเปิด tab ใหม่ที่มีใบปะหน้าให้พิมพ์ลงกระดาษ A6 (หรือ thermal label)
          </p>
          <Note>
            <strong>Business+ เท่านั้น</strong> ฟีเจอร์พิมพ์ใบปะหน้า + AI tracking — แผนอื่นใส่เลข tracking ด้วยมือได้ตามปกติ
          </Note>
        </Step>

        <Step n={5} title="แชทกับลูกค้า (Business+)">
          <p>
            ที่หน้าออเดอร์ มีปุ่ม "แชทกับลูกค้า" เปิดหน้าต่างแชทไปที่ LINE ของลูกค้า — ตอบไปได้เลยจากในระบบ ทุกข้อความเก็บ history ให้
          </p>
          <Warn>
            <strong>ก่อนยกเลิก:</strong> ถ้าออเดอร์เป็น "จ่ายแล้ว" แต่ยังไม่ส่ง คุณสามารถกดยกเลิกได้ → ระบบจะ refund ลูกค้าให้ผ่าน LINE (ลูกค้าต้องโอนคืน promptpay เอง ระบบช่วย confirm)
          </Warn>
        </Step>
      </Steps>

      <Note>
        <strong>สถานะออเดอร์เปลี่ยนอัตโนมัติ:</strong> รอชำระ → จ่ายแล้ว (พอ AI ตรวจสลิปผ่าน) → รอส่ง (พอกดพิมพ์ใบปะหน้า + อัปใบเสร็จ) → ส่งของแล้ว → ลูกค้ายืนยันรับ (auto-release 7 วัน)
      </Note>
    </>
  );
}
