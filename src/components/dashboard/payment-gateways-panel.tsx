"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  XCircle,
  Trash2,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Clock,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProviderMetadata } from "@/lib/payment-gateways/registry";

interface SavedGateway {
  id: string;
  provider: string;
  mode: "TEST" | "LIVE";
  publicKey: string;
  publicKeyMasked: string;
  secretKeyMasked: string;
  hasWebhookSecret: boolean;
  label: string | null;
  enabled: boolean;
  lastTestedAt: string | null;
  lastTestStatus: "OK" | "FAILED" | "PENDING" | null;
  lastTestMessage: string | null;
}

export function PaymentGatewaysPanel({
  shopSlug,
  liveProviders,
  roadmapProviders,
}: {
  shopSlug: string;
  liveProviders: readonly ProviderMetadata[];
  roadmapProviders: readonly ProviderMetadata[];
}) {
  const [gateways, setGateways] = useState<SavedGateway[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProvider, setEditingProvider] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/shops/${shopSlug}/payment-gateways`,
      );
      const json = await res.json();
      if (res.ok && json.ok) {
        setGateways(json.data.gateways as SavedGateway[]);
      } else if (res.status === 402) {
        toast.error(json.error?.message ?? "ต้องอัปเกรดเป็น Business+");
      }
    } finally {
      setLoading(false);
    }
  }, [shopSlug]);
  useEffect(() => {
    // Initial fetch — kicks off the GET on mount + whenever shopSlug
    // changes (e.g. user swaps between owned shops in the picker).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  return (
    <div className="mt-6 space-y-8">
      <section>
        <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">
          พร้อมใช้งาน · {liveProviders.length} เจ้า
        </h2>
        {loading ? (
          <div className="mt-3 flex items-center gap-2 text-[13px] text-zinc-500">
            <Loader2 className="size-4 animate-spin" />
            กำลังโหลด gateways ที่เซฟไว้...
          </div>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {liveProviders.map((p) => {
              const saved = gateways.find((g) => g.provider === p.provider);
              return (
                <ProviderCard
                  key={p.provider}
                  provider={p}
                  saved={saved}
                  shopSlug={shopSlug}
                  isEditing={editingProvider === p.provider}
                  onStartEdit={() => setEditingProvider(p.provider)}
                  onStopEdit={() => setEditingProvider(null)}
                  onChange={refresh}
                />
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">
          Roadmap · เปิดตามดีมานด์
        </h2>
        <p className="mt-1 text-[12px] text-zinc-500">
          เจ้าด้านล่างยังไม่ wire — ติดต่อทีมเราเร่งคิวได้ หรือกด ❤️ โหวต (จะเปิด provider ที่ vote เยอะที่สุดก่อน)
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {roadmapProviders.map((p) => (
            <RoadmapCard key={p.provider} provider={p} />
          ))}
        </div>
      </section>
    </div>
  );
}

function ProviderCard({
  provider,
  saved,
  shopSlug,
  isEditing,
  onStartEdit,
  onStopEdit,
  onChange,
}: {
  provider: ProviderMetadata;
  saved: SavedGateway | undefined;
  shopSlug: string;
  isEditing: boolean;
  onStartEdit: () => void;
  onStopEdit: () => void;
  onChange: () => void | Promise<void>;
}) {
  const [testing, setTesting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function retest() {
    if (!saved) return;
    setTesting(true);
    try {
      const res = await fetch(
        `/api/v1/shops/${shopSlug}/payment-gateways/${saved.id}/test`,
        { method: "POST" },
      );
      const json = await res.json();
      if (res.ok && json.ok) {
        const ok = json.data.test.ok as boolean;
        if (ok) {
          toast.success(
            `✓ ${provider.name} keys ใช้ได้`,
            { description: json.data.test.accountLabel },
          );
        } else {
          toast.error(
            `${provider.name} keys ตรวจไม่ผ่าน`,
            { description: json.data.test.errorMessage },
          );
        }
        await onChange();
      }
    } finally {
      setTesting(false);
    }
  }

  async function remove() {
    if (!saved) return;
    if (!confirm(`ลบ ${provider.name} keys?`)) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/v1/shops/${shopSlug}/payment-gateways/${saved.id}`,
        { method: "DELETE" },
      );
      if (res.ok) {
        toast.success(`ลบ ${provider.name} แล้ว`);
        await onChange();
      }
    } finally {
      setDeleting(false);
    }
  }

  async function toggleEnabled(next: boolean) {
    if (!saved) return;
    const res = await fetch(
      `/api/v1/shops/${shopSlug}/payment-gateways/${saved.id}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      },
    );
    if (res.ok) {
      toast.success(next ? "เปิดใช้งานแล้ว" : "ปิดใช้งานแล้ว");
      await onChange();
    }
  }

  if (isEditing) {
    return (
      <EditForm
        provider={provider}
        shopSlug={shopSlug}
        onCancel={onStopEdit}
        onSaved={() => {
          onStopEdit();
          void onChange();
        }}
      />
    );
  }

  return (
    <div className="rounded-2xl border border-[color:var(--color-border)] bg-white p-4">
      <div className="flex items-start gap-3">
        <div
          className="grid size-11 shrink-0 place-items-center rounded-xl text-base font-bold text-white"
          style={{ background: provider.brandColor }}
        >
          {provider.monogram}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold text-zinc-900">{provider.name}</p>
          <p className="mt-0.5 line-clamp-2 text-[11.5px] text-zinc-500">
            {provider.tagline}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {provider.supportsCards ? (
              <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-700">
                Cards
              </span>
            ) : null}
            {provider.supportsPromptPay ? (
              <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-700">
                PromptPay
              </span>
            ) : null}
            <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-700">
              {provider.currencies[0]}
            </span>
          </div>
        </div>
      </div>

      {saved ? (
        <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-2.5 text-[11.5px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {saved.lastTestStatus === "OK" ? (
                <CheckCircle2 className="size-3.5 text-emerald-600" />
              ) : saved.lastTestStatus === "FAILED" ? (
                <XCircle className="size-3.5 text-rose-600" />
              ) : (
                <Clock className="size-3.5 text-zinc-400" />
              )}
              <span className="font-semibold text-zinc-900">
                {saved.mode === "LIVE" ? "Live" : "Test"} keys
              </span>
              {saved.label ? (
                <span className="text-zinc-500">· {saved.label}</span>
              ) : null}
            </div>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={saved.enabled}
                onChange={(e) => void toggleEnabled(e.target.checked)}
                className="accent-rose-600"
              />
              <span className="text-[10.5px] font-semibold text-zinc-700">
                เปิดใช้
              </span>
            </label>
          </div>
          <p className="mt-1.5 font-mono text-[10.5px] text-zinc-500">
            Public: {saved.publicKeyMasked}
          </p>
          <p className="font-mono text-[10.5px] text-zinc-500">
            Secret: {saved.secretKeyMasked}
          </p>
          {saved.lastTestMessage ? (
            <p
              className={`mt-1.5 text-[10.5px] ${
                saved.lastTestStatus === "FAILED"
                  ? "text-rose-700"
                  : "text-zinc-500"
              }`}
            >
              {saved.lastTestMessage}
            </p>
          ) : null}
          <div className="mt-2 flex gap-1.5">
            <button
              type="button"
              onClick={retest}
              disabled={testing}
              className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[10.5px] font-semibold text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50"
            >
              {testing ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <RefreshCw className="size-3" />
              )}
              ตรวจอีกครั้ง
            </button>
            <button
              type="button"
              onClick={onStartEdit}
              className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[10.5px] font-semibold text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50"
            >
              แก้ keys
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={deleting}
              className="ml-auto inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[10.5px] font-semibold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50"
            >
              <Trash2 className="size-3" />
              ลบ
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-center justify-between gap-2">
          <a
            href={provider.dashboardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[color:var(--color-brand-700)] hover:underline"
          >
            ไปหา keys ใน dashboard
            <ExternalLink className="size-3" />
          </a>
          <Button size="sm" onClick={onStartEdit}>
            เชื่อมต่อ
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function EditForm({
  provider,
  shopSlug,
  onCancel,
  onSaved,
}: {
  provider: ProviderMetadata;
  shopSlug: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [mode, setMode] = useState<"TEST" | "LIVE">("TEST");
  const [publicKey, setPublicKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!publicKey || !secretKey) {
      toast.error("กรอก public + secret key ให้ครบ");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/shops/${shopSlug}/payment-gateways`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: provider.provider,
          mode,
          publicKey,
          secretKey,
          webhookSecret: webhookSecret || undefined,
          label: label || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        toast.error(json.error?.message ?? "บันทึกไม่สำเร็จ");
        return;
      }
      const test = json.data.test as {
        ok: boolean;
        accountLabel?: string;
        errorMessage?: string;
      };
      if (test.ok) {
        toast.success(`✓ เชื่อมต่อ ${provider.name} สำเร็จ`, {
          description: test.accountLabel,
        });
      } else {
        toast.error(`เซฟ keys ไว้แต่ตรวจไม่ผ่าน`, {
          description: test.errorMessage,
        });
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border-2 border-rose-300 bg-white p-4">
      <div className="flex items-start gap-3">
        <div
          className="grid size-9 shrink-0 place-items-center rounded-lg text-sm font-bold text-white"
          style={{ background: provider.brandColor }}
        >
          {provider.monogram}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold">{provider.name}</p>
          <a
            href={provider.dashboardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-[color:var(--color-brand-700)] hover:underline"
          >
            หา keys ที่ {provider.dashboardUrl.replace("https://", "")} ↗
          </a>
        </div>
      </div>

      <div className="mt-3 space-y-2.5">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-500">
            Mode
          </p>
          <div className="mt-1 flex gap-1.5">
            {(["TEST", "LIVE"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex-1 rounded-lg px-2 py-1.5 text-[11.5px] font-bold transition ${
                  mode === m
                    ? "bg-rose-600 text-white"
                    : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block">
            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-500">
              {provider.publicKeyLabel}
            </span>
            <input
              type="text"
              value={publicKey}
              onChange={(e) => setPublicKey(e.target.value)}
              autoComplete="off"
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-[12px] focus:border-rose-400 focus:outline-none"
              placeholder={provider.publicKeyLabel}
            />
          </label>
        </div>

        <div>
          <label className="block">
            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-500">
              {provider.secretKeyLabel}
            </span>
            <input
              type="password"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              autoComplete="off"
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-[12px] focus:border-rose-400 focus:outline-none"
              placeholder={provider.secretKeyLabel}
            />
          </label>
        </div>

        {provider.hasWebhookSecret ? (
          <div>
            <label className="block">
              <span className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-500">
                Webhook Signing Secret (option)
              </span>
              <input
                type="password"
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                autoComplete="off"
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-[12px] focus:border-rose-400 focus:outline-none"
                placeholder="whsec_..."
              />
            </label>
          </div>
        ) : null}

        <div>
          <label className="block">
            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-500">
              Label (option · กันสับสนถ้ามีหลายบัญชี)
            </span>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={80}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-[12px] focus:border-rose-400 focus:outline-none"
              placeholder="เช่น ร้านสาขาสยาม"
            />
          </label>
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            ยกเลิก
          </Button>
          <Button onClick={submit} disabled={saving} className="flex-1">
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "บันทึก + ตรวจ keys"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function RoadmapCard({ provider }: { provider: ProviderMetadata }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/60 p-3">
      <div className="flex items-center gap-2">
        <div
          className="grid size-8 place-items-center rounded-lg text-sm font-bold text-white opacity-70"
          style={{ background: provider.brandColor }}
        >
          {provider.monogram}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-bold text-zinc-700">
            {provider.name}
          </p>
          <p className="text-[10px] text-zinc-500">
            {provider.roadmapEta
              ? `Coming soon · ${provider.roadmapEta}`
              : "Coming soon"}
          </p>
        </div>
      </div>
      <p className="mt-2 line-clamp-2 text-[10.5px] text-zinc-500">
        {provider.tagline}
      </p>
    </div>
  );
}
