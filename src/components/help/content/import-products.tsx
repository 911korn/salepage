/* eslint-disable react/no-unescaped-entities */
import { Link, Sparkles, CheckCircle2 } from "lucide-react";
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

export function ImportProducts() {
  return (
    <>
      <HelpHeader
        title="นำเข้าสินค้าจาก Shopee / Lazada"
        intro="วางลิงก์ร้านเดิมของคุณ — AI ดึงสินค้าทุกชิ้นเข้ามาให้พร้อมรูป ราคา รายละเอียด ไม่ต้องเพิ่มทีละชิ้น"
      />

      <Steps>
        <Step n={1} title="ไปที่เมนู 'นำเข้าสินค้า' (icon ลูกศรลง)">
          <p>
            ในหลังบ้าน กดเมนู <strong>'นำเข้าสินค้า'</strong> ที่แถบซ้าย — หรือกดปุ่ม "นำเข้าสินค้า Auto" บนหน้าหลัก
          </p>
          <Mock>
            <div className="p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                เครื่องมือนำเข้า
              </p>
              <div className="relative mt-2 grid grid-cols-2 gap-2">
                <div className="rounded-2xl border-2 border-rose-300 bg-rose-50 p-3">
                  <Link className="size-5 text-rose-700" />
                  <p className="mt-2 text-[12px] font-bold">วางลิงก์ร้าน</p>
                  <p className="mt-0.5 text-[10px] text-zinc-600">
                    Shopify · TikTok Shop · เว็บอะไรก็ได้
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-3">
                  <p className="text-[12px] font-bold">อัปไฟล์ CSV</p>
                  <p className="mt-0.5 text-[10px] text-zinc-600">
                    Export จาก Seller Center
                  </p>
                </div>
                <Pin
                  n={1}
                  className="-left-2 -top-2"
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
                  "วิธีนี้ง่ายที่สุด — แค่วางลิงก์ร้าน AI ทำที่เหลือให้",
              },
            ]}
          />
        </Step>

        <Step n={2} title="วางลิงก์ร้าน — รองรับทุกแพลตฟอร์ม">
          <p>
            ก๊อปลิงก์จากหน้าแอป/เว็บ — วางในช่อง URL ของเรา AI จะไปเปิดเว็บนั้น ดึงรายการสินค้าทั้งหมดมาให้ ปกติใช้เวลา 30 วินาที — 2 นาที
          </p>
          <Mock>
            <div className="space-y-3 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                วางลิงก์ร้านเดิม
              </p>
              <div className="relative">
                <span className="block w-full rounded-xl border-2 border-rose-300 bg-white p-2.5 font-mono text-[11px] text-zinc-700">
                  https://your-shop.example.com
                </span>
                <Pin
                  n={1}
                  className="-right-2 -top-2"
                  style={{ position: "absolute" }}
                />
              </div>
              <div className="relative">
                <MockButton className="w-full justify-center">
                  <Sparkles className="size-3.5" /> ดึงสินค้าทั้งหมด
                </MockButton>
                <Pin
                  n={2}
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
                  "วางได้ทั้งลิงก์หน้าร้าน (จะดึงทุกสินค้า) หรือลิงก์สินค้าชิ้นเดียว",
              },
              {
                n: 2,
                label: "กดแล้วรอสักครู่ — AI กำลังเปิดเว็บเพื่อดูสินค้า",
              },
            ]}
          />
          <Note>
            <strong>รองรับ:</strong> Shopify · TikTok Shop · WooCommerce ·
            BigCommerce · เว็บที่ใช้ Open Graph / JSON-LD ทั่วไป
          </Note>
        </Step>

        <Step n={3} title="ตรวจ Preview ก่อนกดยืนยัน">
          <p>
            หลัง AI ดึงสินค้ามาแล้ว ระบบโชว์ตัวอย่างให้ดูทุกชิ้น — รูป, ชื่อ, ราคา, รายละเอียด คุณจะ:
          </p>
          <ul className="ml-4 list-disc space-y-1 text-[13px]">
            <li>แก้ราคา / ชื่อให้ตรงกับร้านใหม่</li>
            <li>เลือกเฉพาะสินค้าที่อยากนำเข้า (uncheck ไม่อยากได้)</li>
            <li>หรือนำเข้าทั้งหมดก็ได้</li>
          </ul>
          <Mock>
            <div className="space-y-2 p-3">
              <p className="text-[11px] font-bold text-zinc-700">
                พบสินค้า 6 ชิ้น
              </p>
              <div className="relative space-y-1.5">
                {[
                  { name: "ข้าวตัง สูตรโบราณ", price: "60" },
                  { name: "ทองหยิบเซต 9 ชิ้น", price: "290" },
                  { name: "ลอดช่อง กะทิสด", price: "89" },
                ].map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-xl border border-zinc-200 p-2"
                  >
                    <span className="block size-8 rounded bg-gradient-to-br from-yellow-200 to-amber-400" />
                    <div className="flex-1">
                      <p className="text-[11px] font-semibold">{p.name}</p>
                      <p className="font-mono text-[10px] text-zinc-500">
                        ฿{p.price}
                      </p>
                    </div>
                    <CheckCircle2 className="size-4 text-emerald-600" />
                  </div>
                ))}
                <Pin
                  n={1}
                  className="-right-2 -top-2"
                  style={{ position: "absolute" }}
                />
              </div>
              <MockButton className="w-full justify-center">
                นำเข้าทั้งหมด (6 ชิ้น)
              </MockButton>
            </div>
          </Mock>
          <Legend
            items={[
              {
                n: 1,
                label:
                  "เครื่องหมายถูก = สินค้าที่จะนำเข้า · กดออกถ้าไม่อยากเอาตัวนั้น",
              },
            ]}
          />
        </Step>

        <Step n={4} title="กดยืนยัน — สินค้าเข้าร้านทันที">
          <p>
            สินค้าทุกชิ้นจะเข้าหน้า <strong>"สินค้า"</strong> ของคุณในสถานะ "ร่าง" — ค่อยๆ ทยอยกดเผยแพร่ทีละชิ้น หรือกดทีเดียวทั้งหมดที่ปุ่มด้านบน
          </p>
          <Tip>
            <strong>สินค้าเยอะมาก?</strong> นำเข้าได้แบบ batch — สูงสุด 100 ชิ้นต่อรอบ ถ้าร้านเดิมมีเป็นพันชิ้น ทำเป็นรอบๆ ก็ได้
          </Tip>
        </Step>
      </Steps>

      <Note>
        <strong>ไฟล์ CSV ก็ได้:</strong> ถ้ามี export file จาก Shopee Seller
        Center / Lazada / Excel ก็อัปขึ้นได้ — ระบบเดาคอลัมน์ให้ และคุณสามารถแก้
        mapping ก่อน commit
      </Note>
    </>
  );
}
