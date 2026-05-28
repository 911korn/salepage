"use client";

import { useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  ImagePlus,
  Loader2,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const MAX_PHOTOS = 20;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const SUGGESTED_RECEIPTS_PER_PHOTO = 5;

type CourierCode =
  | "FLASH"
  | "KERRY"
  | "JT"
  | "THAIPOST"
  | "SCG"
  | "BEST"
  | "NINJAVAN"
  | "DHL"
  | "OTHER";

interface PhotoFile {
  id: string;
  dataBase64: string;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  previewUrl: string;
}

interface MatchedReceipt {
  trackingNumber: string;
  receiverName: string | null;
  postcode: string | null;
  phoneTail: string | null;
  courier: CourierCode | null;
  confidence: "high" | "medium" | "low";
  photoIndex: number;
  indexInPhoto: number;
  bbox: [number, number, number, number] | null;
  status: "auto" | "review" | "unmatched";
  candidates: Array<{ orderId: string; publicToken: string; score: number }>;
}

interface CandidateOrder {
  orderId: string;
  publicToken: string;
  customerName: string;
  customerPhone: string | null;
  customerAddress: string | null;
  totalSatang: number;
  createdAt: string;
  labelPrintedAt: string | null;
}

interface DuplicateEntry {
  trackingNumber: string;
  photoIndex: number;
  indexInPhoto: number;
  assignedToOrderToken: string;
}

interface ScanResponse {
  photos: Array<{ photoIndex: number; note: string | null; receiptsFound: number }>;
  matches: MatchedReceipt[];
  duplicates: DuplicateEntry[];
  candidatePool: CandidateOrder[];
  message?: string;
}

/** Each row in the review queue gets a Decision the seller can toggle. */
type Decision =
  | { kind: "approve"; orderId: string }
  | { kind: "skip" };

export function BulkScanPanel({ shopSlug }: { shopSlug: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<PhotoFile[]>([]);
  const [scanning, setScanning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResponse | null>(null);
  // tracking-number → seller's decision. Auto-matched rows pre-populate
  // with approve+candidate[0].orderId; review + unmatched start as skip.
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});

  function addPhotos(fileList: FileList | null) {
    if (!fileList) return;
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) {
      toast.error(`อัปได้สูงสุด ${MAX_PHOTOS} รูปต่อรอบ`);
      return;
    }
    const next = Array.from(fileList).slice(0, remaining);
    const accepted: PhotoFile[] = [];
    for (const file of next) {
      if (file.size > MAX_PHOTO_BYTES) {
        toast.error(`${file.name} ใหญ่เกิน 5 MB`);
        continue;
      }
      if (
        file.type !== "image/jpeg" &&
        file.type !== "image/png" &&
        file.type !== "image/webp"
      ) {
        toast.error(`${file.name} ไม่ใช่ jpg/png/webp`);
        continue;
      }
      // We compress + base64-encode on the fly. Keep the raw object URL
      // for instant preview rendering (createObjectURL is essentially free).
      const previewUrl = URL.createObjectURL(file);
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result);
        const dataBase64 = dataUrl.split(",")[1] ?? dataUrl;
        accepted.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          dataBase64,
          contentType: file.type as PhotoFile["contentType"],
          previewUrl,
        });
        // setState in a microtask so the loop completes — batched render.
        if (accepted.length === next.length) {
          setPhotos((p) => [...p, ...accepted]);
        }
      };
      reader.readAsDataURL(file);
    }
  }

  function removePhoto(id: string) {
    setPhotos((p) => {
      const target = p.find((x) => x.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return p.filter((x) => x.id !== id);
    });
  }

  async function startScan() {
    if (photos.length === 0) {
      toast.error("เพิ่มรูปอย่างน้อย 1 ใบ");
      return;
    }
    setScanning(true);
    try {
      const res = await fetch(
        `/api/v1/shops/${shopSlug}/shipping/bulk-receipt-scan`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            photos: photos.map((p) => ({
              dataBase64: p.dataBase64,
              contentType: p.contentType,
            })),
          }),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.ok) {
        toast.error(json.error?.message ?? "สแกนไม่สำเร็จ");
        return;
      }
      const data = json.data as ScanResponse;
      setScanResult(data);
      // Pre-populate decisions: auto → approve; review/unmatched → skip.
      const init: Record<string, Decision> = {};
      for (const m of data.matches) {
        if (m.status === "auto" && m.candidates[0]) {
          init[m.trackingNumber] = {
            kind: "approve",
            orderId: m.candidates[0].orderId,
          };
        } else {
          init[m.trackingNumber] = { kind: "skip" };
        }
      }
      setDecisions(init);
      if (data.message) toast.info(data.message);
    } catch (err) {
      console.error("[bulk-scan] error", err);
      toast.error("สแกนไม่สำเร็จ ลองอีกครั้ง");
    } finally {
      setScanning(false);
    }
  }

  async function applyAll() {
    if (!scanResult) return;
    const applies = Object.entries(decisions)
      .filter(([, d]) => d.kind === "approve")
      .map(([trackingNumber, d]) => {
        const m = scanResult.matches.find(
          (x) => x.trackingNumber === trackingNumber,
        );
        return {
          orderId: (d as { kind: "approve"; orderId: string }).orderId,
          trackingNumber,
          courier: m?.courier ?? null,
        };
      });
    if (applies.length === 0) {
      toast.error("ยังไม่ได้เลือกออเดอร์สักรายการ");
      return;
    }
    setApplying(true);
    try {
      const res = await fetch(
        `/api/v1/shops/${shopSlug}/shipping/bulk-receipt-apply`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ applies }),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.ok) {
        toast.error(json.error?.message ?? "ยืนยันไม่สำเร็จ");
        return;
      }
      const applied = json.data.applied as Array<{
        orderId: string;
        trackingNumber: string;
      }>;
      const skipped = json.data.skipped as Array<{
        orderId: string;
        trackingNumber: string;
        reason: string;
      }>;
      toast.success(`อัปเดต tracking ${applied.length} ออเดอร์สำเร็จ`, {
        description:
          skipped.length > 0
            ? `ข้าม ${skipped.length} รายการ (อาจมีเลขซ้ำหรือสถานะออเดอร์ไม่ตรง)`
            : "ลูกค้าทุกคนได้รับ email + LINE แล้ว",
        duration: 8000,
      });
      router.push(`/dashboard/orders?shop=${encodeURIComponent(shopSlug)}`);
      router.refresh();
    } catch (err) {
      console.error("[bulk-apply] error", err);
      toast.error("ยืนยันไม่สำเร็จ ลองอีกครั้ง");
    } finally {
      setApplying(false);
    }
  }

  // Idle state — photo picker.
  if (!scanResult) {
    return (
      <section className="mt-6 rounded-3xl border border-[color:var(--color-border)] bg-white p-6">
        <h2 className="font-display flex items-center gap-2 text-base font-semibold">
          <Camera className="size-4 text-[color:var(--color-brand-600)]" />
          ถ่ายรูปใบเสร็จขนส่ง
        </h2>
        <p className="mt-1 text-[13px] leading-relaxed text-zinc-500">
          ถ่ายแยกได้หลายรูป — แนะนำ <strong>~{SUGGESTED_RECEIPTS_PER_PHOTO} ใบเสร็จต่อรูป</strong> เพื่อให้ AI อ่านได้ชัดที่สุด · เพิ่มได้สูงสุด {MAX_PHOTOS} รูปต่อรอบ
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p, i) => (
            <div
              key={p.id}
              className="relative aspect-square overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-zinc-100"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.previewUrl}
                alt={`receipt ${i + 1}`}
                className="size-full object-cover"
              />
              <button
                type="button"
                onClick={() => removePhoto(p.id)}
                className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-zinc-900/70 text-white transition hover:bg-zinc-900"
                aria-label="ลบรูปนี้"
              >
                <Trash2 className="size-3.5" />
              </button>
              <span className="absolute bottom-1.5 left-1.5 rounded-full bg-zinc-900/70 px-2 py-0.5 text-[10px] font-bold text-white">
                #{i + 1}
              </span>
            </div>
          ))}
          {photos.length < MAX_PHOTOS ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="grid aspect-square place-items-center rounded-2xl border-2 border-dashed border-[color:var(--color-border)] bg-[color:var(--color-soft)] text-zinc-500 transition hover:border-[color:var(--color-brand-300)] hover:bg-[color:var(--color-brand-50)] hover:text-[color:var(--color-brand-700)]"
            >
              <div className="flex flex-col items-center gap-1">
                <ImagePlus className="size-6" />
                <span className="text-[11px] font-semibold">เพิ่มรูป</span>
              </div>
            </button>
          ) : null}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          capture="environment"
          className="sr-only"
          onChange={(e) => {
            addPhotos(e.target.files);
            e.target.value = "";
          }}
        />

        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-[12px] text-zinc-500">
            อัปแล้ว <strong>{photos.length}</strong> / {MAX_PHOTOS} รูป
          </p>
          <Button
            disabled={photos.length === 0 || scanning}
            onClick={startScan}
            className="min-w-32"
          >
            {scanning ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                AI กำลังอ่าน...
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                เริ่มสแกน
              </>
            )}
          </Button>
        </div>
      </section>
    );
  }

  // Review state — show match results + per-row controls.
  return (
    <ReviewView
      scanResult={scanResult}
      photos={photos}
      decisions={decisions}
      setDecisions={setDecisions}
      applying={applying}
      onApply={applyAll}
      onReset={() => {
        setScanResult(null);
        setDecisions({});
      }}
    />
  );
}

