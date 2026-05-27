"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  ImageIcon,
  Link2,
  Loader2,
  Sparkles,
  Store,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button, buttonStyles } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

/**
 * Two-tab bulk product importer.
 *
 * Workflow:
 *  - Tab 1 (CSV/XLSX): drop a file → POST preview → render column-mapping
 *    summary + preview table → confirm → POST commit.
 *  - Tab 2 (URLs): paste lines → POST preview → render product cards with
 *    inline edits (name + price + images) → confirm → POST commit.
 *
 * Shape decisions:
 *  - Preview rows live in local state and are POSTed verbatim on commit
 *    (no re-upload of the original CSV) so the seller can tweak rows
 *    before they hit the DB.
 *  - Image grid is read-only for V1 — we re-host every image server-side
 *    to Vercel Blob during commit so the seller doesn't need to upload
 *    them. Image removal happens via the product edit page after commit.
 */

interface ImportedProduct {
  tempId: string;
  name: string;
  description: string | null;
  priceSatang: number;
  compareAtSatang: number | null;
  shippingFeeSatang: number;
  imageUrls: string[];
  stock: number | null;
  type: "PHYSICAL" | "DIGITAL";
  source: string;
  sourceUrl: string | null;
  warnings: string[];
}

interface Props {
  shopSlug: string;
  shopName: string;
}

type Tab = "shop" | "csv" | "url";

export function ImportPanel({ shopSlug, shopName }: Props) {
  // Default to the "shop URL + AI" tab — it's the marketing hook
  // (911korn 2026-05-27 "เอา Link ร้านมาใส่ แล้ว Ai เราทำให้หมดแบบจบๆ ·
  // จะได้โปรโมทง่ายเวลาจะให้คนย้ายมาสร้างร้าน").
  const [tab, setTab] = useState<Tab>("shop");

  return (
    <div className="mt-8 rounded-3xl border border-[color:var(--color-border)] bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap gap-2 rounded-xl bg-[color:var(--color-soft)] p-1">
        <TabButton active={tab === "shop"} onClick={() => setTab("shop")}>
          <Sparkles className="size-4" /> วางลิงก์ร้าน · AI ทำให้
        </TabButton>
        <TabButton active={tab === "csv"} onClick={() => setTab("csv")}>
          <FileSpreadsheet className="size-4" /> ไฟล์ Shopee/Lazada
        </TabButton>
        <TabButton active={tab === "url"} onClick={() => setTab("url")}>
          <Link2 className="size-4" /> ลิงก์สินค้าทีละชิ้น
        </TabButton>
      </div>

      <div className="mt-6">
        {tab === "shop" ? (
          <ShopUrlImporter shopSlug={shopSlug} shopName={shopName} />
        ) : tab === "csv" ? (
          <CsvImporter shopSlug={shopSlug} shopName={shopName} />
        ) : (
          <UrlImporter shopSlug={shopSlug} shopName={shopName} />
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition",
        active
          ? "bg-white text-[color:var(--color-brand-700)] shadow-sm"
          : "text-zinc-500 hover:text-zinc-900",
      )}
    >
      {children}
    </button>
  );
}

// ─── CSV importer ────────────────────────────────────────────────────────

