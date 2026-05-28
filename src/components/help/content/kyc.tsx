/* eslint-disable react/no-unescaped-entities */
import { ShieldCheck } from "lucide-react";
import {
  HelpHeader,
  Steps,
  Step,
  Mock,
  Tip,
  Warn,
  Note,
} from "../help-primitives";

export function Kyc() {
  return (
    <>
      <HelpHeader
        title="ยืนยันตัวตน (KYC) สำหรับ Verified Badge"
        intro="ส่งบัตรประชาชน + เอกสาร → ได้ป้าย 'ร้านยืนยันแล้ว' สีน้ำเงินบนหน้าร้าน · เพิ่มความน่าเชื่อถือ"
      />

      <Note>
        <strong>ทำไมต้องยืนยัน?</strong> ลูกค้าจะเห็นป้าย ✓ บนชื่อร้าน — ลดความสงสัยว่าเป็นร้านปลอม + ยังช่วยเรื่อง refund/dispute เร็วขึ้น
      </Note>

      <Steps>
        <Step n={1} title="ไปที่ตั้งค่า → KYC">
          <p>
            ตั้งค่า → เลื่อนลงไปที่หัวข้อ "ยืนยันตัวตน" → กดปุ่ม "เริ่มยืนยัน"
          </p>
        </Step>

        <Step n={2} title="เลือกประเภทเอกสาร">
          <Mock>
            <div className="space-y-2 p-3">
              <div className="flex items-center gap-2 rounded-xl border-2 border-rose-300 bg-rose-50 p-2.5">
                <input type="radio" checked readOnly className="size-3" />
                <p className="text-[12px] font-bold">บัตรประชาชน</p>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-zinc-200 p-2.5">
                <input type="radio" readOnly className="size-3" />
                <p className="text-[12px]">Passport</p>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-zinc-200 p-2.5">
                <input type="radio" readOnly className="size-3" />
                <p className="text-[12px]">หนังสือจดทะเบียนบริษัท (สำหรับร้านที่เป็นนิติบุคคล)</p>
              </div>
            </div>
          </Mock>
        </Step>

        <Step n={3} title="ถ่ายรูปเอกสาร + selfie">
          <p>
            ระบบจะให้ถ่าย 2 รูป:
          </p>
          <ul className="ml-4 list-disc space-y-1 text-[13px]">
            <li>
              <strong>หน้าบัตร</strong> — เห็น ชื่อ-นามสกุล + เลขบัตร ชัดเจน
            </li>
            <li>
              <strong>Selfie ถือบัตร</strong> — ใบหน้าเห็นชัด + บัตรอยู่ในเฟรม
            </li>
          </ul>
          <Warn>
            <strong>ห้ามขีดทับ/ปิด</strong> เลขบัตรหรือรูปใบหน้า — admin ใช้ตรวจสอบ ถ้าตรวจไม่ได้จะ reject
          </Warn>
        </Step>

        <Step n={4} title="กดส่ง → รอ admin ตรวจ 1-2 วันทำการ">
          <p>
            สถานะจะเปลี่ยนจาก "PENDING" → "VERIFIED" (ผ่าน) หรือ "REJECTED" (มีปัญหา จะแจ้งเหตุผลให้แก้)
          </p>
          <Tip>
            <strong>กรณีถูก reject:</strong> ส่วนใหญ่เพราะรูปเบลอ หรือมุมถ่ายไม่ดี — ถ่ายใหม่ใต้แสงธรรมชาติ ส่งซ้ำได้
          </Tip>
        </Step>

        <Step n={5} title="ได้ป้าย Verified แล้ว">
          <Mock>
            <div className="p-3">
              <div className="flex items-center gap-2">
                <div className="grid size-9 place-items-center rounded-xl bg-rose-600 text-white">
                  ส
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    <p className="text-[12px] font-bold">สยามสแน็ค</p>
                    <ShieldCheck className="size-3.5 text-sky-600" />
                  </div>
                  <p className="text-[9.5px] text-zinc-500">
                    salepage.in.th/s/siam-snack
                  </p>
                </div>
              </div>
              <p className="mt-2 text-[10.5px] text-sky-700">
                ✓ ป้าย Verified จะขึ้นข้างชื่อร้าน ทุกที่ที่ลูกค้าเห็น
              </p>
            </div>
          </Mock>
        </Step>
      </Steps>
    </>
  );
}
