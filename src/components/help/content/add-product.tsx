/* eslint-disable react/no-unescaped-entities */
import { Camera, Tag } from "lucide-react";
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

export function AddProduct() {
  return (
    <>
      <HelpHeader
        title="เพิ่มสินค้าใหม่"
        intro="เพิ่มสินค้าทีละชิ้น — ใส่ชื่อ ราคา รูป รายละเอียด เผยแพร่ขายได้ทันที"
      />

      <Steps>
        <Step n={1} title="กดปุ่ม 'เพิ่มสินค้าใหม่' ที่หน้าหลัก">
          <p>
            ในหน้าหลังบ้าน (Dashboard) จะเห็นปุ่มสีแดงใหญ่ๆ ด้านบนเขียนว่า{" "}
            <strong>'เพิ่มสินค้าใหม่'</strong> — กดได้เลย หรือไปที่เมนู "สินค้า"
            แล้วกด "+ สินค้าใหม่" ก็ได้
          </p>
          <Mock>
            <div className="relative p-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-rose-600 p-3 text-white">
                  <p className="text-[12px] font-bold">+ เพิ่มสินค้าใหม่</p>
                  <p className="mt-0.5 text-[10px] opacity-80">
                    พิมพ์ชื่อ · ใส่ราคา
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 p-3" />
              </div>
              <Pin
                n={1}
                className="-top-2 left-12"
                style={{ position: "absolute" }}
              />
            </div>
          </Mock>
          <Legend items={[{ n: 1, label: "ปุ่มสีแดง 'เพิ่มสินค้าใหม่'" }]} />
        </Step>

        <Step n={2} title="ใส่ชื่อ + ราคา (ขั้นต่ำที่ต้องมี)">
          <p>
            ในหน้าเพิ่มสินค้า อย่างน้อยต้องใส่ <strong>2 ช่อง</strong> ก็ขายได้แล้ว:
            ชื่อสินค้า + ราคา ที่เหลือใส่ทีหลังได้
          </p>
          <Mock>
            <div className="space-y-3 p-4">
              <div>
                <p className="text-[10.5px] font-semibold text-zinc-500">
                  ชื่อสินค้า
                </p>
                <div className="relative mt-1">
                  <span className="block rounded-xl border-2 border-rose-300 bg-white p-2.5 text-[13px] font-semibold">
                    ข้าวตัง สูตรโบราณ
                  </span>
                  <Pin
                    n={1}
                    className="-right-2 -top-2"
                    style={{ position: "absolute" }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10.5px] font-semibold text-zinc-500">
                    ราคา (บาท)
                  </p>
                  <div className="relative mt-1">
                    <span className="block rounded-xl border-2 border-rose-300 bg-white p-2.5 font-mono text-[13px]">
                      60
                    </span>
                    <Pin
                      n={2}
                      className="-right-2 -top-2"
                      style={{ position: "absolute" }}
                    />
                  </div>
                </div>
                <div>
                  <p className="text-[10.5px] font-semibold text-zinc-500">
                    ราคาเปรียบเทียบ (option)
                  </p>
                  <div className="mt-1">
                    <span className="block rounded-xl border border-zinc-200 p-2.5 font-mono text-[13px] text-zinc-400">
                      80
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Mock>
          <Legend
            items={[
              { n: 1, label: "ชื่อสินค้า — ใส่ให้สั้นและชัด (1-2 บรรทัด)" },
              {
                n: 2,
                label:
                  "ราคา — ใส่เฉพาะตัวเลข ไม่ต้องใส่ ฿/บาท (ราคาเปรียบเทียบใช้แสดงเป็นราคา 'ขีดทิ้ง' ตอนลดราคา)",
              },
            ]}
          />
        </Step>

        <Step n={3} title="อัปรูปสินค้า (สำคัญมาก!)">
          <p>
            กดที่ช่องว่างด้านล่างเพื่อเลือกรูปจากเครื่อง — เพิ่มได้สูงสุด 6 รูป ลากเรียงสลับลำดับได้
          </p>
          <Mock>
            <div className="p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                รูปสินค้า
              </p>
              <div className="relative mt-2 grid grid-cols-3 gap-2">
                <div className="aspect-square rounded-xl bg-gradient-to-br from-yellow-200 to-amber-400" />
                <div className="aspect-square rounded-xl bg-gradient-to-br from-emerald-200 to-emerald-400" />
                <div className="grid aspect-square place-items-center rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50">
                  <Camera className="size-5 text-zinc-400" />
                </div>
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
                  "กดที่ช่องว่าง (มีไอคอนกล้อง) เพื่อเพิ่มรูป — สูงสุด 6 รูป ลำดับแรกคือรูปปก",
              },
            ]}
          />
          <Tip>
            <strong>เคล็ดลับรูป:</strong> ถ่ายมุมตรง พื้นหลังขาว/เรียบ
            ระบบ crop เป็นสี่เหลี่ยมจัตุรัส รูปแรกคือรูปปก
            (ที่ลูกค้าเห็นในการ์ดสินค้า)
          </Tip>
        </Step>

        <Step n={4} title="ใส่รายละเอียดสินค้า + ค่าส่ง">
          <p>
            ขยายเนื้อหา <strong>"PRODUCT DETAILS"</strong> ใส่คำอธิบาย: ส่วนผสม
            วัตถุดิบ ขนาด น้ำหนัก เงื่อนไขส่ง — ยิ่งละเอียดลูกค้ายิ่งเชื่อใจ
          </p>
          <Mock>
            <div className="space-y-3 p-4">
              <div>
                <p className="text-[10.5px] font-semibold text-zinc-500">
                  คำอธิบายสินค้า
                </p>
                <div className="mt-1 min-h-20 rounded-xl border border-zinc-200 bg-zinc-50 p-2.5 text-[11.5px] text-zinc-700">
                  น้ำจิ้มรสเด็ด สูตรโบราณของแท้ ไม่ใช้น้ำมันหมู
                  ทานได้แบบไม่ต้องกังวล ส่งฟรีทั่วไทยแค่ 60 บาท
                </div>
              </div>
              <div className="relative grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10.5px] font-semibold text-zinc-500">
                    ค่าส่ง (บาท)
                  </p>
                  <span className="mt-1 block rounded-xl border border-zinc-200 p-2.5 font-mono text-[12px]">
                    50
                  </span>
                </div>
                <div>
                  <p className="text-[10.5px] font-semibold text-zinc-500">
                    สต็อก (ว่างไว้ = ไม่จำกัด)
                  </p>
                  <span className="mt-1 block rounded-xl border border-zinc-200 p-2.5 font-mono text-[12px]">
                    100
                  </span>
                </div>
                <Pin
                  n={1}
                  className="-left-2 -top-2"
                  style={{ position: "absolute" }}
                />
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
                  "ค่าส่ง — ตั้งราคาเอง (ใส่ 0 = ส่งฟรี) ลูกค้าเห็นในตอน checkout",
              },
              {
                n: 2,
                label:
                  "สต็อก — เว้นว่าง = ไม่จำกัด ใส่เลข = ระบบหักเองทุกครั้งที่ขาย",
              },
            ]}
          />
        </Step>

        <Step n={5} title="ใส่ Tag 'ของใหม่' / 'มือสอง' / 'ดิจิทัล'">
          <p>
            ในส่วน <strong>"ประเภทสินค้า"</strong> เลือกประเภท + สภาพ — Tag นี้จะขึ้นบนการ์ดสินค้าให้ลูกค้าเห็นทันที
          </p>
          <Mock>
            <div className="p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                ประเภท + สภาพ
              </p>
              <div className="relative mt-2 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-rose-600 px-2.5 py-1 text-[11px] font-bold text-white">
                  สินค้าจริง
                </span>
                <span className="rounded-full border border-zinc-200 px-2.5 py-1 text-[11px] font-semibold text-zinc-600">
                  ดิจิทัล (e-book/license)
                </span>
                <span className="ml-3 rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white">
                  ของใหม่
                </span>
                <span className="rounded-full border border-zinc-200 px-2.5 py-1 text-[11px] font-semibold text-zinc-600">
                  มือสอง
                </span>
                <Pin
                  n={1}
                  className="-right-2 -top-2"
                  style={{ position: "absolute" }}
                />
              </div>
              <Tag className="mt-3 inline size-3.5 text-zinc-400" />
              <span className="ml-1 text-[11px] text-zinc-500">
                Tag จะขึ้นบนการ์ดสินค้า
              </span>
            </div>
          </Mock>
          <Legend
            items={[
              {
                n: 1,
                label:
                  "เลือกประเภท + สภาพ — ระบบจะใส่ Tag ใต้รูปสินค้าให้อัตโนมัติ",
              },
            ]}
          />
          <Note>
            <strong>สินค้าดิจิทัล</strong>{" "}
            (e-book, license key, link download) — ระบบจะข้ามขั้นตอนจัดส่ง
            พอลูกค้าจ่ายปุ๊บส่ง content ให้ทันทีทาง email + LINE
          </Note>
        </Step>

        <Step n={6} title="กด 'เผยแพร่' — ขายได้ทันที">
          <p>
            ด้านบนขวา กดปุ่ม <MockButton>เผยแพร่</MockButton> สีแดง — สินค้าจะขึ้นหน้าร้านลูกค้าทันที พร้อมรับออเดอร์ใหม่ได้เลย
          </p>
          <Warn>
            <strong>กดบันทึกแบบร่าง</strong> ถ้ายังไม่พร้อมขาย — ระบบเก็บไว้แต่ลูกค้าจะยังไม่เห็น แก้ทีหลังแล้วกดเผยแพร่ก็ได้
          </Warn>
        </Step>
      </Steps>
    </>
  );
}
