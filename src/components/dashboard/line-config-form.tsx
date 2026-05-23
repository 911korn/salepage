"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Save, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import { buttonStyles } from "@/components/ui/button";

interface Props {
  shopId: string;
  shopSlug: string;
  initial: {
    lineChannelId: string;
    lineChannelSecret: string;
    lineChannelAccessToken: string;
    lineWebhookEnabled: boolean;
  };
}

export function LineConfigForm({ shopId, shopSlug, initial }: Props) {
  const [channelId, setChannelId] = useState(initial.lineChannelId);
  const [channelSecret, setChannelSecret] = useState(initial.lineChannelSecret);
  const [accessToken, setAccessToken] = useState(initial.lineChannelAccessToken);
  const [enabled, setEnabled] = useState(initial.lineWebhookEnabled);
  const [saving, setSaving] = useState(false);

  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/v1/line/webhook/${shopId}`
      : `/api/v1/line/webhook/${shopId}`;

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/shops/${shopSlug}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lineChannelId: channelId.trim() || null,
          lineChannelSecret: channelSecret.trim() || null,
          lineChannelAccessToken: accessToken.trim() || null,
          lineWebhookEnabled: enabled,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        toast.error(json.error?.message ?? "บันทึกไม่สำเร็จ");
        return;
      }
      toast.success("บันทึกการตั้งค่า LINE แล้ว");
    } finally {
      setSaving(false);
    }
  }

  function copyWebhook() {
    void navigator.clipboard.writeText(webhookUrl);
    toast.success("คัดลอก Webhook URL แล้ว");
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[color:var(--color-border)] bg-white p-5">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
          <div>
            <p className="text-[13px] font-semibold">วิธีเชื่อม LINE Messaging API</p>
            <ol className="mt-2 space-y-1 text-[12px] text-zinc-600">
              <li>1. ไป LINE Developers Console → สร้าง Provider + Messaging API channel</li>
              <li>2. คัดลอก Channel ID, Channel Secret, Channel Access Token (long-lived) มาวาง</li>
              <li>
                3. ใน Messaging API tab → ตั้ง Webhook URL เป็น URL ข้างล่างนี้ → Verify → เปิด Use webhook
              </li>
              <li>4. ปิด "Auto-reply messages" และ "Greeting messages" เพื่อไม่ให้ชนกัน</li>
            </ol>
          </div>
        </div>

        <div className="mt-4">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Webhook URL
          </label>
          <div className="mt-1.5 flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg bg-[color:var(--color-soft)] px-3 py-2 font-mono text-[12px]">
              {webhookUrl}
            </code>
            <button
              type="button"
              onClick={copyWebhook}
              className={cn(buttonStyles({ size: "sm", variant: "outline" }), "gap-1")}
            >
              <Copy className="size-3.5" /> คัดลอก
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[color:var(--color-border)] bg-white p-5">
        <p className="font-display text-base font-semibold">Channel credentials</p>
        <div className="mt-4 space-y-3">
          <Field label="Channel ID">
            <input
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              placeholder="1234567890"
              className="w-full rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2 font-mono text-[13px] outline-none focus:border-[color:var(--color-brand-400)]"
            />
          </Field>
          <Field label="Channel Secret">
            <input
              type="password"
              value={channelSecret}
              onChange={(e) => setChannelSecret(e.target.value)}
              placeholder="••••••••••••••••"
              className="w-full rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2 font-mono text-[13px] outline-none focus:border-[color:var(--color-brand-400)]"
            />
          </Field>
          <Field label="Channel Access Token (long-lived)">
            <textarea
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="eyJhbGc..."
              rows={2}
              className="w-full resize-none rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2 font-mono text-[12px] outline-none focus:border-[color:var(--color-brand-400)]"
            />
          </Field>
        </div>

        <label className="mt-4 flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled((v) => !v)}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
              enabled
                ? "bg-[color:var(--color-brand-600)]"
                : "bg-zinc-200",
            )}
          >
            <span
              className={cn(
                "inline-block size-4 transform rounded-full bg-white shadow-md transition-transform",
                enabled ? "translate-x-6" : "translate-x-1",
              )}
            />
          </button>
          <span className="text-[13px] font-medium">
            เปิดรับข้อความผ่าน webhook
          </span>
        </label>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className={cn(buttonStyles({ size: "sm" }), "gap-1.5")}
          >
            <Save className="size-4" />
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
