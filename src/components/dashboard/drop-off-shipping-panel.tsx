"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Printer,
  Camera,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Drop-off shipping panel — replaces the EasyParcel auto-label panel.
 *
 * Two CTAs:
 *   1. "พิมพ์ใบปะหน้า" → opens /api/v1/orders/[token]/shipment/label in
 *      a new tab (returns ready-to-print HTML; seller hits Cmd+P).
 *   2. "อัปโหลดใบเสร็จขนส่ง" → file picker. We base64-encode + POST to
 *      /shipment/receipt. Server runs Claude vision OCR, matches the
 *      receiver name to the order, auto-fills `trackingNumber`, flips
 *      PAID→SHIPPING, emails buyer.
 *
 * Free for every seller — no Pro gate. 911korn 2026-05-27 "ใส่ระบบนี้
 * ไปให้ทุก tier ได้เลยตั้งแต่ฟรี เป็นจุดขายเลย".
 */

interface Props {
  token: string;
  orderStatus: "PAID" | "SHIPPING" | string;
  initialTrackingNumber: string | null;
  initialReceiptUrl: string | null;
  initialLabelGeneratedAt: string | null;
  /** Shop slug — used to navigate back to /dashboard/orders after a
   *  successful scan so the seller doesn't get stranded on the same
   *  page (911korn 2026-05-27 "กดยืนยันแล้วมันควรมี Success page").  */
  shopSlug: string;
}

