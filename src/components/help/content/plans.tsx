/* eslint-disable react/no-unescaped-entities */
import { CheckCircle2, X } from "lucide-react";
import {
  HelpHeader,
  Steps,
  Step,
  Mock,
  Tip,
  Note,
} from "../help-primitives";

export function Plans() {
  return (
    <>
      <HelpHeader
        title="แผน Free / Pro / Business / Agency"
        intro="แต่ละแผนได้อะไรบ้าง · อัปเกรดยังไง · ยกเลิกได้เมื่อไหร่"
      />

      <Note>
        <strong>ไม่มีค่าคอม</strong>ในทุกแผน · ค่าบริการรายเดือนเท่านั้น
      </Note>

      <Steps>
        <Step n={1} title="เปรียบเทียบแผน">
          <Mock>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="p-2.5 text-left font-semibold text-zinc-500">
                      ฟีเจอร์
                    </th>
                    <th className="p-2.5 text-center font-bold">FREE</th>
                    <th className="p-2.5 text-center font-bold">Starter</th>
                    <th className="bg-rose-50 p-2.5 text-center font-bold text-rose-700">
                      Pro
                    </th>
                    <th className="bg-emerald-50 p-2.5 text-center font-bold text-emerald-700">
                      Business
                    </th>
                    <th className="p-2.5 text-center font-bold">Agency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-center">
                  <tr>
                    <td className="p-2.5 text-left text-zinc-600">ราคา/เดือน</td>
                    <td className="p-2.5 font-mono font-bold">฿0</td>
                    <td className="p-2.5 font-mono">฿0</td>
                    <td className="p-2.5 font-mono font-bold">฿299</td>
                    <td className="p-2.5 font-mono font-bold">฿790</td>
                    <td className="p-2.5 font-mono">฿2,490</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-left text-zinc-600">
                      AI ตรวจสลิป
                    </td>
                    <td className="p-2.5 text-zinc-400">ซื้อเครดิต</td>
                    <td className="p-2.5 text-zinc-400">ซื้อเครดิต</td>
                    <td className="p-2.5">300/ด</td>
                    <td className="p-2.5">1,500/ด</td>
                    <td className="p-2.5">10,000/ด</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-left text-zinc-600">
                      พิมพ์ใบปะหน้า + AI tracking
                    </td>
                    <td className="p-2.5">
                      <X className="mx-auto size-3 text-zinc-300" />
                    </td>
                    <td className="p-2.5">
                      <X className="mx-auto size-3 text-zinc-300" />
                    </td>
                    <td className="p-2.5">
                      <X className="mx-auto size-3 text-zinc-300" />
                    </td>
                    <td className="p-2.5">
                      <CheckCircle2 className="mx-auto size-3 text-emerald-600" />
                    </td>
                    <td className="p-2.5">
                      <CheckCircle2 className="mx-auto size-3 text-emerald-600" />
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-left text-zinc-600">
                      Bulk Tracking
                    </td>
                    <td className="p-2.5">
                      <X className="mx-auto size-3 text-zinc-300" />
                    </td>
                    <td className="p-2.5">
                      <X className="mx-auto size-3 text-zinc-300" />
                    </td>
                    <td className="p-2.5">
                      <X className="mx-auto size-3 text-zinc-300" />
                    </td>
                    <td className="p-2.5">
                      <CheckCircle2 className="mx-auto size-3 text-emerald-600" />
                    </td>
                    <td className="p-2.5">
                      <CheckCircle2 className="mx-auto size-3 text-emerald-600" />
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-left text-zinc-600">
                      แชทลูกค้าในระบบ
                    </td>
                    <td className="p-2.5">
                      <X className="mx-auto size-3 text-zinc-300" />
                    </td>
                    <td className="p-2.5">
                      <X className="mx-auto size-3 text-zinc-300" />
                    </td>
                    <td className="p-2.5">
                      <X className="mx-auto size-3 text-zinc-300" />
                    </td>
                    <td className="p-2.5">
                      <CheckCircle2 className="mx-auto size-3 text-emerald-600" />
                    </td>
                    <td className="p-2.5">
                      <CheckCircle2 className="mx-auto size-3 text-emerald-600" />
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-left text-zinc-600">
                      จำนวนสินค้า
                    </td>
                    <td className="p-2.5">∞</td>
                    <td className="p-2.5">∞</td>
                    <td className="p-2.5">∞</td>
                    <td className="p-2.5">∞</td>
                    <td className="p-2.5">∞</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-left text-zinc-600">
                      ค่าคอม / ค่าหัก%
                    </td>
                    <td className="p-2.5 font-bold text-emerald-700" colSpan={5}>
                      0% ทุกแผน · เงินเข้าตรง PromptPay
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Mock>
        </Step>

        <Step n={2} title="อัปเกรดยังไง">
          <p>
            ที่ dashboard กดปุ่ม "Upgrade+" ในกริดเครื่องมือ → ระบบพาไปหน้า pricing → กดเลือกแผน → ระบบพาไป Stripe checkout
          </p>
          <Tip>
            <strong>ยกเลิกได้ทุกเวลา</strong> — ค่าบริการที่จ่ายไปแล้วในเดือนปัจจุบันใช้ได้จนหมดรอบบิล หลังจากนั้นไม่ตัดเงินต่อ
          </Tip>
        </Step>

        <Step n={3} title="ลดแผนหรือยกเลิก">
          <p>
            ไปที่ <strong>ตั้งค่า → Billing</strong> → กด "เปลี่ยนแผน" หรือ "ยกเลิก subscription" — ระบบเปิด Stripe Customer Portal ให้จัดการเอง
          </p>
          <Note>
            ลดแผนทันที = ฟีเจอร์ลดทันที (เช่น พิมพ์ใบปะหน้าใช้ไม่ได้ทันที) · ลดแผนปลายรอบ = ใช้แผนเดิมจนหมดเดือน
          </Note>
        </Step>
      </Steps>

      <Tip>
        <strong>แนะนำ:</strong> เริ่มจาก <strong>FREE</strong> + ซื้อเครดิตตรวจสลิป pack 50 (฿125) → พอเริ่มส่งของเยอะอัปเป็น <strong>Business</strong> เพื่อใช้ AI tracking + Bulk scan
      </Tip>
    </>
  );
}
