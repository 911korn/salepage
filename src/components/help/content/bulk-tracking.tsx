/* eslint-disable react/no-unescaped-entities */
import { Camera, CheckCircle2 } from "lucide-react";
import {
  HelpHeader,
  Steps,
  Step,
  Mock,
  Pin,
  Legend,
  Tip,
  Note,
  MockButton,
} from "../help-primitives";

export function BulkTracking() {
  return (
    <>
      <HelpHeader
        title="AI Bulk Tracking — ส่งทีละ 100 ออเดอร์"
        intro="ถ่ายรูปใบเสร็จเป็นกอง · AI อ่านทุกใบ + จับคู่กับออเดอร์ที่จ่ายแล้วให้ทันที — แทนการใส่ tracking ทีละ 100 ครั้ง"
      />

      <Note>
        <strong>ฟรีทุกแผน</strong> — AI Bulk Tracking ใช้ได้ตั้งแต่ Free ขึ้นไป ไม่ต้องอัปเกรด
      </Note>

      <Steps>
        <Step n={1} title="ไปที่ 'Bulk Tracking' ในเมนูเครื่องมือ">
          <p>
            ในหน้าหลัก dashboard → กดที่ "Bulk Tracking" ในกริดเครื่องมือ — หรือไปตรงๆ ที่ <strong>/dashboard/shipping/bulk-scan</strong>
          </p>
        </Step>

        <Step n={2} title="ถ่ายรูปใบเสร็จ — แนะนำ ~5 ใบเสร็จต่อรูป">
          <p>
            ถ่ายแยกได้หลายรูป (สูงสุด 20 รูปต่อรอบ) — กดถ่ายในเครื่องจริงเลย หรืออัปจากแกลเลอรี
          </p>
          <Mock variant="phone">
            <div className="relative p-3">
              <p className="text-[12px] font-bold">AI Bulk Tracking</p>
              <p className="mt-0.5 text-[9.5px] text-zinc-500">
                อัปแล้ว 4/20 รูป
              </p>
              <div className="mt-2 grid grid-cols-3 gap-1">
                <div className="relative aspect-square overflow-hidden rounded-md bg-gradient-to-br from-zinc-100 to-zinc-200" />
                <div className="relative aspect-square overflow-hidden rounded-md bg-gradient-to-br from-zinc-100 to-zinc-200" />
                <div className="relative aspect-square overflow-hidden rounded-md bg-gradient-to-br from-zinc-100 to-zinc-200" />
                <div className="relative aspect-square overflow-hidden rounded-md bg-gradient-to-br from-zinc-100 to-zinc-200" />
                <div className="relative grid aspect-square place-items-center rounded-md border-2 border-dashed border-zinc-300">
                  <Camera className="size-4 text-zinc-400" />
                </div>
                <Pin
                  n={1}
                  className="-right-2 top-12"
                  style={{ position: "absolute" }}
                />
              </div>
              <div className="mt-3 rounded-xl bg-rose-600 px-3 py-2 text-center">
                <p className="text-[11px] font-bold text-white">
                  เริ่มสแกน (4 รูป)
                </p>
              </div>
            </div>
          </Mock>
          <Legend
            items={[
              {
                n: 1,
                label:
                  "กดที่ช่องว่างเพื่อถ่ายเพิ่ม — ระบบรองรับ snap ติดกันได้เลย",
              },
            ]}
          />
        </Step>

        <Step
          n={3}
          title="เทคนิคไปรษณีย์ไทย / J&T eCo — ถ่ายคู่ใบปะหน้า"
        >
          <p>
            ใบเสร็จไปรษณีย์ไทย / J&T eCo ไม่พิมพ์ชื่อผู้รับ → AI หาคู่ไม่ได้ตรงๆ
          </p>
          <p>
            <strong>วิธีง่ายสุด:</strong> ถ่ายใบเสร็จ <em>คู่กับ</em> ใบปะหน้าของเรา (ที่มี QR + เลข Order) ในรูปเดียวกัน → AI อ่านทั้งคู่ → pair กับออเดอร์ที่ถูกต้อง <strong>อัตโนมัติ 100%</strong>
          </p>
          <Mock caption="ถ่ายใบเสร็จคู่กับใบปะหน้า → AI pair ให้เลย">
            <div className="flex gap-2 p-3">
              <div className="flex-1 rounded-xl border-2 border-emerald-300 bg-emerald-50 p-2 text-[9px]">
                <p className="font-bold">ใบเสร็จไปรษณีย์</p>
                <p className="mt-1 font-mono">OB050793909TH</p>
                <p>฿33.00</p>
              </div>
              <div className="flex-1 rounded-xl border-2 border-rose-300 bg-rose-50 p-2 text-[9px]">
                <p className="font-bold">ใบปะหน้า SalePage</p>
                <p className="mt-1 font-mono">#20260528-AB1Y2</p>
                <p>QR ▢</p>
              </div>
            </div>
          </Mock>
          <Tip>
            <strong>วิธีนี้แม่นยำ 100%</strong> — ใช้สำหรับทุก courier ก็ได้ ไม่ต้องเฉพาะไปรษณีย์ไทย
          </Tip>
        </Step>

        <Step n={4} title="กด 'เริ่มสแกน' — AI ประมวลผล 30 วินาที">
          <p>
            AI ใช้เวลาประมาณ 1-2 วินาทีต่อรูป — รอ progress แล้วระบบจะแสดงผลลัพธ์เป็น 3 กลุ่ม:
          </p>
          <ul className="ml-4 list-disc space-y-1 text-[13px]">
            <li>
              <strong className="text-emerald-700">จับคู่อัตโนมัติ</strong> — แม่นยำ ≥80% AI เลือกออเดอร์ให้แล้ว
            </li>
            <li>
              <strong className="text-amber-700">ต้องตรวจ</strong> — แม่น 40-79% โชว์ top 3 ตัวเลือก ให้คุณกดเลือก
            </li>
            <li>
              <strong className="text-zinc-600">ไม่เจอคู่</strong> — แม่น &lt;40% ให้คุณเลือกจาก dropdown ทุกออเดอร์
            </li>
          </ul>
        </Step>

        <Step n={5} title="ตรวจ + กด 'ใช้งานจริง'">
          <p>
            ตรวจรายการที่ AI ไม่มั่นใจ → กดยืนยันที่ละรายการ → ปุ่ม "ใช้งานจริง" ที่ด้านล่างจะ batch update ทุกออเดอร์พร้อมกัน
          </p>
          <Mock>
            <div className="p-3">
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-2.5">
                <CheckCircle2 className="size-4 text-emerald-700" />
                <div className="flex-1">
                  <p className="text-[11px] font-bold text-emerald-900">
                    พบใบเสร็จ 12 ใบ
                  </p>
                  <p className="text-[10px] text-emerald-800">
                    จับคู่อัตโนมัติ 10 · ต้องตรวจ 2 · ไม่เจอคู่ 0
                  </p>
                </div>
              </div>
              <div className="relative mt-3 flex items-center justify-between rounded-xl bg-white p-2 shadow-md">
                <p className="text-[11px] text-zinc-700">
                  จะอัปเดต <strong>12</strong> ออเดอร์
                </p>
                <MockButton>
                  <CheckCircle2 className="size-3.5" /> ใช้งานจริง
                </MockButton>
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
                  "กด 'ใช้งานจริง' ครั้งเดียว → ออเดอร์ทุกใบที่ตรวจแล้วเปลี่ยนเป็น 'รอส่ง' ลูกค้าได้ email + LINE",
              },
            ]}
          />
        </Step>
      </Steps>

      <Tip>
        <strong>มือถือก็ทำได้:</strong> เปิด SalePage app → Seller home → "Bulk Tracking" → กล้องเปิดถ่ายต่อเนื่อง snap-snap-snap — ใช้ logic เดียวกัน
      </Tip>
    </>
  );
}
