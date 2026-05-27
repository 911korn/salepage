"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PlatformSettingsMap } from "@/lib/platform-settings";

interface Props {
  viewerIsSuperAdmin: boolean;
  initial: PlatformSettingsMap;
}

export function SettingsForm({ viewerIsSuperAdmin, initial }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [banner, setBanner] = useState(initial.announcement_banner);
  const [maint, setMaint] = useState(initial.maintenance_mode);
  const [email, setEmail] = useState(initial.email_from_override);
  const [slip, setSlip] = useState(initial.slip_verify_provider);
  const [planCaps, setPlanCaps] = useState(initial.default_plan_caps);
  const [feedProOnly, setFeedProOnly] = useState(initial.feed_pro_only);

  function save<K extends keyof PlatformSettingsMap>(
    key: K,
    value: PlatformSettingsMap[K],
    label: string,
  ) {
    startTransition(async () => {
      const res = await fetch(`/api/v1/admin/settings/${key}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value }),
      });
      const json = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!res.ok || !json.ok) {
        toast.error(json.error?.message ?? `บันทึก ${label} ไม่สำเร็จ`);
        return;
      }
      toast.success(`บันทึก ${label} แล้ว`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* Announcement banner */}
      <Card title="แบนเนอร์ประกาศ (site-wide)" description="แสดงด้านบนของหน้าร้านทุกร้านเมื่อเปิดใช้">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={banner.enabled}
            onChange={(e) => setBanner({ ...banner, enabled: e.target.checked })}
            className="size-4 rounded border-zinc-300"
          />
          เปิดใช้แบนเนอร์
        </label>
        <textarea
          rows={2}
          value={banner.text}
          onChange={(e) => setBanner({ ...banner, text: e.target.value })}
          placeholder="ข้อความที่จะแสดง เช่น เปิดปิดให้บริการ, โปรโมชั่นพิเศษ"
          className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-sm"
        />
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm">
            สี:
            <select
              value={banner.tone}
              onChange={(e) =>
                setBanner({ ...banner, tone: e.target.value as "info" | "warning" })
              }
              className="ml-2 h-9 rounded-lg border border-zinc-200 bg-white px-2 text-sm"
            >
              <option value="info">Info (น้ำเงิน)</option>
              <option value="warning">Warning (เหลือง)</option>
            </select>
          </label>
          <Button
            size="sm"
            disabled={pending}
            onClick={() => save("announcement_banner", banner, "แบนเนอร์")}
            className="ml-auto"
          >
            บันทึก
          </Button>
        </div>
      </Card>

      {/* Maintenance mode */}
      <Card
        title="Maintenance mode"
        description="ปิดหน้าร้านชั่วคราว (ดู /dashboard ยังเข้าได้สำหรับ owner/admin)"
        warn={!viewerIsSuperAdmin}
        warnText="ต้องเป็น SUPER_ADMIN ถึงจะแก้ค่านี้ได้"
      >
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={maint.enabled}
            disabled={!viewerIsSuperAdmin}
            onChange={(e) => setMaint({ ...maint, enabled: e.target.checked })}
            className="size-4 rounded border-zinc-300"
          />
          เปิด maintenance mode
        </label>
        <textarea
          rows={2}
          value={maint.message}
          onChange={(e) => setMaint({ ...maint, message: e.target.value })}
          disabled={!viewerIsSuperAdmin}
          className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-sm disabled:bg-zinc-50"
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="danger"
            disabled={pending || !viewerIsSuperAdmin}
            onClick={() => save("maintenance_mode", maint, "maintenance mode")}
          >
            บันทึก
          </Button>
        </div>
      </Card>

      {/* Email from override */}
      <Card title="Email from override" description="overrides AUTH_EMAIL_FROM env ถ้าตั้งค่า">
        <Input
          value={email.from}
          onChange={(e) => setEmail({ from: e.target.value })}
          placeholder="SalePage <noreply@salepage.in.th>"
          className="h-11"
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={pending}
            onClick={() => save("email_from_override", email, "email from")}
          >
            บันทึก
          </Button>
        </div>
      </Card>

      {/* Slip-verify provider */}
      <Card title="Slip verify provider" description="ใช้ตอนเช็คสลิปเงินโอน">
        <select
          value={slip.provider}
          onChange={(e) =>
            setSlip({ provider: e.target.value as "slipok" | "easyslip" | "mock" })
          }
          className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
        >
          <option value="mock">mock (dev only)</option>
          <option value="slipok">SlipOK (ผลิตจริง)</option>
          <option value="easyslip">EasySlip (สำรอง)</option>
        </select>
        <p className="text-[11px] text-zinc-500">
          การตั้งค่านี้ override SLIP_VERIFY_PROVIDER env. SlipOK ต้องตั้ง
          SLIPOK_API_KEY + SLIPOK_BRANCH_ID ใน env ด้วย
        </p>
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={pending}
            onClick={() => save("slip_verify_provider", slip, "slip provider")}
          >
            บันทึก
          </Button>
        </div>
      </Card>

      {/* V2.1 — Pro-only marketplace toggle. Off by default during
          launch so we can fill the feed with free-tier shops. When the
          catalog density gets healthy, super-admin flips this on so
          the buyer marketplace only surfaces shops on a paid plan. */}
      <Card
        title="Marketplace feed: shop เฉพาะแพลน Pro+"
        description="ปิดอยู่ในช่วงแรกเพื่อรอเก็บร้าน Free tier ให้ครบก่อน · เปิดเมื่อมีร้าน Pro เยอะพอแล้ว"
        warn={!viewerIsSuperAdmin}
        warnText="ต้องเป็น SUPER_ADMIN ถึงจะกดได้"
      >
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={feedProOnly.enabled}
            disabled={!viewerIsSuperAdmin}
            onChange={(e) =>
              setFeedProOnly({ ...feedProOnly, enabled: e.target.checked })
            }
            className="size-4 rounded border-zinc-300"
          />
          เปิด — โชว์ใน feed เฉพาะร้านที่อยู่ใน Pro / Business / Agency (active หรือ trial)
        </label>
        <p className="text-[11px] text-zinc-500">
          ร้าน Free tier ยังขายของได้ตามปกติ — storefront URL ที่แชร์ตรงๆ
          ยังเข้าได้ปกติ แค่จะไม่ถูก surface ในหน้า /shops + product feed
          ของ mobile home tab
        </p>
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={pending || !viewerIsSuperAdmin}
            onClick={() => save("feed_pro_only", feedProOnly, "feed Pro-only")}
          >
            บันทึก
          </Button>
        </div>
      </Card>

      {/* Default plan caps */}
      <Card
        title="Default plan caps (FREE tier)"
        description="โควต้าเริ่มต้นของผู้ใช้ที่ยังไม่ subscribe"
        warn={!viewerIsSuperAdmin}
        warnText="ต้องเป็น SUPER_ADMIN ถึงจะแก้โควต้าได้"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <NumberField
            label="Products"
            value={planCaps.products}
            disabled={!viewerIsSuperAdmin}
            onChange={(v) => setPlanCaps({ ...planCaps, products: v })}
          />
          <NumberField
            label="Orders / month"
            value={planCaps.ordersPerMonth}
            disabled={!viewerIsSuperAdmin}
            onChange={(v) => setPlanCaps({ ...planCaps, ordersPerMonth: v })}
          />
          <NumberField
            label="Slip verifies / month"
            value={planCaps.slipsPerMonth}
            disabled={!viewerIsSuperAdmin}
            onChange={(v) => setPlanCaps({ ...planCaps, slipsPerMonth: v })}
          />
        </div>
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={pending || !viewerIsSuperAdmin}
            onClick={() => save("default_plan_caps", planCaps, "default caps")}
          >
            บันทึก
          </Button>
        </div>
      </Card>
    </div>
  );
}

function Card({
  title,
  description,
  warn,
  warnText,
  children,
}: {
  title: string;
  description: string;
  warn?: boolean;
  warnText?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5">
      <header>
        <h2 className="font-display text-base font-semibold">{title}</h2>
        <p className="mt-0.5 text-[12px] text-zinc-500">{description}</p>
        {warn && warnText ? (
          <p className="mt-1 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[12px] text-amber-800">
            {warnText}
          </p>
        ) : null}
      </header>
      {children}
    </section>
  );
}

function NumberField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[12px] text-zinc-600">{label}</span>
      <Input
        type="number"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="mt-1 h-11"
      />
    </label>
  );
}