function ReviewView({
  scanResult,
  photos,
  decisions,
  setDecisions,
  applying,
  onApply,
  onReset,
}: {
  scanResult: ScanResponse;
  photos: PhotoFile[];
  decisions: Record<string, Decision>;
  setDecisions: React.Dispatch<
    React.SetStateAction<Record<string, Decision>>
  >;
  applying: boolean;
  onApply: () => void;
  onReset: () => void;
}) {
  const grouped = useMemo(() => {
    const auto = scanResult.matches.filter((m) => m.status === "auto");
    const review = scanResult.matches.filter((m) => m.status === "review");
    const unmatched = scanResult.matches.filter(
      (m) => m.status === "unmatched",
    );
    return { auto, review, unmatched };
  }, [scanResult.matches]);

  const approvedCount = Object.values(decisions).filter(
    (d) => d.kind === "approve",
  ).length;

  return (
    <section className="mt-6 space-y-5">
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" />
          <div>
            <p className="font-display text-base font-bold text-emerald-900">
              พบใบเสร็จ {scanResult.matches.length} ใบ
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-emerald-800">
              จับคู่อัตโนมัติ <strong>{grouped.auto.length}</strong> ·
              ต้องตรวจ <strong>{grouped.review.length}</strong> ·
              ไม่เจอคู่ <strong>{grouped.unmatched.length}</strong>
              {scanResult.duplicates.length > 0 ? (
                <>
                  {" "}· ซ้ำ <strong>{scanResult.duplicates.length}</strong>
                </>
              ) : null}
            </p>
          </div>
        </div>
      </div>

      {grouped.auto.length > 0 ? (
        <Section title={`จับคู่อัตโนมัติ · ${grouped.auto.length} รายการ`} tone="emerald">
          {grouped.auto.map((m) => (
            <ReceiptRow
              key={m.trackingNumber}
              match={m}
              photos={photos}
              candidatePool={scanResult.candidatePool}
              decision={decisions[m.trackingNumber]}
              onChange={(d) =>
                setDecisions((prev) => ({ ...prev, [m.trackingNumber]: d }))
              }
            />
          ))}
        </Section>
      ) : null}

      {grouped.review.length > 0 ? (
        <Section
          title={`ต้องตรวจ · ${grouped.review.length} รายการ`}
          tone="amber"
        >
          {grouped.review.map((m) => (
            <ReceiptRow
              key={m.trackingNumber}
              match={m}
              photos={photos}
              candidatePool={scanResult.candidatePool}
              decision={decisions[m.trackingNumber]}
              onChange={(d) =>
                setDecisions((prev) => ({ ...prev, [m.trackingNumber]: d }))
              }
            />
          ))}
        </Section>
      ) : null}

      {grouped.unmatched.length > 0 ? (
        <Section
          title={`ไม่เจอคู่ · ${grouped.unmatched.length} รายการ`}
          tone="zinc"
        >
          {grouped.unmatched.map((m) => (
            <ReceiptRow
              key={m.trackingNumber}
              match={m}
              photos={photos}
              candidatePool={scanResult.candidatePool}
              decision={decisions[m.trackingNumber]}
              onChange={(d) =>
                setDecisions((prev) => ({ ...prev, [m.trackingNumber]: d }))
              }
            />
          ))}
        </Section>
      ) : null}

      {scanResult.duplicates.length > 0 ? (
        <Section
          title={`เลขซ้ำ · ${scanResult.duplicates.length} รายการ (จะข้าม)`}
          tone="zinc"
        >
          <p className="px-1 text-[12px] text-zinc-600">
            เลข tracking ต่อไปนี้เคยใช้กับออเดอร์อื่นในร้านนี้แล้ว ระบบจะไม่อัปเดตซ้ำ
          </p>
          <ul className="mt-2 space-y-1.5">
            {scanResult.duplicates.map((d) => (
              <li
                key={d.trackingNumber}
                className="flex items-center gap-2 text-[12px] text-zinc-700"
              >
                <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px]">
                  {d.trackingNumber}
                </span>
                <span>→ ออเดอร์ {d.assignedToOrderToken.slice(0, 8)}…</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color:var(--color-border)] bg-white p-3 shadow-xl">
        <p className="text-[13px] text-zinc-700">
          จะอัปเดต <strong>{approvedCount}</strong> ออเดอร์
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onReset}>
            <X className="size-4" />
            สแกนใหม่
          </Button>
          <Button
            disabled={approvedCount === 0 || applying}
            onClick={onApply}
            className="min-w-32"
          >
            {applying ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                กำลังอัปเดต...
              </>
            ) : (
              <>
                <CheckCircle2 className="size-4" />
                ใช้งานจริง
              </>
            )}
          </Button>
        </div>
      </div>
    </section>
  );
}

function Section({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "emerald" | "amber" | "zinc";
  children: React.ReactNode;
}) {
  const cls =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50/50"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50/50"
        : "border-zinc-200 bg-white";
  return (
    <section
      className={`rounded-3xl border ${cls} p-4 sm:p-5`}
    >
      <h3 className="font-display text-sm font-bold text-zinc-900">{title}</h3>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function ReceiptRow({
  match,
  photos,
  candidatePool,
  decision,
  onChange,
}: {
  match: MatchedReceipt;
  photos: PhotoFile[];
  candidatePool: CandidateOrder[];
  decision: Decision | undefined;
  onChange: (d: Decision) => void;
}) {
  const photo = photos[match.photoIndex];
  const isAuto = match.status === "auto";

  return (
    <div className="rounded-2xl border border-[color:var(--color-border)] bg-white p-3 sm:flex sm:items-stretch sm:gap-4">
      {/* Cropped photo preview — bbox-positioned if available */}
      {photo ? (
        <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-zinc-100 sm:w-32 sm:shrink-0">
          <CroppedPhoto src={photo.previewUrl} bbox={match.bbox} />
          <span className="absolute left-1 top-1 rounded bg-zinc-900/70 px-1.5 py-0.5 text-[9.5px] font-bold text-white">
            รูป #{match.photoIndex + 1} · ลำดับ {match.indexInPhoto}
          </span>
        </div>
      ) : null}

      <div className="mt-3 flex-1 sm:mt-0">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-mono text-[13px] font-bold text-zinc-900">
            {match.trackingNumber}
          </span>
          {match.courier ? (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10.5px] font-semibold text-zinc-700">
              {courierLabel(match.courier)}
            </span>
          ) : null}
          {match.confidence === "low" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-semibold text-amber-800">
              <AlertCircle className="size-3" />
              AI ไม่มั่นใจ
            </span>
          ) : null}
        </div>
        <dl className="mt-2 space-y-0.5 text-[11.5px] text-zinc-600">
          {match.receiverName ? (
            <div>
              <dt className="inline font-semibold">AI อ่านชื่อ: </dt>
              <dd className="inline">{match.receiverName}</dd>
            </div>
          ) : (
            <div className="text-amber-700">
              ใบเสร็จไม่มีชื่อผู้รับ (เช่น ไปรษณีย์ไทย eCo-Post)
            </div>
          )}
          {match.postcode ? (
            <div>
              <dt className="inline font-semibold">รหัสไปรษณีย์: </dt>
              <dd className="inline">{match.postcode}</dd>
            </div>
          ) : null}
        </dl>

        {/* Candidate picker */}
        <div className="mt-3 space-y-2">
          {isAuto && match.candidates[0] ? (
            <ChosenCandidate
              order={candidatePool.find(
                (c) => c.orderId === match.candidates[0].orderId,
              )}
              score={match.candidates[0].score}
              decision={decision}
              trackingNumber={match.trackingNumber}
              candidatePool={candidatePool}
              onChange={onChange}
            />
          ) : (
            <CandidatePicker
              match={match}
              candidatePool={candidatePool}
              decision={decision}
              onChange={onChange}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ChosenCandidate({
  order,
  score,
  decision,
  trackingNumber,
  candidatePool,
  onChange,
}: {
  order: CandidateOrder | undefined;
  score: number;
  decision: Decision | undefined;
  trackingNumber: string;
  candidatePool: CandidateOrder[];
  onChange: (d: Decision) => void;
}) {
  const [editing, setEditing] = useState(false);
  if (!order) return null;
  const approved = decision?.kind === "approve";
  if (editing) {
    return (
      <CandidatePicker
        match={{
          trackingNumber,
          candidates: [],
          status: "review",
        } as unknown as MatchedReceipt}
        candidatePool={candidatePool}
        decision={decision}
        onChange={(d) => {
          onChange(d);
          setEditing(false);
        }}
      />
    );
  }
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-zinc-900">
          {order.customerName}{" "}
          <span className="text-[10.5px] font-normal text-emerald-700">
            ({score}% match)
          </span>
        </p>
        {order.customerAddress ? (
          <p className="mt-0.5 line-clamp-2 text-[11.5px] text-zinc-600">
            {order.customerAddress}
          </p>
        ) : null}
        <p className="mt-1 font-mono text-[10.5px] text-zinc-500">
          ฿{(order.totalSatang / 100).toLocaleString()} · {order.publicToken.slice(0, 10)}…
        </p>
      </div>
      <div className="flex shrink-0 flex-col gap-1.5">
        <Button
          size="sm"
          variant={approved ? "primary" : "outline"}
          onClick={() =>
            onChange(
              approved
                ? { kind: "skip" }
                : { kind: "approve", orderId: order.orderId },
            )
          }
        >
          {approved ? "✓ จะอัปเดต" : "เลือก"}
        </Button>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-[10.5px] text-zinc-500 underline hover:text-zinc-700"
        >
          เปลี่ยน
        </button>
      </div>
    </div>
  );
}

function CandidatePicker({
  match,
  candidatePool,
  decision,
  onChange,
}: {
  match: MatchedReceipt;
  candidatePool: CandidateOrder[];
  decision: Decision | undefined;
  onChange: (d: Decision) => void;
}) {
  const approvedOrderId =
    decision?.kind === "approve" ? decision.orderId : null;
  const topCandidateIds = new Set(match.candidates.map((c) => c.orderId));
  const top = match.candidates
    .map((c) => candidatePool.find((p) => p.orderId === c.orderId))
    .filter((c): c is CandidateOrder => Boolean(c));
  const rest = candidatePool.filter((c) => !topCandidateIds.has(c.orderId));

  return (
    <div className="space-y-1.5">
      {top.length > 0 ? (
        <p className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-500">
          ตัวเลือกที่น่าจะใช่
        </p>
      ) : null}
      {top.map((c, i) => (
        <CandidateButton
          key={c.orderId}
          order={c}
          score={match.candidates[i]?.score ?? 0}
          selected={approvedOrderId === c.orderId}
          onSelect={() =>
            onChange({ kind: "approve", orderId: c.orderId })
          }
        />
      ))}
      <details className="rounded-xl border border-dashed border-zinc-300 bg-white">
        <summary className="cursor-pointer px-3 py-2 text-[11.5px] font-semibold text-zinc-600 hover:bg-zinc-50">
          เลือกออเดอร์อื่น ({rest.length} ออเดอร์ที่เหลือ)
        </summary>
        <div className="max-h-72 overflow-y-auto px-3 pb-3">
          {rest.map((c) => (
            <CandidateButton
              key={c.orderId}
              order={c}
              score={0}
              selected={approvedOrderId === c.orderId}
              onSelect={() =>
                onChange({ kind: "approve", orderId: c.orderId })
              }
            />
          ))}
        </div>
      </details>
      {approvedOrderId ? (
        <button
          type="button"
          onClick={() => onChange({ kind: "skip" })}
          className="text-[10.5px] text-zinc-500 underline hover:text-zinc-700"
        >
          ยกเลิกการเลือก
        </button>
      ) : (
        <p className="text-[10.5px] text-zinc-500">ข้ามรายการนี้ — ไม่อัปเดต</p>
      )}
    </div>
  );
}

function CandidateButton({
  order,
  score,
  selected,
  onSelect,
}: {
  order: CandidateOrder;
  score: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`mt-1.5 flex w-full items-start gap-2 rounded-xl border px-3 py-2 text-left transition ${
        selected
          ? "border-[color:var(--color-brand-400)] bg-[color:var(--color-brand-50)]"
          : "border-zinc-200 bg-white hover:bg-zinc-50"
      }`}
    >
      <span
        className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border-2 ${
          selected
            ? "border-[color:var(--color-brand-600)] bg-[color:var(--color-brand-600)]"
            : "border-zinc-300"
        }`}
      >
        {selected ? (
          <span className="size-1.5 rounded-full bg-white" />
        ) : null}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-semibold text-zinc-900">
          {order.customerName}
          {score > 0 ? (
            <span className="ml-1.5 text-[10.5px] font-normal text-zinc-500">
              · {score}%
            </span>
          ) : null}
        </p>
        {order.customerAddress ? (
          <p className="line-clamp-1 text-[10.5px] text-zinc-500">
            {order.customerAddress}
          </p>
        ) : null}
        <p className="font-mono text-[10px] text-zinc-400">
          ฿{(order.totalSatang / 100).toLocaleString()} · {order.publicToken.slice(0, 8)}…
        </p>
      </div>
    </button>
  );
}

/** Display a cropped region of an image using CSS object-position +
 *  object-fit. The bbox is normalised [x1,y1,x2,y2] in 0..1 space; we
 *  pad ~10% on each side because Claude's bbox accuracy is uneven. */
function CroppedPhoto({
  src,
  bbox,
}: {
  src: string;
  bbox: [number, number, number, number] | null;
}) {
  if (!bbox) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" className="size-full object-cover" />
    );
  }
  const [x1, y1, x2, y2] = bbox;
  // Pad 8% on each side, clamp to [0,1]
  const padX = 0.08;
  const padY = 0.08;
  const cx1 = Math.max(0, x1 - padX);
  const cy1 = Math.max(0, y1 - padY);
  const cx2 = Math.min(1, x2 + padX);
  const cy2 = Math.min(1, y2 + padY);
  const w = cx2 - cx1;
  const h = cy2 - cy1;
  // We want a zoomed-in view of the crop. Compute the scale so the
  // bbox region fills the container; use object-position to align.
  const scaleX = 1 / w;
  const scaleY = 1 / h;
  const scale = Math.min(scaleX, scaleY);
  const centerX = (cx1 + cx2) / 2;
  const centerY = (cy1 + cy2) / 2;
  return (
    <div className="relative size-full overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className="absolute left-1/2 top-1/2 size-full origin-center -translate-x-1/2 -translate-y-1/2 object-cover"
        style={{
          transform: `translate(${(0.5 - centerX) * 100 * scale}%, ${
            (0.5 - centerY) * 100 * scale
          }%) scale(${scale})`,
        }}
      />
    </div>
  );
}

function courierLabel(code: CourierCode): string {
  switch (code) {
    case "FLASH":
      return "Flash";
    case "KERRY":
      return "Kerry";
    case "JT":
      return "J&T";
    case "THAIPOST":
      return "ไปรษณีย์ไทย";
    case "SCG":
      return "SCG";
    case "BEST":
      return "BEST";
    case "NINJAVAN":
      return "Ninjavan";
    case "DHL":
      return "DHL";
    case "OTHER":
      return "อื่นๆ";
  }
}