function CsvImporter({ shopSlug, shopName }: Props) {
  const router = useRouter();
  const [parsing, setParsing] = useState(false);
  const [committing, startCommit] = useTransition();
  const [filePayload, setFilePayload] = useState<
    | { fileBase64: string; fileText?: undefined }
    | { fileText: string; fileBase64?: undefined }
    | null
  >(null);
  const [preview, setPreview] = useState<{
    detected: string;
    mapping: Record<string, string | null>;
    totalRows: number;
    previewRows: ImportedProduct[];
    warnings: string[];
  } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setParsing(true);
    setPreview(null);
    setSelected(new Set());
    try {
      const isXlsx = /\.xlsx?$/.test(f.name);
      let payload: typeof filePayload;
      if (isXlsx) {
        const buf = await f.arrayBuffer();
        const b64 = bufferToBase64(buf);
        payload = { fileBase64: b64 };
      } else {
        const text = await f.text();
        payload = { fileText: text };
      }
      setFilePayload(payload);
      const res = await fetch(`/api/v1/shops/${shopSlug}/import/csv`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "preview", ...payload }),
      });
      const json = await res.json();
      if (!json.ok) {
        toast.error(json.error?.message ?? "อ่านไฟล์ไม่สำเร็จ");
        return;
      }
      setPreview(json.data);
      setSelected(new Set((json.data.previewRows as ImportedProduct[]).map((p) => p.tempId)));
      toast.success(
        `เจอ ${json.data.totalRows} แถว — รูปแบบที่ตรวจพบ: ${json.data.detected}`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "อ่านไฟล์ไม่สำเร็จ");
    } finally {
      setParsing(false);
      e.target.value = "";
    }
  }

  function toggleRow(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function commit() {
    if (!preview || !filePayload) return;
    if (selected.size === 0) {
      toast.error("กรุณาเลือกอย่างน้อย 1 สินค้า");
      return;
    }
    startCommit(async () => {
      const res = await fetch(`/api/v1/shops/${shopSlug}/import/csv`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "commit",
          ...filePayload,
          mapping: preview.mapping,
          selectedTempIds: Array.from(selected),
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        toast.error(json.error?.message ?? "นำเข้าไม่สำเร็จ");
        return;
      }
      toast.success(
        `นำเข้า ${json.data.createdCount} สินค้าสำเร็จ${
          json.data.skippedCount > 0 ? ` · ข้าม ${json.data.skippedCount}` : ""
        }`,
      );
      router.push(`/dashboard/products?shop=${shopSlug}`);
      router.refresh();
    });
  }

  return (
    <div>
      <p className="text-sm text-zinc-600">
        ดาวน์โหลดไฟล์ <strong>Export Excel</strong> จาก Shopee Seller Center หรือ
        Lazada Seller Center แล้วลากมาวางที่นี่ — ระบบจะตรวจจับคอลัมน์ให้อัตโนมัติ
        (Shopee/Lazada/ทั่วไป)
      </p>

      <label
        className={cn(
          "mt-4 flex h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[color:var(--color-border)] bg-[color:var(--color-soft)] text-sm font-medium text-zinc-600 transition",
          "hover:border-[color:var(--color-brand-300)] hover:text-[color:var(--color-brand-700)]",
          parsing && "pointer-events-none opacity-60",
        )}
      >
        {parsing ? (
          <>
            <Loader2 className="size-6 animate-spin" />
            <span>กำลังอ่านไฟล์…</span>
          </>
        ) : (
          <>
            <FileSpreadsheet className="size-6" />
            <span>แตะเพื่อเลือกไฟล์ .csv / .xlsx / .xls</span>
          </>
        )}
        <input
          type="file"
          accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={onFile}
          disabled={parsing}
          className="hidden"
        />
      </label>

      {preview ? (
        <div className="mt-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="text-sm text-zinc-600">
              พบ <strong>{preview.totalRows}</strong> แถว · เลือก {selected.size} / {preview.previewRows.length} (แสดง 50 แถวแรก)
            </p>
            <Button onClick={commit} loading={committing} disabled={selected.size === 0}>
              นำเข้า {selected.size} สินค้าเข้า {shopName}
            </Button>
          </div>

          {preview.warnings.length > 0 ? (
            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-800">
              {preview.warnings.map((w, i) => (
                <p key={i}>· {w}</p>
              ))}
            </div>
          ) : null}

          <PreviewList
            products={preview.previewRows}
            selected={selected}
            onToggle={toggleRow}
          />
        </div>
      ) : null}
    </div>
  );
}

// ─── Shop-URL importer (paste shop link, AI extracts everything) ───────

