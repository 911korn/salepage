/* eslint-disable react/no-unescaped-entities */
import { Sparkles } from "lucide-react";
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

export function PrintLabelShip() {
  return (
    <>
      <HelpHeader
        title="พิมพ์ใบปะหน้า + ส่งของ"
        intro="หลังลูกค้าจ่ายเงิน — พิมพ์ใบปะหน้าของเรา → ติดที่กล่อง → drop ที่ courier ไหนก็ได้ → ถ่ายรูปใบเสร็จกลับเข้าระบบ AI ใส่เลข tracking ให้ทันที"
      />

      <Note>
        <strong>Business+ เท่านั้น</strong> สำหรับฟีเจอร์พิมพ์ใบปะหน้า + AI tracking — แผนอื่นใส่เลข tracking ด้วยมือได้ปกติ
      </Note>

      <Steps>
        <Step n={1} title="เข้าหน้าออเดอร์ที่ 'จ่ายแล้ว'">
          <p>
            จาก dashboard กดเมนู "ออเดอร์" → filter "รอส่ง" → กดที่ออเดอร์ใดออเดอร์หนึ่งเพื่อเปิดรายละเอียด
          </p>
        </Step>

        <Step n={2} title="กด 'เปิดใบปะหน้า' — พิมพ์ลงกระดาษ A6">
          <p>
            ในกล่องเครื่องมือจัดส่ง จะมีปุ่มสีรอส <MockButton>เปิดใบปะหน้า</MockButton> — กดแล้วเปิด tab ใหม่ที่มีใบปะหน้าพร้อมพิมพ์
          </p>
          <Mock>
            <div className="relative p-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                ใบปะหน้า · Order #20260528-AB1Y2
              </p>
              <div className="mt-2 rounded-xl border-2 border-zinc-300 p-3 font-mono text-[10px]">
                <p className="font-bold text-zinc-900">SalePage</p>
                <p className="mt-2 text-zinc-500">จาก:</p>
                <p>สยามสแน็ค · 081-234-5678</p>
                <p className="mt-2 text-zinc-500">ถึง:</p>
                <p>กิตติกร ทวีผล</p>
                <p>3/25 ต.บางพระ จ.ตราด 23000</p>
                <p>0863273566</p>
                <div className="mt-2 grid place-items-center">
                  <span className="block size-12 bg-zinc-900" />
                </div>
                <p className="text-center text-[8px]">
                  salepage.in.th/o/zMsbJ3o...
                </p>
              </div>
              <Pin
                n={1}
                className="-right-2 -top-2"
                style={{ position: "absolute" }}
              />
            </div>
          </Mock>
          <Legend
            items={[
              {
                n: 1,
                label:
                  "ใบปะหน้ามีทุกอย่างที่ courier ต้อง: ที่อยู่ผู้ส่ง+ผู้รับ + QR ติดตาม",
              },
            ]}
          />
          <Tip>
            <strong>ใช้เครื่องพิมพ์อะไรก็ได้</strong> — A6 ปกติ, thermal label, ติด tape ใส่กล่อง — ไม่ต้องใช้ pre-printed sticker
          </Tip>
        </Step>

        <Step n={3} title="ติดที่กล่อง → drop ที่ courier">
          <p>
            ใบปะหน้านี้ใช้กับ courier <strong>ทุกเจ้า</strong> — Flash, Kerry, J&T, ไปรษณีย์ไทย, SCG, Best — เลือกร้านใกล้บ้าน drop พร้อมจ่ายค่าส่ง courier จะให้ใบเสร็จกลับมา
          </p>
          <Warn>
            <strong>เก็บใบเสร็จไว้</strong> — มีเลข tracking ที่จะใช้ในขั้นถัดไป
          </Warn>
        </Step>

        <Step n={4} title="ถ่ายรูปใบเสร็จกลับเข้าระบบ — AI กรอกเลขให้">
          <p>
            กลับมาที่หน้าออเดอร์เดิม → กดปุ่ม <MockButton>อัปโหลดรูปใบเสร็จ</MockButton> → AI จะอ่านเลข tracking + ชื่อผู้รับจากรูป ตรวจให้ตรงกับออเดอร์ แล้ว update ให้ทันที
          </p>
          <Mock>
            <div className="p-3">
              <div className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3">
                <Sparkles className="mt-0.5 size-4 text-emerald-700" />
                <div className="flex-1">
                  <p className="text-[12px] font-bold text-emerald-900">
                    AI scan สำเร็จ
                  </p>
                  <p className="mt-1 font-mono text-[11px] font-bold text-zinc-900">
                    OB050793909TH
                  </p>
                  <p className="mt-1 text-[10.5px] text-emerald-800">
                    ไปรษณีย์ไทย · ผู้รับตรง · ออเดอร์ส่งไปแล้ว
                  </p>
                </div>
              </div>
            </div>
          </Mock>
          <Note>
            <strong>ใบเสร็จไม่มีชื่อ?</strong> (ไปรษณีย์ไทย eCo, J&T economy ไม่พิมพ์ชื่อ) → ระบบจะขึ้น "ขอยืนยัน" ให้คุณเช็คเอง — กดยืนยันถ้าถูกแน่นอน
          </Note>
        </Step>

        <Step n={5} title="ลูกค้าได้รับ email + LINE ทันที">
          <p>
            พอเลข tracking เข้าระบบ ลูกค้าจะได้:
          </p>
          <ul className="ml-4 list-disc space-y-1 text-[13px]">
            <li>Email พร้อมเลข tracking + ลิงก์ติดตามที่ courier</li>
            <li>LINE push (ถ้าผูก LINE OA ไว้)</li>
            <li>หน้าออเดอร์อัปเดตเป็น "รอส่ง" → "ระหว่างทาง"</li>
          </ul>
        </Step>

        <Step n={6} title="ลูกค้าได้รับสินค้าแล้ว — ปิดออเดอร์">
          <p>
            ลูกค้าจะกดปุ่ม "ยืนยันรับของแล้ว" ในหน้าออเดอร์ของตัวเอง → ออเดอร์เปลี่ยนเป็น "DELIVERED" — หรือถ้าลูกค้าลืมกด ระบบ auto-release หลัง 7 วัน
          </p>
        </Step>
      </Steps>

      <Tip>
        <strong>ส่งทีละ 100 ออเดอร์?</strong> ดูคู่มือ <em>"AI Bulk Tracking"</em> — ถ่ายใบเสร็จทั้งกองในรอบเดียว AI จับคู่ให้ทุกออเดอร์
      </Tip>
    </>
  );
}
