/* eslint-disable react/no-unescaped-entities */
import { Sparkles, Mail, Smartphone } from "lucide-react";
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

export function OpenShop() {
  return (
    <>
      <HelpHeader
        title="เปิดร้านครั้งแรก"
        intro="ใช้เวลา 30 วินาที — ตั้งแต่ลงทะเบียนถึงร้านเปิดให้ลูกค้าซื้อได้จริง คุณไม่ต้องใส่บัตรเครดิต ไม่ต้องเสียค่าธรรมเนียมรายเดือน"
      />

      <Steps>
        <Step n={1} title="ไปที่ salepage.in.th แล้วกด 'เปิดร้านฟรี'">
          <p>
            เปิดเบราว์เซอร์ในมือถือหรือคอมพิวเตอร์ พิมพ์ที่อยู่{" "}
            <strong>salepage.in.th</strong> ในแถบ URL — จะเจอหน้าหลักที่มีปุ่ม
            "เปิดร้านฟรี" สีแดงเด่นๆ ตรงกลางหน้า
          </p>
          <Mock caption="หน้าหลัก salepage.in.th — กดปุ่มที่มีลูกศรชี้">
            <div className="relative p-6">
              <div className="text-center">
                <p className="font-display text-lg font-bold leading-tight">
                  ไม่เก็บ %
                </p>
                <p className="font-display mt-1 text-2xl font-bold leading-tight text-rose-700">
                  เงินเข้าตรงร้าน
                </p>
                <p className="mt-2 text-[11px] text-zinc-500">
                  ขายของผ่าน SalePage · ไม่หักค่าคอม · เงินถึงคุณตรง PromptPay
                </p>
                <div className="relative mt-4 inline-block">
                  <MockButton>เปิดร้านฟรี →</MockButton>
                  <Pin
                    n={1}
                    className="-right-3 -top-3"
                    style={{ position: "absolute" }}
                  />
                </div>
              </div>
            </div>
          </Mock>
          <Legend
            items={[{ n: 1, label: "ปุ่ม 'เปิดร้านฟรี' — กดที่นี่" }]}
          />
        </Step>

        <Step n={2} title="ลงทะเบียนด้วย Email หรือ Google ก็ได้">
          <p>
            หน้าถัดมาจะให้เลือกวิธีลงทะเบียน — เลือกอันที่ใช้บ่อยที่สุด เพราะจะใช้
            login เข้าหลังบ้านทุกครั้ง
          </p>
          <Mock>
            <div className="relative space-y-2 p-5">
              <p className="text-center text-[13px] font-bold">
                สร้างบัญชี SalePage
              </p>
              <div className="relative">
                <MockButton variant="outline" className="w-full justify-center">
                  เข้าด้วย Google
                </MockButton>
                <Pin
                  n={1}
                  className="-right-3 top-1.5"
                  style={{ position: "absolute" }}
                />
              </div>
              <div className="relative">
                <MockButton variant="outline" className="w-full justify-center">
                  เข้าด้วย LINE
                </MockButton>
              </div>
              <p className="my-2 text-center text-[10.5px] text-zinc-400">
                หรือ
              </p>
              <div className="relative">
                <span className="block w-full rounded-xl border border-zinc-200 px-3 py-2 text-[12px] text-zinc-400">
                  yourname@gmail.com
                </span>
                <Pin
                  n={2}
                  className="-right-3 top-1"
                  style={{ position: "absolute" }}
                />
              </div>
              <MockButton className="w-full justify-center">
                ส่งลิงก์ login ทาง email
              </MockButton>
            </div>
          </Mock>
          <Legend
            items={[
              {
                n: 1,
                label:
                  "เร็วสุด — กด 'เข้าด้วย Google' แล้วเลือกบัญชี (ใช้ได้เลย ไม่ต้องตั้งรหัสผ่าน)",
              },
              {
                n: 2,
                label:
                  "ถ้าใช้ email: พิมพ์อีเมล → กดส่งลิงก์ → ไปเช็คอีเมล → กดลิงก์เข้าระบบ",
              },
            ]}
          />
          <Tip>
            <strong>แนะนำ Google:</strong> ไม่ต้องตั้งรหัสผ่าน
            ไม่ต้องสลับไปเช็คอีเมล กดครั้งเดียวเข้าเลย
          </Tip>
        </Step>

        <Step n={3} title="ใส่ชื่อร้าน + ผูก PromptPay">
          <p>
            หลัง login ครั้งแรก ระบบจะถามชื่อร้าน + เบอร์ PromptPay (หรือเลข
            e-Wallet) ที่จะให้ลูกค้าโอนเงินเข้า — <strong>เงินจะเข้าบัญชีคุณตรง 100%</strong>{" "}
            SalePage ไม่แตะเงินคุณเลย
          </p>
          <Mock>
            <div className="space-y-3 p-5">
              <p className="text-center text-[13px] font-bold">
                ตั้งชื่อร้านของคุณ
              </p>
              <div>
                <p className="text-[10.5px] font-semibold text-zinc-500">
                  ชื่อร้าน
                </p>
                <div className="relative mt-1">
                  <span className="block rounded-xl border-2 border-rose-300 px-3 py-2 text-[13px] font-semibold text-zinc-900">
                    สยามสแน็ค
                  </span>
                  <Pin
                    n={1}
                    className="-right-3 -top-3"
                    style={{ position: "absolute" }}
                  />
                </div>
              </div>
              <div>
                <p className="text-[10.5px] font-semibold text-zinc-500">
                  PromptPay (เบอร์มือถือหรือเลข ID 13 หลัก)
                </p>
                <div className="relative mt-1">
                  <span className="block rounded-xl border border-zinc-200 px-3 py-2 font-mono text-[12px] text-zinc-700">
                    081-234-5678
                  </span>
                  <Pin
                    n={2}
                    className="-right-3 -top-3"
                    style={{ position: "absolute" }}
                  />
                </div>
              </div>
              <MockButton className="mt-2 w-full justify-center">
                สร้างร้าน
              </MockButton>
            </div>
          </Mock>
          <Legend
            items={[
              {
                n: 1,
                label:
                  "ชื่อร้าน — ตั้งเป็นอะไรก็ได้ (ภาษาไทย/อังกฤษ/ผสม) เปลี่ยนทีหลังได้",
              },
              {
                n: 2,
                label:
                  "เบอร์ PromptPay ที่ผูกกับบัญชีธนาคารคุณ — ลูกค้าจะโอนเข้าตรงนี้",
              },
            ]}
          />
          <Warn>
            <strong>ใส่ PromptPay ให้ถูก!</strong> ระบบใช้เลขนี้สร้าง QR ลูกค้า — ถ้าใส่ผิดเงินจะเข้าผิดคน เช็คให้แน่ใจก่อนกด "สร้างร้าน"
          </Warn>
        </Step>

        <Step n={4} title="เสร็จแล้ว · เริ่มเพิ่มสินค้าได้เลย">
          <p>
            กดสร้างร้านปุ๊บ ระบบจะพาเข้าหน้าหลังบ้านที่อยู่ตอนนี้ — ขั้นถัดไปคือ
            "เพิ่มสินค้าใหม่" ที่ปุ่มสีแดงด้านบน หรือถ้าคุณมีสินค้าอยู่บน Shopee/Lazada
            แล้วใช้ "นำเข้าสินค้า Auto" เพื่อดึงสินค้าทุกชิ้นเข้ามา
          </p>
          <Mock caption="หน้าหลังบ้านหลังเปิดร้านสำเร็จ — สังเกตปุ่มสองอันใหญ่ๆ ด้านบน">
            <div className="space-y-2 p-4">
              <p className="text-[11px] uppercase tracking-wider text-zinc-400">
                ภาพรวม
              </p>
              <p className="font-display text-lg font-bold">สยามสแน็ค</p>
              <div className="relative mt-2 grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-rose-600 p-3 text-white">
                  <Sparkles className="size-4" />
                  <p className="mt-2 text-[12px] font-bold">เพิ่มสินค้าใหม่</p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-3 text-zinc-700">
                  <Mail className="size-4 text-rose-600" />
                  <p className="mt-2 text-[12px] font-bold">
                    นำเข้าสินค้า Auto
                  </p>
                </div>
                <Pin
                  n={1}
                  className="-top-3 right-1/2"
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
                  "สองปุ่มหลัก — 'เพิ่มสินค้าใหม่' (ทีละชิ้น) หรือ 'นำเข้าสินค้า Auto' (ดึงจาก Shopee/Lazada)",
              },
            ]}
          />
        </Step>
      </Steps>

      <Tip>
        <strong>ขั้นต่อไป:</strong> อ่านคู่มือ <em>"เพิ่มสินค้าใหม่"</em> หรือ{" "}
        <em>"นำเข้าสินค้าจาก Shopee / Lazada"</em> เพื่อใส่สินค้าเข้าร้าน
      </Tip>

      <Mock variant="phone" caption="หน้าร้านที่ลูกค้าเห็น — เปิดบนเบราว์เซอร์ในมือถือ">
        <div className="relative p-3">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-xl bg-rose-600 text-[12px] font-bold text-white">
              ส
            </span>
            <div className="flex-1">
              <p className="text-[11px] font-bold">สยามสแน็ค</p>
              <p className="font-mono text-[8.5px] text-zinc-500">
                salepage.in.th/s/siam-snack
              </p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            <div className="aspect-square rounded-lg bg-gradient-to-br from-yellow-200 to-amber-400" />
            <div className="aspect-square rounded-lg bg-gradient-to-br from-emerald-200 to-emerald-400" />
          </div>
          <p className="mt-2 flex items-center gap-1 text-[9px] text-zinc-500">
            <Smartphone className="size-2.5" /> หน้านี้แชร์ลิงก์ให้ลูกค้าได้เลย
          </p>
        </div>
      </Mock>
    </>
  );
}