function ShopUrlImporter({ shopSlug, shopName }: Props) {
  const router = useRouter();
  const [shopUrl, setShopUrl] = useState("");
  const [fetching, setFetching] = useState(false);
  const [committing, startCommit] = useTransition();
  const [previews, setPreviews] = useState<ImportedProduct[]>([]);
  const [failures, setFailures] = useState<{ url: string; reason: string }[]>([]);
  const [platform, setPlatform] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  async function fetchShopProducts() {
    if (!/^https?:\/\//i.test(shopUrl.trim())) {
      toast.error("ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://");
      return;
    }
    setFetching(true);
    setPreviews([]);
    setFailures([]);
    setPlatform(null);
    try {
      const res = await fetch(`/api/v1/shops/${shopSlug}/import/shop-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: shopUrl.trim() }),
      });
      const json = await res.json();
      if (!json.ok) {
        toast.error(json.error?.message ?? "ดึงข้อมูลร้านไม่สำเร็จ");
        return;
      }
      setPlatform(json.data.platform);
      setPreviews(json.data.successes);
      setFailures(json.data.failures);
      setSelected(
        new Set((json.data.successes as ImportedProduct[]).map((p) => p.tempId)),
      );
      if (json.data.successes.length === 0) {
        toast.error("ไม่พบสินค้าในหน้านี้ — ลองวางลิงก์หน้ารวมสินค้า (All products)");
      } else {
        toast.success(
          `เจอ ${json.data.successes.length} สินค้า (${labelForPlatform(json.data.platform)})`,
        );
      }
    } finally {
      setFetching(false);
    }
  }

  function commit() {
    const toCommit = previews.filter((p) => selected.has(p.tempId));
    if (toCommit.length === 0) {
      toast.error("เลือกอย่างน้อย 1 สินค้า");
      return;
    }
    startCommit(async () => {
      const res = await fetch(`/api/v1/shops/${shopSlug}/import/url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "commit", products: toCommit }),
      });
      const json = await res.json();
      if (!json.ok) {
        toast.error(json.error?.message ?? "นำเข้าไม่สำเร็จ");
        return;
      }
      toast.success(`นำเข้า ${json.data.createdCount} สินค้าสำเร็จ`);
      router.push(`/dashboard/products?shop=${shopSlug}`);
      router.refresh();
    });
  }

  function updatePreview(tempId: string, patch: Partial<ImportedProduct>) {
    setPreviews((arr) => arr.map((p) => (p.tempId === tempId ? { ...p, ...patch } : p)));
  }

  return (
    <div>
      <div className="rounded-2xl border border-[color:var(--color-brand-200)] bg-gradient-to-br from-rose-50 to-white p-5">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[color:var(--color-brand-600)] text-white">
            <Sparkles className="size-5" />
          </div>
          <div>
            <h3 className="font-display text-base font-bold text-zinc-900">
              วางลิงก์ร้านของคุณ — AI ดึงสินค้าทุกชิ้นให้
            </h3>
            <p className="mt-1 text-[13px] leading-relaxed text-zinc-600">
              รองรับ <strong>Shopify</strong>, <strong>Lazada</strong>, <strong>TikTok Shop</strong>, <strong>Instagram Shopping</strong>, WooCommerce, Squarespace, BigCommerce และเว็บร้านอื่น ๆ
              <br />
              ระบบ AI จะอ่านหน้าร้านและดึง ชื่อ-ราคา-รูป-รายละเอียด ทุกสินค้าออกมาให้พรีวิวทันที (สูงสุด 100 ชิ้นต่อรอบ)
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <label className="text-[12px] font-semibold text-zinc-700">ลิงก์ร้านของคุณ</label>
        <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2 focus-within:border-[color:var(--color-brand-400)]">
            <Store className="size-4 shrink-0 text-zinc-400" />
            <input
              value={shopUrl}
              onChange={(e) => setShopUrl(e.target.value)}
              placeholder="https://your-shop.myshopify.com  หรือ  https://www.lazada.co.th/shop/..."
              className="flex-1 bg-transparent text-sm text-zinc-800 placeholder:text-zinc-400 focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter") fetchShopProducts();
              }}
            />
          </div>
          <Button onClick={fetchShopProducts} loading={fetching}>
            {fetching ? "AI กำลังอ่าน…" : "ดึงสินค้าทั้งร้าน"}
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-zinc-500">
          ตัวอย่าง: <code>https://shop.tiktok.com/@yourshop</code> · <code>https://www.lazada.co.th/shop/your-shop</code> · <code>https://www.example.com</code>
        </p>
      </div>

      <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-900">
        <p className="font-semibold">หมายเหตุสำหรับ Shopee</p>
        <p className="mt-0.5 leading-relaxed">
          Shopee ป้องกัน import แบบลิงก์ — กรุณาใช้แท็บ <strong>"ไฟล์ Shopee/Lazada"</strong>
          แล้วส่งออกไฟล์ Excel จาก <a
            href="https://seller.shopee.co.th/portal/product/list/all"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >Shopee Seller Center → คลังสินค้าของฉัน → ส่งออก</a> มาอัปโหลด
        </p>
      </div>

      {platform ? (
        <p className="mt-4 text-[12px] text-zinc-500">
          ตรวจพบแพลตฟอร์ม: <strong className="text-zinc-700">{labelForPlatform(platform)}</strong>
        </p>
      ) : null}

      {failures.length > 0 ? (
        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-800">
          <p className="mb-1 font-semibold">
            <AlertTriangle className="mr-1 inline size-3.5" />
            มี {failures.length} สินค้าที่ดึงไม่ได้
          </p>
          {failures.slice(0, 3).map((f, i) => (
            <p key={i} className="truncate">· {f.reason}</p>
          ))}
        </div>
      ) : null}

      {previews.length > 0 ? (
        <div className="mt-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="text-sm text-zinc-600">
              พรีวิว {previews.length} สินค้า · เลือก {selected.size} ชิ้น
            </p>
            <Button onClick={commit} loading={committing} disabled={selected.size === 0}>
              นำเข้า {selected.size} สินค้าเข้า {shopName}
            </Button>
          </div>

          <PreviewList
            products={previews}
            selected={selected}
            onToggle={(id) =>
              setSelected((s) => {
                const next = new Set(s);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              })
            }
            editable
            onEdit={updatePreview}
          />
        </div>
      ) : null}
    </div>
  );
}

