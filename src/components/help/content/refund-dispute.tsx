/* eslint-disable react/no-unescaped-entities */
import { AlertCircle } from "lucide-react";
import {
  HelpHeader,
  Steps,
  Step,
  Mock,
  Tip,
  Warn,
  Note,
} from "../help-primitives";

export function RefundDispute() {
  return (
    <>
      <HelpHeader
        title="ยกเลิก / คืนเงิน / แก้ปัญหากับลูกค้า"
        intro="ลูกค้าขอคืน · ของไม่ตรง · ส่งผิด — จัดการยังไงให้จบเรื่อง"
      />

      <Steps>
        <Step n={1} title="ยกเลิกออเดอร์ (ก่อนส่งของ)">
          <p>
            ถ้ายังไม่ได้ส่ง — เปิดออเดอร์ → กดปุ่ม "ยกเลิกออเดอร์" ที่ด้านล่าง → ระบบจะ:
          </p>
          <ul className="ml-4 list-disc space-y-1 text-[13px]">
            <li>เปลี่ยนสถานะเป็น "ยกเลิก"</li>
            <li>คืนสต็อกสินค้า</li>
            <li>แจ้งลูกค้าทาง email + LINE</li>
            <li>
              <strong>คุณต้องโอนเงินคืนลูกค้าเอง</strong> (เพราะเงินอยู่ในบัญชีคุณตั้งแต่ลูกค้าโอน)
            </li>
          </ul>
          <Warn>
            <strong>โอนคืน promptpay</strong> — ใช้เบอร์เดียวกับที่ลูกค้าโอนมา (ดูได้จาก slip ในออเดอร์) → ส่ง screenshot ของการโอนคืนให้ลูกค้าทาง LINE/chat
          </Warn>
        </Step>

        <Step n={2} title="ลูกค้าได้รับสินค้าแล้ว แต่มีปัญหา">
          <p>
            ขั้นตอนตามลำดับ:
          </p>
          <ol className="ml-4 list-decimal space-y-1.5 text-[13px]">
            <li>คุยกับลูกค้าใน LINE / chat ก่อน — เข้าใจว่าปัญหาคืออะไร</li>
            <li>ถ้าจะ refund บางส่วน → โอนเงินคืน + ปิดจบ</li>
            <li>ถ้าจะส่งของชิ้นใหม่ → สร้างออเดอร์ใหม่ (free shipping) → ส่งซ้ำ</li>
            <li>
              ถ้าลูกค้าไม่ยอม + จะร้องเรียน → แนะให้กดปุ่ม "เปิดข้อพิพาท" ในหน้าออเดอร์ → admin SalePage ช่วยตัดสิน
            </li>
          </ol>
        </Step>

        <Step n={3} title="ระบบ Protected Pay (Escrow) ทำงานยังไง">
          <p>
            ถ้าลูกค้าเลือก "Protected Pay" ตอน checkout → เงินจะกักไว้ใน escrow ของ SalePage จนกว่า:
          </p>
          <Mock>
            <div className="space-y-2 p-3 text-[11.5px]">
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-2">
                <span className="grid size-5 place-items-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">
                  ✓
                </span>
                <p>ลูกค้ากด "ยืนยันรับของ" → ระบบโอนให้ร้านภายใน 72 ชั่วโมง</p>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-sky-50 p-2">
                <span className="grid size-5 place-items-center rounded-full bg-sky-600 text-[10px] font-bold text-white">
                  ⏱
                </span>
                <p>
                  Auto-release หลัง 7 วันจาก DELIVERED (ลูกค้าลืมกด)
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-2">
                <AlertCircle className="size-4 text-rose-700" />
                <p>
                  ลูกค้าเปิด dispute → เงินค้าง จนกว่า admin ตัดสิน
                </p>
              </div>
            </div>
          </Mock>
        </Step>

        <Step n={4} title="เปิด dispute → admin ตรวจสอบ">
          <p>
            ลูกค้าเปิด dispute โดย: ไปที่หน้าออเดอร์ → กด "มีปัญหากับออเดอร์นี้" → กรอกเหตุผล + แนบหลักฐาน (รูปสินค้าที่ได้รับ, รูป packaging แตก, ฯลฯ)
          </p>
          <p>
            <strong>คุณจะได้รับแจ้ง</strong> ทาง email + LINE → เข้าหลังบ้าน /dashboard → ตอบ dispute ภายใน 48 ชั่วโมง พร้อมแนบหลักฐานจากร้าน (รูปก่อนส่ง, รูปใบเสร็จ, chat history)
          </p>
        </Step>

        <Step n={5} title="ผลการตัดสินของ admin">
          <p>3 ทางออก:</p>
          <ul className="ml-4 list-disc space-y-1 text-[13px]">
            <li>
              <strong className="text-emerald-700">ร้านชนะ</strong> — escrow โอนเข้าร้านเต็มจำนวน
            </li>
            <li>
              <strong className="text-amber-700">แบ่งครึ่ง</strong> — escrow คืนลูกค้าครึ่ง · โอนร้านครึ่ง
            </li>
            <li>
              <strong className="text-rose-700">ลูกค้าชนะ</strong> — escrow คืนลูกค้าเต็มจำนวน + ร้านถูกแจ้ง "complaint" ในประวัติ
            </li>
          </ul>
          <Note>
            <strong>ป้องกันความเสียหาย:</strong> ถ่ายรูป packaging + สินค้าก่อนส่งทุกครั้ง → เก็บไว้ใน chat กับลูกค้า → ใช้ตอน dispute
          </Note>
        </Step>
      </Steps>

      <Tip>
        <strong>ติดปัญหายาก?</strong> แชทกับเราที่ LINE @salepage → ทีมจะช่วย investigate ออเดอร์ + แนะนำ
      </Tip>
    </>
  );
}
