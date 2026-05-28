"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  Loader2,
  RefreshCw,
  Trash2,
  Copy,
  AlertCircle,
  Globe,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface SavedDomain {
  id: string;
  domain: string;
  ns1: string | null;
  ns2: string | null;
  status: "PENDING_DNS" | "VERIFYING" | "VERIFIED" | "FAILED";
  failedReason: string | null;
  verifiedAt: string | null;
  lastCheckedAt: string | null;
  createdAt: string;
}

export function DomainsPanel({ shopSlug }: { shopSlug: string }) {
  const [domains, setDomains] = useState<SavedDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDomain, setNewDomain] = useState("");
  const [adding, setAdding] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/shops/${shopSlug}/domains`);
      const json = await res.json();
      if (res.ok && json.ok) {
        setDomains(json.data.domains as SavedDomain[]);
      } else if (res.status === 402) {
        toast.error(json.error?.message ?? "ต้องอัปเกรดเป็น Business+");
      }
    } finally {
      setLoading(false);
    }
  }, [shopSlug]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  async function add() {
    const trimmed = newDomain
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "");
    if (!/^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(trimmed)) {
      toast.error("ใส่ชื่อโดเมนเต็มๆ เช่น mystore.com");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch(`/api/v1/shops/${shopSlug}/domains`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain: trimmed }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        toast.error(json.error?.message ?? "เพิ่มไม่สำเร็จ");
        return;
      }
      toast.success("เพิ่มโดเมนแล้ว", {
        description: "ดู NS1/NS2 ด้านล่าง — เอาไปใส่ที่ registrar ของคุณ",
      });
      setNewDomain("");
      await refresh();
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="mt-6 space-y-6">
      <section className="rounded-2xl border border-[color:var(--color-border)] bg-white p-5">
        <h2 className="font-display text-base font-bold">เพิ่มโดเมนใหม่</h2>
        <p className="mt-1 text-[12px] text-zinc-500">
          ซื้อโดเมนจากที่ไหนก็ได้ (GoDaddy / Cloudflare / NameCheap / GMO ฯลฯ) → พิมพ์ชื่อด้านล่าง → เราจะออก NS1/NS2 ให้
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !adding) void add();
            }}
            placeholder="เช่น mystore.com"
            autoComplete="off"
            className="flex-1 rounded-xl border-2 border-zinc-300 px-3 py-2.5 font-mono text-[13px] focus:border-rose-400 focus:outline-none"
          />
          <Button onClick={add} disabled={adding || !newDomain.trim()}>
            {adding ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "เพิ่มโดเมน"
            )}
          </Button>
        </div>
      </section>

      {loading ? (
        <div className="flex items-center gap-2 text-[13px] text-zinc-500">
          <Loader2 className="size-4 animate-spin" /> กำลังโหลดโดเมน...
        </div>
      ) : domains.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/60 p-6 text-center">
          <Globe className="mx-auto size-6 text-zinc-400" />
          <p className="mt-2 text-[13px] font-semibold text-zinc-600">
            ยังไม่มีโดเมนที่ผูกไว้
          </p>
          <p className="mt-1 text-[11.5px] text-zinc-500">
            เริ่มต้นด้วยช่องด้านบน — ใช้เวลาประมาณ 15-30 นาที DNS propagate
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {domains.map((d) => (
            <DomainCard
              key={d.id}
              domain={d}
              shopSlug={shopSlug}
              onChange={refresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DomainCard({
  domain,
  shopSlug,
  onChange,
}: {
  domain: SavedDomain;
  shopSlug: string;
  onChange: () => void | Promise<void>;
}) {
  const [verifying, setVerifying] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function verify() {
    setVerifying(true);
    try {
      const res = await fetch(
        `/api/v1/shops/${shopSlug}/domains/${domain.id}/verify`,
        { method: "POST" },
      );
      const json = await res.json();
      if (!res.ok || !json.ok) {
        toast.error(json.error?.message ?? "เช็คไม่สำเร็จ");
        return;
      }
      if (json.data.verified || json.data.status === "VERIFIED") {
        toast.success("✓ โดเมนพร้อมใช้งานแล้ว!");
      } else {
        toast.info(
          `สถานะ: ${json.data.cfZoneStatus ?? "pending"} — DNS อาจยังไม่ propagate (รอ 15-30 นาที)`,
        );
      }
      await onChange();
    } finally {
      setVerifying(false);
    }
  }

  async function remove() {
    if (!confirm(`ลบ ${domain.domain}?`)) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/v1/shops/${shopSlug}/domains/${domain.id}`,
        { method: "DELETE" },
      );
      if (res.ok) {
        toast.success(`ลบ ${domain.domain} แล้ว`);
        await onChange();
      }
    } finally {
      setDeleting(false);
    }
  }

  const isVerified = domain.status === "VERIFIED";

  return (
    <div
      className={`rounded-2xl border p-4 ${
        isVerified
          ? "border-emerald-200 bg-emerald-50/40"
          : domain.status === "FAILED"
            ? "border-rose-200 bg-rose-50/40"
            : "border-amber-200 bg-amber-50/40"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {isVerified ? (
              <CheckCircle2 className="size-4 text-emerald-600" />
            ) : domain.status === "FAILED" ? (
              <AlertCircle className="size-4 text-rose-600" />
            ) : (
              <Loader2 className="size-4 animate-spin text-amber-600" />
            )}
            <p className="font-mono text-[14px] font-bold text-zinc-900">
              {domain.domain}
            </p>
            <span
              className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider ${
                isVerified
                  ? "bg-emerald-600 text-white"
                  : domain.status === "FAILED"
                    ? "bg-rose-600 text-white"
                    : "bg-amber-500 text-white"
              }`}
            >
              {isVerified
                ? "Verified"
                : domain.status === "FAILED"
                  ? "Failed"
                  : "Pending DNS"}
            </span>
          </div>
          {domain.verifiedAt ? (
            <p className="mt-0.5 text-[11px] text-emerald-700">
              ใช้งานได้ตั้งแต่ {new Date(domain.verifiedAt).toLocaleString("th-TH")}
            </p>
          ) : null}
          {domain.failedReason ? (
            <p className="mt-1 text-[11px] text-rose-700">
              {domain.failedReason}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-1.5">
          {!isVerified ? (
            <Button
              size="sm"
              variant="outline"
              onClick={verify}
              disabled={verifying}
            >
              {verifying ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <>
                  <RefreshCw className="size-3.5" />
                  เช็คเลย
                </>
              )}
            </Button>
          ) : (
            <a
              href={`https://${domain.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-[11.5px] font-semibold text-emerald-700 hover:bg-emerald-50"
            >
              <ExternalLink className="size-3.5" />
              เปิดร้าน
            </a>
          )}
          <button
            type="button"
            onClick={remove}
            disabled={deleting}
            className="inline-flex size-8 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 hover:bg-rose-50 hover:text-rose-700"
            title="ลบ"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      {/* NS instructions */}
      {!isVerified && domain.ns1 && domain.ns2 ? (
        <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-3.5">
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-zinc-500">
            ขั้นตอน — ไปที่ registrar ของคุณ แล้วเปลี่ยน Nameservers เป็น 2 ตัวนี้
          </p>
          <div className="mt-2 space-y-1.5">
            <NsRow ns={domain.ns1} label="NS 1" />
            <NsRow ns={domain.ns2} label="NS 2" />
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-zinc-600">
            <strong>หลังเปลี่ยนแล้ว:</strong> รอ DNS propagate ~15-30 นาที (บางครั้งถึง 24 ชม.) แล้วกด <strong>&ldquo;เช็คเลย&rdquo;</strong> ด้านบน
          </p>
          <p className="mt-1 text-[10.5px] text-amber-700">
            ⚠ การเปลี่ยน NS = DNS records ทั้งหมดของโดเมนนี้ (รวม email/MX) จะย้ายมา Cloudflare — ถ้าใช้ email @{domain.domain} ติดต่อทีมเราก่อนเพื่อ migrate
          </p>
        </div>
      ) : null}
    </div>
  );
}

function NsRow({ ns, label }: { ns: string; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2">
      <span className="w-12 text-[10.5px] font-bold uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <code className="flex-1 truncate font-mono text-[12.5px] font-bold text-zinc-900">
        {ns}
      </code>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(ns);
          toast.success("คัดลอกแล้ว");
        }}
        className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[10.5px] font-semibold text-zinc-700 hover:bg-zinc-100"
      >
        <Copy className="size-3" />
        คัดลอก
      </button>
    </div>
  );
}