function labelForPlatform(p: string): string {
  switch (p) {
    case "shopify":
      return "Shopify";
    case "lazada":
      return "Lazada";
    case "shopee":
      return "Shopee";
    case "ai-extracted":
      return "AI extracted";
    default:
      return p;
  }
}

// ─── URL importer ────────────────────────────────────────────────────────

function UrlImporter({ shopSlug, shopName }: Props) {
  const router = useRouter();
  const [urlsText, setUrlsText] = useState("");
  const [fetching, setFetching] = useState(false);
  const [committing, startCommit] = useTransition();
  const [previews, setPreviews] = useState<ImportedProduct[]>([]);
  const [failures, setFailures] = useState<{ url: string; reason: string }[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  async function fetchPreviews() {
    const urls = urlsText
      .split(/[\n,]/)
      .map((u) => u.trim())
      .filter((u) => /^https?:\/\//i.test(u));
    if (urls.length === 0) {
      toast.error("กรุณาวางลิงก์สินค้าอย่างน้อย 1 ลิงก์");
      return;
    }
    if (urls.length > 50) {
      toast.error("วางได้สูงสุด 50 ลิงก์ต่อรอบ");
      return;
    }
    setFetching(true);
    try {
      const res = await fetch(`/api/v1/shops/${shopSlug}/import/url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "preview", urls }),
      });
      const json = await res.json();
      if (!json.ok) {
        toast.error(json.error?.message ?? "ดึงข้อมูลไม่สำเร็จ");
        return;
      }
      setPreviews(json.data.successes);
      setFailures(json.data.failures);
      setSelected(new Set((json.data.successes as ImportedProduct[]).map((p) => p.tempId)));
      if (json.data.successes.length > 0) {
        toast.success(
          `ดึงสำเร็จ ${json.data.successes.length} / ${urls.length} ลิงก์`,
        );
      }
    } finally {
      setFetching(false);
    }
  }

  function commit() {
    const toCommit = previews.filter((p) => selected.has(p.tempId));
    if (toCommit.length === 0) {
      toast.error("เลือกอย่างน้อย 1 สินค้า");
      return;
    }
    startCommit(async () => {
      const res = await fetch(`/api/v1/shops/${shopSlug}/import/url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "commit", products: toCommit }),
      });
      const json = await res.json();
      if (!json.ok) {
        toast.error(json.error?.message ?? "นำเข้าไม่สำเร็จ");
        return;
      }
      toast.success(`นำเข้า ${json.data.createdCount} สินค้าสำเร็จ`);
      router.push(`/dashboard/products?shop=${shopSlug}`);
      router.refresh();
    });
  }

  function updatePreview(tempId: string, patch: Partial<ImportedProduct>) {
    setPreviews((arr) => arr.map((p) => (p.tempId === tempId ? { ...p, ...patch } : p)));
  }

  return (
    <div>
      <p className="text-sm text-zinc-600">
        วางลิงก์สินค้าจาก <strong>Lazada</strong> / <strong>TikTok Shop</strong> /
        Shopify / WooCommerce / Instagram Shopping หรือเว็บที่มี structured-data —
        วางได้สูงสุด 50 ลิงก์ต่อรอบ (1 ลิงก์ต่อบรรทัด)
      </p>
      <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-900">
        <p className="font-semibold">หมายเหตุสำหรับ Shopee</p>
        <p className="mt-0.5 leading-relaxed">
          Shopee ป้องกัน import แบบลิงก์ — กรุณาใช้แท็บ <strong>"ไฟล์ Shopee/Lazada"</strong>
          ด้านบน แล้วส่งออกไฟล์ Excel จาก <a
            href="https://seller.shopee.co.th/portal/product/list/all"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >Shopee Seller Center → คลังสินค้าของฉัน → ส่งออก</a> มาอัปโหลด
        </p>
      </div>

      <textarea
        value={urlsText}
        onChange={(e) => setUrlsText(e.target.value)}
        rows={6}
        placeholder={"https://shopee.co.th/...\nhttps://www.lazada.co.th/products/..."}
        className="mt-4 w-full rounded-2xl border border-[color:var(--color-border)] bg-white px-3 py-2 text-sm font-mono text-zinc-800 focus:border-[color:var(--color-brand-400)] focus:outline-none"
      />

      <div className="mt-3 flex justify-end">
        <Button onClick={fetchPreviews} loading={fetching}>
          ดึงข้อมูลจากลิงก์
        </Button>
      </div>

      {failures.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-800">
          <p className="mb-1 font-semibold">
            <AlertTriangle className="mr-1 inline size-3.5" />
            ดึง {failures.length} ลิงก์ไม่ได้
          </p>
          {failures.map((f, i) => (
            <p key={i} className="truncate">
              · <a href={f.url} target="_blank" rel="noreferrer" className="underline">{f.url}</a> — {f.reason}
            </p>
          ))}
        </div>
      ) : null}

      {previews.length > 0 ? (
        <div className="mt-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="text-sm text-zinc-600">
              พรีวิว {previews.length} สินค้า · เลือก {selected.size} ชิ้น
            </p>
            <Button onClick={commit} loading={committing} disabled={selected.size === 0}>
              นำเข้า {selected.size} สินค้าเข้า {shopName}
            </Button>
          </div>

          <PreviewList
            products={previews}
            selected={selected}
            onToggle={(id) =>
              setSelected((s) => {
                const next = new Set(s);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              })
            }
            editable
            onEdit={updatePreview}
          />
        </div>
      ) : null}
    </div>
  );
}

