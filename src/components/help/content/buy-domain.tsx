/* eslint-disable react/no-unescaped-entities */
import { Globe } from "lucide-react";
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

export function BuyDomain() {
  return (
    <>
      <HelpHeader
        title="ซื้อโดเมนเอง — GoDaddy / Cloudflare / Namecheap"
        intro="อยากใช้ mystore.com แทน salepage.in.th/s/... ต้องซื้อโดเมนก่อน · ใช้ registrar เจ้าไหนก็ได้ — ที่นี่เราแนะนำ 4 เจ้าหลัก แล้วสอนขั้นตอนทีละ step"
      />

      <Note>
        <strong>SalePage ไม่ขายโดเมน</strong> เราแค่รับให้ผูกใช้กับร้านของคุณ — เก็บโดเมนไว้ในชื่อตัวเอง 100% ย้ายไปแพลตฟอร์มอื่นได้ทุกเมื่อ
      </Note>

      <Steps>
        <Step n={1} title="เลือก registrar — แต่ละเจ้าราคาต่างกัน">
          <p>
            <strong>Registrar</strong> = บริษัทขายโดเมน · มีหลายเจ้า ราคาไม่เท่ากัน · เลือกตามนี้ก็ได้:
          </p>
          <Mock>
            <div className="overflow-hidden">
              <table className="w-full text-[11.5px]">
                <thead className="bg-zinc-50 text-left">
                  <tr>
                    <th className="px-3 py-2 font-semibold text-zinc-600">Registrar</th>
                    <th className="px-3 py-2 font-semibold text-zinc-600">.com ราคา/ปี</th>
                    <th className="px-3 py-2 font-semibold text-zinc-600">เหมาะกับ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  <tr>
                    <td className="px-3 py-2 font-bold">GoDaddy</td>
                    <td className="px-3 py-2 font-mono">~฿450-650</td>
                    <td className="px-3 py-2 text-zinc-700">มือใหม่ — UI ภาษาไทย, support ดี</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-bold">Cloudflare</td>
                    <td className="px-3 py-2 font-mono">~฿340</td>
                    <td className="px-3 py-2 text-zinc-700">คุ้มสุด — at-cost ไม่บวก%</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-bold">Namecheap</td>
                    <td className="px-3 py-2 font-mono">~฿380</td>
                    <td className="px-3 py-2 text-zinc-700">เก่าแก่ น่าเชื่อถือ</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-bold">Porkbun</td>
                    <td className="px-3 py-2 font-mono">~฿360</td>
                    <td className="px-3 py-2 text-zinc-700">ราคาดี · ฟรี WHOIS privacy</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Mock>
          <Tip>
            <strong>แนะนำสำหรับมือใหม่:</strong> GoDaddy เพราะ UI ภาษาไทย support ไทย — แม้แพงกว่านิดหน่อยแต่ง่าย ถ้าคล่องแล้วย้ายไป Cloudflare ทีหลังก็ได้
          </Tip>
        </Step>

        <Step n={2} title="ไปที่ godaddy.com — ค้นหาชื่อที่อยากได้">
          <p>
            เปิด <strong>godaddy.com</strong> (หรือ <strong>th.godaddy.com</strong> ภาษาไทย) → ใส่ชื่อที่อยากได้ในช่องค้นหา → กดค้น
          </p>
          <Mock caption="หน้าแรก GoDaddy — กรอกชื่อในช่องสีขาว">
            <div className="relative p-6 text-center">
              <p className="font-display text-lg font-bold leading-tight">
                สิ่งที่ดีที่สุดเริ่มต้นที่นี่
              </p>
              <p className="mt-1 text-[11px] text-zinc-500">
                ค้นหาและจดทะเบียนโดเมนของคุณ
              </p>
              <div className="relative mx-auto mt-4 flex max-w-sm">
                <input
                  type="text"
                  placeholder="ค้นหา mystore.com"
                  className="flex-1 rounded-l-lg border-2 border-zinc-300 px-3 py-2 text-[12px]"
                  readOnly
                />
                <button className="rounded-r-lg bg-emerald-500 px-4 text-[12px] font-bold text-white">
                  ค้นหา
                </button>
                <Pin
                  n={1}
                  className="-right-3 -top-3"
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
                  "กรอกชื่อที่อยากได้ — ลอง .com ก่อน · ถ้าไม่ว่าง ระบบเสนอ .co .shop .store ฯลฯ ให้เลือก",
              },
            ]}
          />
        </Step>

        <Step n={3} title="เพิ่มลงตะกร้า + ตรวจตะกร้า">
          <p>
            GoDaddy จะแสดงโดเมนที่หาเจอ + ราคา · กดปุ่ม <MockButton>เพิ่มไปยังตะกร้า</MockButton> ที่อันที่ชอบ → กดปุ่ม "Cart" มุมขวาบน
          </p>
          <Mock>
            <div className="space-y-2 p-3">
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5">
                <Globe className="size-4 text-emerald-700" />
                <div className="flex-1">
                  <p className="font-mono text-[12px] font-bold">mystore.com</p>
                  <p className="text-[10px] text-emerald-700">
                    ✓ พร้อมจดทะเบียน
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-[12px] font-bold">฿590</p>
                  <p className="text-[9px] text-zinc-500">/ ปีแรก</p>
                </div>
                <div className="relative">
                  <MockButton>เพิ่ม</MockButton>
                  <Pin
                    n={1}
                    className="-right-2 -top-2"
                    style={{ position: "absolute" }}
                  />
                </div>
              </div>
            </div>
          </Mock>
          <Legend
            items={[{ n: 1, label: "กด 'เพิ่ม' → จะเข้าตะกร้าทันที" }]}
          />
        </Step>

        <Step n={4} title="ปฏิเสธของแถมที่ไม่จำเป็น">
          <p>
            GoDaddy ชอบขายเสริม — ส่วนใหญ่<strong>ไม่ต้องซื้อ</strong> ก็ได้:
          </p>
          <ul className="ml-4 list-disc space-y-1 text-[13px]">
            <li>
              <strong className="text-emerald-700">✓ ซื้อ:</strong> ลงทะเบียน 1 ปี (ฉบับขั้นต่ำ)
            </li>
            <li>
              <strong className="text-amber-700">~ Optional:</strong> WHOIS Privacy (ฟรีในบาง registrar — ป้องกันข้อมูลส่วนตัวรั่ว) · แนะนำเปิด
            </li>
            <li>
              <strong className="text-rose-700">✗ ข้าม:</strong> Web Hosting (เราใช้ SalePage แล้ว) · Email Plan · SSL Certificate (Cloudflare ออกให้ฟรี) · Microsoft 365
            </li>
          </ul>
          <Warn>
            <strong>ระวัง:</strong> ปุ่ม "ดำเนินการต่อ" บางครั้งจะเลือกของเสริมโดยอัตโนมัติ — เช็คให้ดีก่อนจ่ายเงิน
          </Warn>
        </Step>

        <Step n={5} title="สร้างบัญชี + จ่ายเงิน">
          <p>
            สร้างบัญชี GoDaddy ด้วย email — จ่ายผ่านบัตรเครดิต / PayPal / TrueMoney ก็ได้ · ใช้เวลา ~2 นาที
          </p>
          <Tip>
            <strong>ใส่ที่อยู่จริง</strong> — ICANN กำหนดให้ติดต่อเจ้าของโดเมนได้จริง · ใช้ที่อยู่ผู้ส่งของร้านก็ได้
          </Tip>
        </Step>

        <Step
          n={6}
          title="หา 'DNS Management' หรือ 'Manage Nameservers' ในบัญชี"
        >
          <p>
            หลังซื้อเสร็จ — ไปที่ <strong>My Products</strong> → กดที่โดเมนของคุณ → หาเมนู <strong>"DNS"</strong> หรือ <strong>"Manage Nameservers"</strong>
          </p>
          <Mock>
            <div className="p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                การตั้งค่าโดเมน
              </p>
              <div className="mt-3 space-y-1.5">
                <div className="rounded border border-zinc-200 px-3 py-2 text-[11px]">
                  Domain Lock — ON ✓
                </div>
                <div className="relative rounded border-2 border-rose-400 bg-rose-50 px-3 py-2 text-[11px] font-bold">
                  Nameservers — Default
                  <span className="ml-2 text-[10px] text-rose-700">
                    กดที่นี่ ↓
                  </span>
                  <Pin
                    n={1}
                    className="-right-2 -top-2"
                    style={{ position: "absolute" }}
                  />
                </div>
                <div className="rounded border border-zinc-200 px-3 py-2 text-[11px]">
                  Auto-Renew — OFF
                </div>
              </div>
            </div>
          </Mock>
          <Legend
            items={[
              { n: 1, label: "กด 'Nameservers' หรือ 'Change' ข้างคำว่า Default" },
            ]}
          />
        </Step>

        <Step
          n={7}
          title="เลือก 'Custom Nameservers' + paste NS1/NS2 จากเรา"
        >
          <p>
            กลับมาที่ <strong>SalePage → ตั้งค่า → Custom Domain</strong> → พิมพ์โดเมนที่ซื้อ → ระบบสร้าง NS1/NS2 ให้ → <strong>คัดลอกทั้ง 2 ตัว</strong> กลับไปวางที่ GoDaddy
          </p>
          <Mock>
            <div className="p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                เลือก Nameservers
              </p>
              <div className="mt-3 space-y-2">
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 p-2.5 text-[11px]">
                  <input type="radio" className="size-3" />
                  <span>I'll use my own nameservers</span>
                </label>
                <div className="relative">
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border-2 border-rose-400 bg-rose-50 p-2.5 text-[11px] font-bold">
                    <input type="radio" checked readOnly className="size-3" />
                    <span>Custom Nameservers</span>
                  </label>
                  <Pin
                    n={1}
                    className="-right-2 -top-2"
                    style={{ position: "absolute" }}
                  />
                </div>
                <div className="space-y-1.5 pl-5">
                  <input
                    type="text"
                    value="romina.ns.cloudflare.com"
                    readOnly
                    className="block w-full rounded border-2 border-rose-300 bg-white px-2 py-1.5 font-mono text-[11px]"
                  />
                  <input
                    type="text"
                    value="yoxall.ns.cloudflare.com"
                    readOnly
                    className="block w-full rounded border-2 border-rose-300 bg-white px-2 py-1.5 font-mono text-[11px]"
                  />
                </div>
                <Pin
                  n={2}
                  className="-left-2 top-24"
                  style={{ position: "absolute" }}
                />
              </div>
              <div className="mt-3 text-right">
                <MockButton>Save</MockButton>
              </div>
            </div>
          </Mock>
          <Legend
            items={[
              { n: 1, label: "เลือก 'Custom Nameservers' (อันที่สอง)" },
              {
                n: 2,
                label:
                  "วาง NS1 + NS2 ที่ระบบเราออกให้ (ของจริงไม่ใช่ romina/yoxall — ของแต่ละโดเมนต่างกัน)",
              },
            ]}
          />
          <Warn>
            <strong>ใส่ครบทั้ง 2 ตัว</strong> — ใส่แค่ตัวเดียวจะใช้ไม่ได้ · ก๊อปจากเราตามลำดับ NS1 → field 1, NS2 → field 2
          </Warn>
        </Step>

        <Step n={8} title="กลับมา SalePage → กด 'เช็คเลย'">
          <p>
            กลับมาที่หน้า <strong>SalePage Custom Domain</strong> → รอ DNS propagate ~15-30 นาที (บางครั้งถึง 24 ชม.) → กดปุ่ม <MockButton>เช็คเลย</MockButton>
          </p>
          <p>
            ถ้า "Verified" สีเขียวขึ้น → เปิด <strong>https://mystore.com</strong> ในเบราว์เซอร์ → จะเห็นหน้าร้านคุณเลย พร้อม SSL ฟรีจาก Cloudflare 🎉
          </p>
        </Step>
      </Steps>

      <Warn>
        <strong>กังวลเรื่อง Email ของโดเมน:</strong> การเปลี่ยน Nameservers = DNS records ของโดเมนจะย้ายมา Cloudflare หมด · ถ้ามี email @mystore.com (Google Workspace / Outlook) ติดต่อทีมเราที่ <a href="https://line.me/R/ti/p/%40salepage" target="_blank" rel="noopener noreferrer" className="font-bold underline">LINE @salepage</a> ก่อน ให้เราช่วย migrate MX records ให้
      </Warn>

      <Note>
        <strong>Cloudflare / Namecheap / Porkbun ก็ทำขั้นตอนเดียวกัน</strong> — แค่หน้าจอแตกต่างกัน หา section "DNS" / "Nameservers" / "Custom NS" แล้วใส่ NS1+NS2 จากเรา
      </Note>
    </>
  );
}
