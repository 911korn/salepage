/* eslint-disable react/no-unescaped-entities */
import { ImagePlus } from "lucide-react";
import {
  HelpHeader,
  Steps,
  Step,
  Mock,
  Pin,
  Legend,
  Tip,
  Warn,
  MockButton,
} from "../help-primitives";

export function ShopSettings() {
  return (
    <>
      <HelpHeader
        title="ตั้งค่าร้าน"
        intro="แต่งหน้าร้านให้น่าเชื่อถือ — อัปโลโก้ + แบนเนอร์ ตั้งสีธีม ใส่ที่อยู่ผู้ส่ง ช่องทางติดต่อ"
      />

      <Steps>
        <Step n={1} title="เข้าหน้า 'ตั้งค่า' จากเมนูซ้าย">
          <p>
            ในหลังบ้าน กด <strong>'ตั้งค่า'</strong> ที่เมนูซ้าย
            (ไอคอนรูปเฟือง) — หน้านี้รวมทุกอย่างของร้านไว้ ตั้งแต่โลโก้ถึง PromptPay
          </p>
          <Mock>
            <div className="flex">
              <div className="w-32 border-r border-zinc-100 bg-zinc-50 p-2 text-[11px]">
                <p className="px-2 py-1 text-zinc-500">ภาพรวม</p>
                <p className="px-2 py-1 text-zinc-500">ออเดอร์</p>
                <p className="px-2 py-1 text-zinc-500">สินค้า</p>
                <div className="relative">
                  <p className="rounded-lg bg-rose-50 px-2 py-1 font-semibold text-rose-700">
                    ตั้งค่า ⚙
                  </p>
                  <Pin
                    n={1}
                    className="-right-3 top-0"
                    style={{ position: "absolute" }}
                  />
                </div>
              </div>
              <div className="flex-1 p-4">
                <p className="text-[11px] text-zinc-500">หลังบ้าน</p>
              </div>
            </div>
          </Mock>
          <Legend items={[{ n: 1, label: "เมนู 'ตั้งค่า' — ไอคอนเฟือง" }]} />
        </Step>

        <Step n={2} title="อัปโลโก้ + แบนเนอร์">
          <p>
            ในหัวข้อ "Branding" จะเห็นช่องอัปโลโก้ (วงกลม) และแบนเนอร์ (สี่เหลี่ยมยาว)
            กดที่กรอบเพื่อเลือกรูปจากเครื่อง
          </p>
          <Mock>
            <div className="relative p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                Branding
              </p>
              <div className="mt-3 flex items-center gap-3">
                <div className="relative">
                  <div className="grid size-16 place-items-center rounded-full border-2 border-dashed border-zinc-300 bg-zinc-50">
                    <ImagePlus className="size-5 text-zinc-400" />
                  </div>
                  <Pin
                    n={1}
                    className="-right-2 -top-2"
                    style={{ position: "absolute" }}
                  />
                </div>
                <div className="relative flex-1">
                  <div className="grid h-16 place-items-center rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50">
                    <ImagePlus className="size-5 text-zinc-400" />
                  </div>
                  <Pin
                    n={2}
                    className="-right-2 -top-2"
                    style={{ position: "absolute" }}
                  />
                </div>
              </div>
            </div>
          </Mock>
          <Legend
            items={[
              {
                n: 1,
                label:
                  "โลโก้ — ขนาดสี่เหลี่ยม 256×256 px ก็พอ (ระบบ crop เป็นวงกลมให้)",
              },
              {
                n: 2,
                label:
                  "แบนเนอร์ — ภาพยาวอัตราส่วน 16:5 ขึ้นบนหน้าร้าน (~1600×500 px)",
              },
            ]}
          />
          <Tip>
            <strong>ไม่มีโลโก้?</strong> ใช้ตัวอักษรย่อ + สีพื้นแบรนด์ก็ได้ — ระบบจะสร้างให้ทันทีจากชื่อร้านของคุณ
          </Tip>
        </Step>

        <Step n={3} title="เลือกสีธีม (Theme color)">
          <p>
            สีนี้จะใช้กับปุ่ม "ซื้อเลย" + ไอคอนเด่นๆ บนหน้าร้านลูกค้า — เลือกสีที่เข้ากับโลโก้
          </p>
          <Mock>
            <div className="p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                สีธีม
              </p>
              <div className="relative mt-3 flex flex-wrap gap-2">
                {[
                  "#e11d48",
                  "#f97316",
                  "#eab308",
                  "#22c55e",
                  "#3b82f6",
                  "#8b5cf6",
                  "#ec4899",
                ].map((c) => (
                  <span
                    key={c}
                    className="block size-8 rounded-full ring-2 ring-white"
                    style={{ background: c }}
                  />
                ))}
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
                  "กดสีที่ชอบ — จะเปลี่ยนทันทีบนหน้าร้านลูกค้า (ดูตัวอย่างได้เลย)",
              },
            ]}
          />
        </Step>

        <Step n={4} title="ใส่ที่อยู่ผู้ส่ง (สำคัญสำหรับการส่งของ)">
          <p>
            ในหัวข้อ <strong>"ที่อยู่ผู้ส่ง"</strong> ใส่ที่อยู่ที่ใช้ในใบปะหน้าพัสดุ —
            ต้องครบทั้งที่อยู่ + รหัสไปรษณีย์ 5 หลัก
          </p>
          <Mock>
            <div className="space-y-2 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                ที่อยู่ผู้ส่ง
              </p>
              <div className="relative">
                <span className="block w-full rounded-xl border-2 border-rose-300 bg-white p-2.5 text-[12px]">
                  123/45 ถ.สุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ
                </span>
                <Pin
                  n={1}
                  className="-right-2 -top-2"
                  style={{ position: "absolute" }}
                />
              </div>
              <div className="relative grid grid-cols-2 gap-2">
                <span className="block rounded-xl border border-zinc-200 p-2.5 font-mono text-[12px] text-zinc-700">
                  10110
                </span>
                <span className="block rounded-xl border border-zinc-200 p-2.5 font-mono text-[12px] text-zinc-700">
                  081-234-5678
                </span>
                <Pin
                  n={2}
                  className="-left-2 -top-2"
                  style={{ position: "absolute" }}
                />
                <Pin
                  n={3}
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
                  "ที่อยู่เต็ม — ใส่บ้านเลขที่ ซอย/ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด",
              },
              { n: 2, label: "รหัสไปรษณีย์ 5 หลัก (ต้องตรง)" },
              { n: 3, label: "เบอร์โทรของผู้ส่ง (courier ใช้ติดต่อหากมีปัญหา)" },
            ]}
          />
          <Warn>
            <strong>จำเป็น!</strong> ระบบจะไม่ให้พิมพ์ใบปะหน้าถ้ายังไม่ใส่ที่อยู่ผู้ส่ง — และ courier ปฏิเสธพัสดุที่ไม่มีที่อยู่ผู้ส่งครบ
          </Warn>
        </Step>

        <Step n={5} title="ใส่ช่องทางติดต่อ (LINE / Facebook / Tel)">
          <p>
            หน้าร้านจะแสดงปุ่ม "แชทกับร้าน" — ลูกค้ากดแล้วเปิด LINE OA / Facebook page / โทรหาเราตรงได้ทันที
          </p>
          <Mock>
            <div className="space-y-2 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                ช่องทางติดต่อลูกค้า
              </p>
              <div className="relative grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-zinc-200 p-2 text-center">
                  <p className="text-[10.5px] font-semibold">LINE OA</p>
                  <p className="mt-1 font-mono text-[10px] text-zinc-500">
                    @siamsnack
                  </p>
                </div>
                <div className="rounded-xl border border-zinc-200 p-2 text-center">
                  <p className="text-[10.5px] font-semibold">Facebook</p>
                  <p className="mt-1 font-mono text-[10px] text-zinc-500">
                    /siamsnack
                  </p>
                </div>
                <div className="rounded-xl border border-zinc-200 p-2 text-center">
                  <p className="text-[10.5px] font-semibold">โทร</p>
                  <p className="mt-1 font-mono text-[10px] text-zinc-500">
                    08x-xxx-xxxx
                  </p>
                </div>
                <Pin
                  n={1}
                  className="-top-2 left-1/2"
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
                  "ใส่อย่างน้อย 1 ช่อง — แนะนำ LINE OA เพราะลูกค้าไทยใช้บ่อยสุด",
              },
            ]}
          />
        </Step>

        <Step n={6} title="กดบันทึก — เปลี่ยนทันที">
          <p>
            กดปุ่ม <MockButton>บันทึก</MockButton> ที่ด้านล่าง — การเปลี่ยนแปลงทุกอย่างจะมีผลทันทีบนหน้าร้านลูกค้า เปลี่ยนกี่ครั้งก็ได้ ไม่มี cooldown
          </p>
        </Step>
      </Steps>

      <Tip>
        ขั้นต่อไป: ไปคู่มือ <em>"เพิ่มสินค้าใหม่"</em> ใส่สินค้าชิ้นแรกเข้าร้าน
      </Tip>
    </>
  );
}