// ─── Shared preview list ─────────────────────────────────────────────────

function PreviewList({
  products,
  selected,
  onToggle,
  editable,
  onEdit,
}: {
  products: ImportedProduct[];
  selected: Set<string>;
  onToggle: (tempId: string) => void;
  editable?: boolean;
  onEdit?: (tempId: string, patch: Partial<ImportedProduct>) => void;
}) {
  return (
    <ul className="mt-4 divide-y divide-[color:var(--color-border)] rounded-2xl border border-[color:var(--color-border)] bg-white">
      {products.map((p) => {
        const isSelected = selected.has(p.tempId);
        return (
          <li key={p.tempId} className="flex gap-4 p-4">
            <div className="flex items-start pt-1">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggle(p.tempId)}
                className="size-4 accent-[color:var(--color-brand-600)]"
              />
            </div>
            <div className="size-20 shrink-0 overflow-hidden rounded-xl bg-[color:var(--color-soft)]">
              {p.imageUrls[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.imageUrls[0]}
                  alt={p.name}
                  className="size-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <div className="grid size-full place-items-center text-zinc-300">
                  <ImageIcon className="size-7" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              {editable && onEdit ? (
                <>
                  <Input
                    value={p.name}
                    onChange={(e) => onEdit(p.tempId, { name: e.target.value })}
                    className="text-sm font-semibold"
                  />
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                    <span>ราคา:</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={p.priceSatang / 100}
                      onChange={(e) =>
                        onEdit(p.tempId, {
                          priceSatang: Math.round(Number(e.target.value) * 100) || 0,
                        })
                      }
                      className="w-24 rounded-lg border border-[color:var(--color-border)] px-2 py-1 text-zinc-800"
                    />
                    <span>บาท · รูป {p.imageUrls.length} ไฟล์</span>
                  </div>
                </>
              ) : (
                <>
                  <p className="line-clamp-2 text-sm font-semibold text-zinc-800">
                    {p.name}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    ฿{(p.priceSatang / 100).toLocaleString()}
                    {p.compareAtSatang
                      ? ` · เดิม ฿${(p.compareAtSatang / 100).toLocaleString()}`
                      : ""}
                    {p.stock != null ? ` · สต็อก ${p.stock}` : ""}
                    {" · รูป "}{p.imageUrls.length}{" ไฟล์"}
                  </p>
                </>
              )}
              {p.sourceUrl ? (
                <p className="mt-1 truncate text-[11px] text-zinc-400">
                  ที่มา: <a href={p.sourceUrl} target="_blank" rel="noreferrer" className="underline">{p.sourceUrl}</a>
                </p>
              ) : null}
              {p.warnings.length > 0 ? (
                <ul className="mt-1 space-y-0.5 text-[11px] text-amber-700">
                  {p.warnings.map((w, i) => (
                    <li key={i}>· {w}</li>
                  ))}
                </ul>
              ) : null}
            </div>
            {!isSelected ? (
              <button
                type="button"
                onClick={() => onToggle(p.tempId)}
                className="text-zinc-300 hover:text-zinc-500"
                aria-label="เพิ่ม"
              >
                <CheckCircle2 className="size-5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onToggle(p.tempId)}
                className="text-zinc-400 hover:text-rose-600"
                aria-label="ลบออก"
              >
                <Trash2 className="size-5" />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(bin);
}