export function DropOffShippingPanel({
  token,
  orderStatus,
  initialTrackingNumber,
  initialReceiptUrl,
  initialLabelGeneratedAt,
  shopSlug,
}: Props) {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [tracking, setTracking] = useState(initialTrackingNumber);
  const [receiptUrl, setReceiptUrl] = useState(initialReceiptUrl);
  const [labelGeneratedAt, setLabelGeneratedAt] = useState(
    initialLabelGeneratedAt,
  );
  const [pendingScan, setPendingScan] = useState<{
    receiverName: string | null;
    trackingNumber: string;
    courier: string | null;
    receiptUrl: string;
    message: string;
    /** `name_mismatch` = OCR read a name and it disagrees with the order ·
     *  `name_unreadable` = OCR couldn't find any receiver name on the
     *  receipt (e.g. Thailand Post / J&T eCo — they don't print one). */
    reason: "name_mismatch" | "name_unreadable";
  } | null>(null);

  async function uploadReceipt(file: File, confirmOverride = false) {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("รูปใหญ่เกินไป (เกิน 5 MB)");
      return;
    }
    setScanning(true);
    try {
      const dataBase64 = await fileToBase64(file);
      const res = await fetch(
        `/api/v1/orders/${token}/shipment/receipt`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            dataBase64,
            contentType: file.type.startsWith("image/png")
              ? "image/png"
              : file.type.startsWith("image/webp")
                ? "image/webp"
                : "image/jpeg",
            confirmOverride,
          }),
        },
      );
      const json = (await res.json()) as {
        ok: boolean;
        data?: {
          ok: boolean;
          trackingNumber?: string;
          courier?: string | null;
          receiverName?: string | null;
          nameMatched?: boolean | null;
          receiptUrl?: string;
          reason?: string;
          message?: string;
          scan?: {
            trackingNumber: string | null;
            receiverName: string | null;
            courier: string | null;
          };
        };
        error?: { message?: string };
      };
      if (!res.ok || !json.ok) {
        toast.error(json.error?.message ?? "อัปโหลดไม่สำเร็จ");
        return;
      }
      const d = json.data!;
      if (d.ok && d.trackingNumber) {
        setTracking(d.trackingNumber);
        setReceiptUrl(d.receiptUrl ?? null);
        setPendingScan(null);
        // Lingering toast — survives the navigation below so the seller
        // can read the captured tracking number on the orders list.
        toast.success("ส่งของสำเร็จ · ลูกค้าได้รับ email + LINE แล้ว", {
          description: `tracking ${d.trackingNumber}${d.courier ? ` · ${courierLabel(d.courier)}` : ""}`,
          duration: 8000,
        });
        // Auto-navigate to the orders list so the seller can pick the
        // next order to ship instead of getting stranded on the same
        // page (911korn 2026-05-27 "ระบบมัน ไม่ Redirect ไปไหน อยู่
        // หน้าเดิมทำให้งง"). They can still tap the order row in the
        // list to verify the tracking landed correctly.
        router.push(`/dashboard/orders?shop=${encodeURIComponent(shopSlug)}`);
        router.refresh();
        return;
      }
      // Soft-fail — pending confirm. Both name_mismatch (OCR read a wrong
      // name) and name_unreadable (OCR couldn't read any name — common on
      // Thailand Post / J&T eCo receipts) route to the same pending-scan
      // confirm UI so the seller has to take a deliberate action before
      // the order auto-flips to SHIPPING.
      if (
        (d.reason === "name_mismatch" || d.reason === "name_unreadable") &&
        d.scan?.trackingNumber
      ) {
        setPendingScan({
          receiverName: d.scan.receiverName,
          trackingNumber: d.scan.trackingNumber,
          courier: d.scan.courier,
          receiptUrl: d.receiptUrl!,
          message: d.message ?? "ขอยืนยันก่อนส่ง",
          reason: d.reason,
        });
        setReceiptUrl(d.receiptUrl ?? null);
      } else if (d.reason === "no_tracking") {
        setReceiptUrl(d.receiptUrl ?? null);
        toast.error(d.message ?? "ไม่เจอเลข tracking บนรูปนี้");
      } else {
        toast.error(d.message ?? "ไม่สำเร็จ");
      }
    } finally {
      setScanning(false);
    }
  }

  // Already shipped — compact summary card
  if (tracking) {
    return (
      <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-5 text-emerald-700" />
          <h2 className="text-base font-bold text-emerald-900">
            ส่งของแล้ว · AI scan เลขให้แล้ว
          </h2>
        </div>
        <p className="mt-3 font-mono text-lg font-bold text-emerald-900">
          {tracking}
        </p>
        <p className="mt-1 text-xs text-emerald-700">
          ลูกค้าได้รับ email + LINE พร้อมเลข tracking แล้ว · เช็คสถานะที่หน้า courier เอง
        </p>
        {receiptUrl ? (
          <a
            href={receiptUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-[11px] text-emerald-700 underline"
          >
            ดูรูปใบเสร็จที่ AI อ่าน
          </a>
        ) : null}
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-zinc-900 bg-zinc-900 p-5 text-white">
      <h2 className="text-base font-bold">ส่งของให้ลูกค้า · ฟรี ไม่ต้องสมัคร</h2>
      <p className="mt-1 text-[12px] leading-relaxed text-zinc-300">
        ปริ๊น → ติดที่กล่อง → drop ที่ courier ไหนก็ได้ → ถ่ายรูปใบเสร็จกลับมา · AI ดึงเลข tracking ให้อัตโนมัติ
      </p>

      <ol className="mt-4 space-y-3">
        {/* Step 1: print label */}
        <li className="rounded-2xl bg-zinc-800 p-4">
          <div className="flex items-start gap-3">
            <div className="grid size-7 shrink-0 place-items-center rounded-full bg-white text-[12px] font-bold text-zinc-900">
              1
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-bold">พิมพ์ใบปะหน้า</p>
              <p className="mt-0.5 text-[11px] text-zinc-400">
                เปิดในแท็บใหม่ → กดปุ่ม “พิมพ์” → ตัด-ติดที่กล่อง
              </p>
              <a
                href={`/api/v1/orders/${token}/shipment/label`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  if (!labelGeneratedAt)
                    setLabelGeneratedAt(new Date().toISOString());
                }}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-[13px] font-semibold text-zinc-900 hover:bg-zinc-100"
              >
                <Printer className="size-4" />
                เปิดใบปะหน้า
              </a>
              {labelGeneratedAt ? (
                <p className="mt-2 text-[10px] text-emerald-400">
                  ✓ เปิดแล้วเมื่อ {new Date(labelGeneratedAt).toLocaleString()}
                </p>
              ) : null}
            </div>
          </div>
        </li>

        {/* Step 2: upload receipt */}
        <li className="rounded-2xl bg-zinc-800 p-4">
          <div className="flex items-start gap-3">
            <div className="grid size-7 shrink-0 place-items-center rounded-full bg-white text-[12px] font-bold text-zinc-900">
              2
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-bold">
                drop ที่ courier → ถ่ายรูปใบเสร็จที่ courier ให้
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-400">
                Flash / Kerry / J&T / Thai Post — ค่าส่งที่เก็บจากลูกค้าก็ใช้จ่ายตรงนี้
              </p>

              <label
                className={`mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white px-3 py-2 text-[13px] font-semibold text-zinc-900 hover:bg-zinc-100 ${
                  scanning ? "opacity-60" : ""
                }`}
              >
                {scanning ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Camera className="size-4" />
                )}
                {scanning ? "กำลังให้ AI อ่าน..." : "อัปโหลดรูปใบเสร็จ"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  disabled={scanning || orderStatus !== "PAID"}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void uploadReceipt(f);
                  }}
                />
              </label>
              {orderStatus !== "PAID" && orderStatus !== "SHIPPING" ? (
                <p className="mt-2 text-[10px] text-amber-300">
                  รอลูกค้าจ่ายเงินก่อน
                </p>
              ) : null}
            </div>
          </div>
        </li>
      </ol>

      {pendingScan ? (
        <div className="mt-4 rounded-2xl border border-amber-400 bg-amber-50 p-4 text-zinc-900">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-amber-600" />
            <div className="flex-1">
              <p className="text-[13px] font-bold text-amber-900">
                {pendingScan.reason === "name_unreadable"
                  ? "ขอยืนยัน — ใบเสร็จไม่มีชื่อผู้รับ"
                  : "ขอยืนยัน — ชื่อไม่ตรง"}
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-amber-800">
                {pendingScan.message}
              </p>
              <dl className="mt-2 space-y-0.5 text-[11px] text-zinc-700">
                <div>
                  <dt className="inline font-semibold">tracking: </dt>
                  <dd className="inline font-mono">
                    {pendingScan.trackingNumber}
                  </dd>
                </div>
                {pendingScan.courier ? (
                  <div>
                    <dt className="inline font-semibold">courier: </dt>
                    <dd className="inline">
                      {courierLabel(pendingScan.courier)}
                    </dd>
                  </div>
                ) : null}
                {pendingScan.reason === "name_mismatch" &&
                pendingScan.receiverName ? (
                  <div>
                    <dt className="inline font-semibold">AI อ่านได้: </dt>
                    <dd className="inline">{pendingScan.receiverName}</dd>
                  </div>
                ) : null}
              </dl>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPendingScan(null)}
                >
                  ยกเลิก
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    // Re-upload via the cached receipt URL? Server returns
                    // the same receipt regardless; just resend confirmOverride.
                    void confirmOverrideUpload(token, pendingScan.receiptUrl)
                      .then((data) => {
                        if (!data) return;
                        setTracking(data.trackingNumber);
                        setPendingScan(null);
                        toast.success(
                          `อัปเดต tracking ${data.trackingNumber}`,
                        );
                        router.refresh();
                      })
                      .catch(() => toast.error("ยืนยันไม่สำเร็จ"));
                  }}
                >
                  {pendingScan.reason === "name_unreadable"
                    ? "ใช่ ถูกแล้ว ส่งต่อ"
                    : "ยืนยัน"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

    </section>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const i = result.indexOf(",");
      resolve(i === -1 ? result : result.slice(i + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function confirmOverrideUpload(
  token: string,
  receiptUrl: string,
): Promise<{ trackingNumber: string } | null> {
  // Re-fetch the receipt as a blob, re-encode, send confirmOverride=true.
  // Server stores the receipt under the seller's user namespace so this
  // is always behind their own auth.
  const res = await fetch(receiptUrl);
  const blob = await res.blob();
  const dataBase64 = await blobToBase64(blob);
  const r = await fetch(`/api/v1/orders/${token}/shipment/receipt`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      dataBase64,
      contentType: blob.type.startsWith("image/png")
        ? "image/png"
        : blob.type.startsWith("image/webp")
          ? "image/webp"
          : "image/jpeg",
      confirmOverride: true,
    }),
  });
  const j = (await r.json()) as {
    ok: boolean;
    data?: { ok: boolean; trackingNumber?: string };
  };
  if (!j.ok || !j.data?.trackingNumber) return null;
  return { trackingNumber: j.data.trackingNumber };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const i = result.indexOf(",");
      resolve(i === -1 ? result : result.slice(i + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function courierLabel(code: string): string {
  switch (code) {
    case "FLASH":
      return "Flash Express";
    case "KERRY":
      return "Kerry Express";
    case "JT":
      return "J&T Express";
    case "THAIPOST":
      return "Thai Post";
    case "SCG":
      return "SCG Express";
    case "BEST":
      return "Best Express";
    case "NINJAVAN":
      return "Ninjavan";
    case "DHL":
      return "DHL";
    default:
      return "อื่นๆ";
  }
}
