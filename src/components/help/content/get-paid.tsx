/* eslint-disable react/no-unescaped-entities */
import { Wallet, ShieldCheck } from "lucide-react";
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
} from "../help-primitives";

export function GetPaid() {
  return (
    <>
      <HelpHeader
        title="รับเงินตรง PromptPay"
        intro="เงินจากลูกค้าเข้าบัญชีคุณตรง 100% — SalePage ไม่แตะเงิน ไม่ผ่านคนกลาง ไม่หัก%"
      />

      <Note>
        <strong>นี่คือจุดเด่นของ SalePage</strong> — แตกต่างจาก Shopee/Lazada/TikTok Shop ที่กักเงินเอาไปทำ wallet ของพวกเขาเอง
      </Note>

      <Steps>
        <Step n={1} title="ใส่ PromptPay ในหน้าตั้งค่าร้าน">
          <p>
            ตอนเปิดร้านครั้งแรก หรือไปที่ "ตั้งค่า" → ใส่เบอร์มือถือที่ผูก PromptPay กับธนาคาร หรือเลขประจำตัวประชาชน 13 หลัก
          </p>
          <Mock>
            <div className="p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                การรับเงิน
              </p>
              <div className="relative mt-2">
                <span className="block w-full rounded-xl border-2 border-rose-300 bg-white p-2.5 font-mono text-[13px]">
                  081-234-5678
                </span>
                <Pin
                  n={1}
                  className="-right-2 -top-2"
                  style={{ position: "absolute" }}
                />
              </div>
              <p className="mt-2 text-[10.5px] text-zinc-500">
                เบอร์/ID นี้ต้องผูกกับบัญชีธนาคาร promptpay เรียบร้อยแล้ว
              </p>
            </div>
          </Mock>
          <Legend
            items={[
              {
                n: 1,
                label:
                  "ใส่เบอร์ที่ผูก promptpay กับบัญชีธนาคาร — ระบบใช้สร้าง QR ให้ลูกค้าโอน",
              },
            ]}
          />
        </Step>

        <Step n={2} title="ลูกค้าโอนเข้าบัญชีคุณตรง — ไม่ผ่านเรา">
          <p>
            ตอนลูกค้าจ่าย → ระบบสร้าง QR PromptPay ที่ generate จากเบอร์คุณ → ลูกค้าสแกนแอปธนาคาร → เงินเข้าบัญชี <strong>ของคุณ</strong> ทันที
          </p>
          <Mock>
            <div className="p-4">
              <div className="flex items-center gap-3">
                <div className="grid size-12 place-items-center rounded-xl bg-zinc-900 text-white">
                  <Wallet className="size-5" />
                </div>
                <div className="flex-1">
                  <p className="text-[12px] font-bold">฿290 → บัญชีร้าน</p>
                  <p className="mt-0.5 text-[10.5px] text-zinc-500">
                    ผ่าน PromptPay · ไม่หัก%
                  </p>
                </div>
                <ShieldCheck className="size-5 text-emerald-600" />
              </div>
            </div>
          </Mock>
        </Step>

        <Step n={3} title="ไม่ต้องถอนเงิน — เงินอยู่ในบัญชีตัวเองอยู่แล้ว">
          <p>
            ต่างจากแพลตฟอร์มอื่นที่เก็บเงินใน wallet ของพวกเขาแล้วให้คุณกดถอน — SalePage ไม่มีขั้นตอน "ถอนเงิน" เพราะเงินอยู่ในบัญชีคุณตั้งแต่ลูกค้าโอน
          </p>
          <Warn>
            <strong>ข้อแลกเปลี่ยน:</strong> ไม่มีบริการ Escrow โดยอัตโนมัติ (เงินไม่ถูกถือไว้กลาง) — ถ้าลูกค้าขอคืนเงิน ต้องโอนคืนจากบัญชีตัวเอง
          </Warn>
        </Step>

        <Step n={4} title="V1.5: บริการ Protected Pay (เลือกใช้ได้)">
          <p>
            ถ้าลูกค้าอยากมั่นใจมากขึ้น → ลูกค้ากดเลือก "Protected Pay" ตอน checkout → ระบบกักเงินไว้ใน escrow ของ SalePage จนกว่าลูกค้าจะกด "ยืนยันรับของ" → ระบบโอนให้คุณภายใน 72 ชั่วโมง
          </p>
          <Note>
            ลูกค้าจ่ายค่า escrow เพิ่ม 2% (~5 บาทขั้นต่ำ) — ร้านไม่เสียเงินเพิ่ม แต่ได้ความน่าเชื่อถือเพิ่ม
          </Note>
        </Step>
      </Steps>

      <Tip>
        <strong>FAQ:</strong> "เงินเข้ากี่นาที?" → ขึ้นกับธนาคารคุณ ปกติเข้าทันทีเมื่อลูกค้ากด confirm ในแอปธนาคารของพวกเขา · "ตรวจสลิปยังไง?" → AI ตรวจ 3 วิ (ดูคู่มือ Auto Slip)
      </Tip>
    </>
  );
}
