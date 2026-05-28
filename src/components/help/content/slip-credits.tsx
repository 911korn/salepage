/* eslint-disable react/no-unescaped-entities */
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

export function SlipCredits() {
  return (
    <>
      <HelpHeader
        title="เครดิตตรวจสลิป + โควต้ารายเดือน"
        intro="แผน Free/Starter ไม่มีโควต้าฟรี — ซื้อเครดิตเป็นแพ็คได้ · Pro+ ขึ้นไปได้รวมในแผน"
      />

      <Steps>
        <Step n={1} title="ดูโควต้าคงเหลือในหน้าตั้งค่า">
          <p>
            ไปที่ "ตั้งค่า" → เลื่อนลงไปที่หัวข้อ <strong>"เครดิตตรวจสลิป"</strong>
          </p>
          <Mock>
            <div className="space-y-2 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                เครดิตตรวจสลิป
              </p>
              <div className="rounded-xl border border-zinc-200 p-3">
                <div className="flex items-baseline justify-between">
                  <p className="text-[11px] text-zinc-500">โควต้ารายเดือน</p>
                  <p className="font-mono text-[13px] font-bold">300 / 300</p>
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <p className="text-[11px] text-zinc-500">เครดิตที่ซื้อ</p>
                  <p className="font-mono text-[13px] font-bold text-rose-700">
                    50
                  </p>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                  <div className="h-full w-3/5 bg-rose-500" />
                </div>
              </div>
            </div>
          </Mock>
        </Step>

        <Step n={2} title="ซื้อเครดิตเพิ่มเป็นแพ็ค">
          <p>
            กดปุ่ม <MockButton>ซื้อเครดิตเพิ่ม</MockButton> → เลือก pack ที่ต้องการ → ระบบพาไป Stripe checkout (รับ credit card / debit card)
          </p>
          <Mock>
            <div className="space-y-2 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                เลือกแพ็คเครดิต
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border-2 border-zinc-200 p-2.5">
                  <p className="text-[11px] font-bold">50 สลิป</p>
                  <p className="mt-0.5 font-mono text-[13px] font-bold text-rose-700">
                    ฿125
                  </p>
                  <p className="text-[10px] text-zinc-500">2.50 ฿/สลิป</p>
                </div>
                <div className="relative rounded-xl border-2 border-rose-300 bg-rose-50 p-2.5">
                  <p className="text-[11px] font-bold">500 สลิป</p>
                  <p className="mt-0.5 font-mono text-[13px] font-bold text-rose-700">
                    ฿950
                  </p>
                  <p className="text-[10px] text-zinc-500">1.90 ฿/สลิป</p>
                  <Pin
                    n={1}
                    className="-right-2 -top-2"
                    style={{ position: "absolute" }}
                  />
                </div>
                <div className="rounded-xl border border-zinc-200 p-2.5">
                  <p className="text-[11px] font-bold">1,500 สลิป</p>
                  <p className="mt-0.5 font-mono text-[13px] font-bold">
                    ฿2,550
                  </p>
                  <p className="text-[10px] text-zinc-500">1.70 ฿/สลิป</p>
                </div>
                <div className="rounded-xl border border-zinc-200 p-2.5">
                  <p className="text-[11px] font-bold">5,000 สลิป</p>
                  <p className="mt-0.5 font-mono text-[13px] font-bold">
                    ฿7,500
                  </p>
                  <p className="text-[10px] text-zinc-500">1.50 ฿/สลิป</p>
                </div>
              </div>
            </div>
          </Mock>
          <Legend
            items={[
              {
                n: 1,
                label:
                  "ยิ่งซื้อเยอะ ราคาต่อสลิปยิ่งถูก — pack ขนาด 500 เป็น sweet spot สำหรับร้านขนาดกลาง",
              },
            ]}
          />
          <Note>
            <strong>SalePage ออกค่าตรวจสลิปให้ครึ่ง</strong> — ราคา SlipOK ที่เราจ่ายจริงคือ ~5 ฿/สลิป เราออกให้ครึ่ง เหลือ 2.5 ฿ ต่อสลิป (แพ็คใหญ่สุดได้ที่ 1.5 ฿)
          </Note>
        </Step>

        <Step n={3} title="เครดิตหมดอายุเมื่อไหร่ — ตอบ: ไม่หมด">
          <p>
            เครดิตที่ซื้อ <strong>ไม่หมดอายุ</strong> — ใช้ได้ตลอดชีพของบัญชี (แต่ถ้าคุณยกเลิกบัญชี เครดิตหายไปด้วย)
          </p>
        </Step>

        <Step n={4} title="ลำดับการใช้: โควต้ารายเดือนก่อน → เครดิต">
          <p>
            ทุกครั้งที่ AI ตรวจสลิป — ระบบหักจากโควต้ารายเดือนก่อน (รีเซ็ตทุกวันที่ 1) → ถ้าหมดถึงหักจากเครดิตที่ซื้อ
          </p>
          <Tip>
            ระบบไม่หักเครดิตซ้ำสำหรับสลิปที่ "ไม่ใช่รูปสลิป" (AI pre-flight ปฏิเสธก่อนเรียก SlipOK) — ค่าใช้จ่ายส่วนนี้ SalePage ออกให้
          </Tip>
        </Step>
      </Steps>
    </>
  );
}
