/* eslint-disable react/no-unescaped-entities */
import {
  HelpHeader,
  Steps,
  Step,
  Mock,
  Tip,
  Note,
} from "../help-primitives";

export function Chat() {
  return (
    <>
      <HelpHeader
        title="แชทกับลูกค้า (Business+)"
        intro="รวมแชททุกออเดอร์ในที่เดียว — ตอบจากเดสก์ท็อปหรือมือถือ ส่งภาพ + ข้อความได้"
      />

      <Note>
        <strong>Business+ เท่านั้น</strong> — ดูคู่มือ "แผน" ถ้ายังไม่อัปเกรด
      </Note>

      <Steps>
        <Step n={1} title="ลูกค้าเริ่มแชทยังไง">
          <p>
            ในหน้าออเดอร์ของลูกค้า มีปุ่ม "แชทกับร้าน" — กดแล้วเปิดหน้าต่างแชทในระบบของเรา (ไม่ออกจากเว็บ)
          </p>
        </Step>

        <Step n={2} title="เข้าเมนูแชทจาก dashboard">
          <p>
            ในเครื่องมือ → กด "แชทลูกค้า" → เห็นรายการแชททั้งหมด มี badge แสดงข้อความที่ยังไม่ตอบ
          </p>
          <Mock>
            <div className="divide-y divide-zinc-100">
              <div className="flex items-center gap-2 bg-rose-50 p-3">
                <div className="grid size-8 place-items-center rounded-full bg-rose-600 text-[11px] font-bold text-white">
                  ก
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-bold">กิตติกร ทวีผล</p>
                  <p className="truncate text-[10.5px] text-zinc-500">
                    สวัสดีครับ สอบถามเรื่องส่ง...
                  </p>
                </div>
                <span className="rounded-full bg-rose-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
                  2
                </span>
              </div>
              <div className="flex items-center gap-2 p-3">
                <div className="grid size-8 place-items-center rounded-full bg-zinc-300 text-[11px] font-bold text-white">
                  ว
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-bold">วิภาวี ใจดี</p>
                  <p className="truncate text-[10.5px] text-zinc-500">
                    ขอบคุณค่ะ
                  </p>
                </div>
              </div>
            </div>
          </Mock>
        </Step>

        <Step n={3} title="ตอบจากมือถือก็ได้">
          <p>
            เปิด SalePage app บนมือถือ → tab "แชท" → ทุกข้อความ sync แบบ real-time ระหว่างมือถือ + เว็บ
          </p>
          <Tip>
            <strong>Push notification</strong> — เปิดสิทธิ์ใน iOS Settings → แอปจะส่ง notification ทุกครั้งที่มีข้อความใหม่
          </Tip>
        </Step>

        <Step n={4} title="ส่งภาพ + ข้อความ">
          <p>
            กดไอคอนคลิป 📎 → เลือกรูปจากเครื่อง → ส่ง พร้อมพิมพ์ข้อความได้ ตัวอย่าง use case:
          </p>
          <ul className="ml-4 list-disc space-y-1 text-[13px]">
            <li>ลูกค้าขอดูรูปสินค้าเพิ่ม — ส่งรูปสินค้าใน stock</li>
            <li>ลูกค้าถามว่าส่งของไปไหน — ส่งภาพหน้าใบปะหน้า</li>
            <li>ลูกค้าขอใบเสร็จ — ส่งรูปสลิปหรือใบเสร็จ courier</li>
          </ul>
        </Step>
      </Steps>
    </>
  );
}
