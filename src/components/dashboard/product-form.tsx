"use client";

import { useRef, useState, useTransition } from "react";
import { ArrowLeft, ImagePlus, Loader2, Save, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter, Link } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { dashboardHref } from "@/lib/dashboard-routing";

type Mode = "create" | "edit";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1600;
const IMAGE_UPLOAD_CONCURRENCY = 3;
const OPTIMIZED_IMAGE_TYPE = "image/webp";
const OPTIMIZED_IMAGE_QUALITY = 0.82;

interface ProductFormValues {
  name: string;
  slug?: string;
  description?: string | null;
  priceBaht: number;
  compareAtBaht?: number | null;
  imageUrls: string[];
  badge?: "HOT" | "NEW" | "SALE" | null;
  type: "PHYSICAL" | "DIGITAL";
  category?: string | null;
  condition?: "NEW" | "PRE_OWNED";
  /** V2.1 digital fulfillment template. */
  digitalContent?: string | null;
  /** V2.1 per-product shipping fee in baht. Default 0 = free shipping. */
  shippingFeeBaht?: number | null;
  stock?: number | null;
  status?: "ACTIVE" | "HIDDEN" | "SOLD_OUT";
}

interface Props {
  mode: Mode;
  shopSlug: string;
  /** When mode="edit", the product's existing slug (used in PATCH/DELETE URL). */
  productSlug?: string;
  initialValues?: Partial<ProductFormValues>;
}

export function ProductForm({ mode, shopSlug, productSlug, initialValues }: Props) {
  const t = useTranslations("dashboard.products.form");
  const router = useRouter();
  const productsHref = dashboardHref("/dashboard/products", shopSlug);
  const [pending, startTransition] = useTransition();
  const [deletePending, startDelete] = useTransition();

  const [name, setName] = useState(initialValues?.name ?? "");
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [priceBaht, setPriceBaht] = useState<string>(
    initialValues?.priceBaht !== undefined ? String(initialValues.priceBaht) : "",
  );
  const [compareAtBaht, setCompareAtBaht] = useState<string>(
    initialValues?.compareAtBaht ? String(initialValues.compareAtBaht) : "",
  );
  const [images, setImages] = useState<string[]>(initialValues?.imageUrls ?? []);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initialImageUrlsRef = useRef(initialValues?.imageUrls ?? []);
  const uploadedThisSessionRef = useRef(new Set<string>());

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (uploading) return;

    const remaining = 10 - images.length;
    if (remaining <= 0) {
      toast.error(t("errors.maxImages"));
      return;
    }

    const selected = Array.from(files)
      .filter((file) => {
        if (!file.type.startsWith("image/")) {
          toast.error(t("errors.badImageType"), { description: file.name });
          return false;
        }
        return true;
      })
      .slice(0, remaining);

    if (selected.length === 0) return;

    setUploading(true);
    setUploadProgress({ done: 0, total: selected.length });
    const uploaded: Array<string | null> = Array.from(
      { length: selected.length },
      () => null,
    );

    async function uploadOne(file: File, index: number) {
      const optimized = await optimizeProductImage(file);
      if (optimized.size > MAX_UPLOAD_BYTES) {
        toast.error(t("errors.imageTooLarge"), { description: file.name });
        return;
      }

      const form = new FormData();
      form.append("file", optimized);
      const res = await fetch("/api/v1/upload", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        toast.error(json.error?.message ?? t("errors.uploadFailed"), {
          description: file.name,
        });
        return;
      }

      uploaded[index] = json.data.url;
      uploadedThisSessionRef.current.add(json.data.url);
    }

    let nextIndex = 0;
    const workerCount = Math.min(IMAGE_UPLOAD_CONCURRENCY, selected.length);
    await Promise.all(
      Array.from({ length: workerCount }, async () => {
        while (nextIndex < selected.length) {
          const index = nextIndex++;
          const file = selected[index];
          try {
            await uploadOne(file, index);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : t("errors.uploadFailed"), {
              description: file.name,
            });
          } finally {
            setUploadProgress((current) =>
              current
                ? {
                    done: Math.min(current.done + 1, current.total),
                    total: current.total,
                  }
                : current,
            );
          }
        }
      }),
    );

    const uploadedUrls = uploaded.filter((url): url is string => Boolean(url));
    if (uploadedUrls.length > 0) {
      setImages((cur) => [...cur, ...uploadedUrls].slice(0, 10));
      toast.success(t("uploadComplete", { n: uploadedUrls.length }));
    }

    setUploadProgress(null);
    setUploading(false);
  }

  function removeImageAt(index: number) {
    const url = images[index];
    if (!url) return;

    setImages((cur) => cur.filter((_, i) => i !== index));
    toast.success(t("imageRemoved"));

    if (uploadedThisSessionRef.current.has(url)) {
      uploadedThisSessionRef.current.delete(url);
      void deleteUploadedImages([url]).catch(() => {
        toast.error(t("errors.deleteImageFailed"));
      });
    }
  }

  function cleanupRemovedInitialImages(nextImages: string[]) {
    if (mode !== "edit") return;

    const removed = initialImageUrlsRef.current.filter(
      (url) => !nextImages.includes(url),
    );
    if (removed.length === 0) return;

    void deleteUploadedImages(removed).catch(() => {
      toast.error(t("errors.deleteImageFailed"));
    });
  }
  const [type, setType] = useState<"PHYSICAL" | "DIGITAL">(
    initialValues?.type ?? "PHYSICAL",
  );
  const [condition, setCondition] = useState<"NEW" | "PRE_OWNED">(
    initialValues?.condition ?? "NEW",
  );
  const [category, setCategory] = useState<string | null>(
    initialValues?.category ?? null,
  );
  const [digitalContent, setDigitalContent] = useState<string>(
    initialValues?.digitalContent ?? "",
  );
  const [shippingFeeBaht, setShippingFeeBaht] = useState<string>(
    initialValues?.shippingFeeBaht !== undefined &&
      initialValues.shippingFeeBaht !== null
      ? String(initialValues.shippingFeeBaht)
      : "",
  );
  const [badge, setBadge] = useState<"HOT" | "NEW" | "SALE" | "">(
    (initialValues?.badge as "HOT" | "NEW" | "SALE") ?? "",
  );
  const [stock, setStock] = useState<string>(
    initialValues?.stock !== undefined && initialValues.stock !== null
      ? String(initialValues.stock)
      : "",
  );
  const [status, setStatus] = useState<"ACTIVE" | "HIDDEN" | "SOLD_OUT">(
    initialValues?.status ?? "ACTIVE",
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error(t("errors.nameRequired"));
      return;
    }
    const price = Number(priceBaht);
    if (!price || price <= 0) {
      toast.error(t("errors.priceRequired"));
      return;
    }
    if (type === "DIGITAL" && digitalContent.trim().length < 2) {
      toast.error(
        "สินค้าดิจิทัลต้องใส่เนื้อหาที่ลูกค้าจะได้รับ (ID/PW, ลิงก์, ฯลฯ)",
      );
      return;
    }
    startTransition(async () => {
      const body: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim() || undefined,
        priceBaht: price,
        compareAtBaht: compareAtBaht ? Number(compareAtBaht) : undefined,
        imageUrls: images.slice(0, 10),
        type,
        condition,
        ...(category ? { category } : mode === "edit" ? { category: null } : {}),
        digitalContent:
          type === "DIGITAL" ? digitalContent.trim() || null : null,
        // V2.1 per-product shipping fee. Digital products always ship 0;
        // physical defaults to 0 (free) when the seller leaves it blank.
        shippingFeeBaht:
          type === "DIGITAL"
            ? 0
            : shippingFeeBaht.trim()
              ? Math.max(0, Math.min(99999, Number(shippingFeeBaht) || 0))
              : 0,
        badge: badge || null,
        ...(stock ? { stock: Number(stock) } : mode === "edit" ? { stock: null } : {}),
        ...(mode === "edit" ? { status } : {}),
      };
      try {
        const url =
          mode === "create"
            ? `/api/v1/shops/${shopSlug}/products`
            : `/api/v1/shops/${shopSlug}/products/${productSlug}`;
        const res = await fetch(url, {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          toast.error(
            mode === "create" ? t("errors.createFailed") : t("errors.updateFailed"),
            { description: json.error?.message },
          );
          return;
        }
        cleanupRemovedInitialImages(images);
        uploadedThisSessionRef.current.clear();
        toast.success(mode === "create" ? t("submitNew") : t("submit"));
        router.push(productsHref);
        router.refresh();
      } catch (e) {
        toast.error(t("errors.createFailed"), {
          description: e instanceof Error ? e.message : "network error",
        });
      }
    });
  }

  function onDelete() {
    if (!productSlug) return;
    if (!confirm(t("deleteConfirm"))) return;
    startDelete(async () => {
      try {
        const res = await fetch(
          `/api/v1/shops/${shopSlug}/products/${productSlug}`,
          { method: "DELETE" },
        );
        const json = await res.json();
        if (!res.ok || !json.ok) {
          toast.error(json.error?.message ?? "delete failed");
          return;
        }
        toast.success(t("deleted"));
        router.push(productsHref);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "delete error");
      }
    });
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto max-w-3xl space-y-6"
    >
      <header className="flex items-center gap-3">
        <Link
          href={productsHref}
          className="grid size-9 place-items-center rounded-lg border border-[color:var(--color-border)] bg-white hover:bg-[color:var(--color-soft)]"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="font-display text-xl font-bold sm:text-2xl">
          {mode === "create" ? t("createTitle") : t("editTitle")}
        </h1>
      </header>

      <div className="space-y-5 rounded-3xl border border-[color:var(--color-border)] bg-white p-6 shadow-sm sm:p-7">
        <Field label={t("nameLabel")}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
            maxLength={120}
            required
          />
        </Field>

        <Field label={t("descLabel")}>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("descPlaceholder")}
            rows={4}
            maxLength={2000}
            className="w-full resize-y rounded-xl border border-[color:var(--color-border)] bg-white p-3 text-[15px] outline-none focus:border-[color:var(--color-brand-400)] focus:ring-2 focus:ring-[color:var(--color-brand-100)]"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("priceLabel")}>
            <Input
              type="number"
              min={1}
              max={9999999}
              value={priceBaht}
              onChange={(e) => setPriceBaht(e.target.value)}
              prefix={<span className="font-semibold">฿</span>}
              required
            />
          </Field>
          <Field label={t("compareAtLabel")} hint={t("compareAtHint")}>
            <Input
              type="number"
              min={1}
              max={9999999}
              value={compareAtBaht}
              onChange={(e) => setCompareAtBaht(e.target.value)}
              prefix={<span className="font-semibold">฿</span>}
            />
          </Field>
        </div>

        <Field label={t("imagesLabel")} hint={t("imagesHint")}>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              uploadFiles(e.dataTransfer.files);
            }}
            className="rounded-2xl border-2 border-dashed border-[color:var(--color-border)] bg-[color:var(--color-soft)] p-3"
          >
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {images.map((url, i) => (
                <div
                  key={`${url}-${i}`}
                  className="relative aspect-square overflow-hidden rounded-xl ring-1 ring-[color:var(--color-border)]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`product ${i + 1}`}
                    className="size-full object-cover"
                  />
                  <button
                    type="button"
                    aria-label={t("removeImage", { n: i + 1 })}
                    onClick={() => removeImageAt(i)}
                    className="absolute inset-x-1 bottom-1 flex min-h-9 items-center justify-center gap-1 rounded-lg bg-white/95 px-2 text-xs font-semibold text-red-600 shadow-sm ring-1 ring-red-100 transition-colors hover:bg-red-50 active:bg-red-100"
                  >
                    <X className="size-3.5" />
                    <span>{t("removeImageShort")}</span>
                  </button>
                </div>
              ))}
              {images.length < 10 ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-[color:var(--color-border)] bg-white text-zinc-500 hover:border-[color:var(--color-brand-300)] hover:bg-[color:var(--color-brand-50)] disabled:opacity-60"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="size-5 animate-spin text-[color:var(--color-brand-600)]" />
                      {uploadProgress ? (
                        <span className="text-[11px]">
                          {t("uploadingProgress", uploadProgress)}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <ImagePlus className="size-5" />
                      <span className="text-[11px]">{t("addImage")}</span>
                    </>
                  )}
                </button>
              ) : null}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              multiple
              className="sr-only"
              onChange={(e) => {
                uploadFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("typeLabel")}>
            <div className="grid grid-cols-2 gap-2">
              <ToggleBtn
                active={type === "PHYSICAL"}
                onClick={() => setType("PHYSICAL")}
                label={t("typePhysical")}
              />
              <ToggleBtn
                active={type === "DIGITAL"}
                onClick={() => setType("DIGITAL")}
                label={t("typeDigital")}
              />
            </div>
          </Field>

          {/* Condition: NEW vs PRE_OWNED (มือสอง). PRE_OWNED gets the amber
              "♻️" treatment to mirror the marketplace badge — sellers see
              what their card will look like. */}
          <Field label="สภาพสินค้า">
            <div className="grid grid-cols-2 gap-2">
              <ToggleBtn
                active={condition === "NEW"}
                onClick={() => setCondition("NEW")}
                label="ของใหม่"
              />
              <ToggleBtn
                active={condition === "PRE_OWNED"}
                onClick={() => setCondition("PRE_OWNED")}
                label="มือสอง"
              />
            </div>
          </Field>
        </div>

        {/* Digital fulfillment template — visible only for DIGITAL
            products. Snapshotted onto the order when slip-verify flips
            it PAID, then auto-emailed + surfaced on the buyer's order
            page. Past buyers see what they paid for even after future
            edits (911korn 2026-05-27 "ผู้ขายต้องใส่รายละเอียดสิ่งที่
            ลูกค้าจะได้หลังจ่ายตังไปเลย"). */}
        {type === "DIGITAL" ? (
          <Field
            label="เนื้อหาที่ลูกค้าจะได้รับหลังชำระเงิน"
            hint="ลูกค้าจะเห็นในอีเมล + หน้า Order ทันทีหลังสลิปผ่าน · ใส่ ID/PW, license key, ลิงก์ดาวน์โหลด หรือคำแนะนำการใช้งาน · ระบบ snapshot ตอนขาย แก้ทีหลังไม่กระทบลูกค้าเก่า"
          >
            <textarea
              value={digitalContent}
              onChange={(e) => setDigitalContent(e.target.value)}
              placeholder="เช่น&#10;ID: example@mail.com&#10;PW: 1234abcd&#10;Server: Asia"
              rows={6}
              maxLength={5000}
              className="w-full rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2 font-mono text-sm focus:border-[color:var(--color-brand)]/40 focus:outline-none"
            />
            <p className="mt-1 text-right text-xs text-zinc-400">
              {digitalContent.length}/5000
            </p>
          </Field>
        ) : null}

        {/* Category — optional. Falls back to shop.category on listing
            surfaces when left blank. Chips are single-select with a "ไม่
            ระบุ" reset chip on the left. */}
        <Field label="หมวดหมู่ (ไม่จำเป็น)" hint="ใส่เผื่อร้านมีหลายหมวด — ระบบจะใช้หมวดของร้านเป็น default ถ้าไม่เลือก">
          <div className="flex flex-wrap gap-2">
            {([
              { key: null, label: "ไม่ระบุ" },
              { key: "fashion", label: "แฟชั่น" },
              { key: "food", label: "อาหาร" },
              { key: "tech", label: "ไอที" },
              { key: "beauty", label: "ความงาม" },
              { key: "health", label: "สุขภาพ" },
              { key: "furniture", label: "เฟอร์นิเจอร์" },
              { key: "pets", label: "สัตว์เลี้ยง" },
              { key: "books", label: "หนังสือ" },
              { key: "sport", label: "กีฬา" },
              { key: "other", label: "อื่นๆ" },
            ] as const).map((c) => (
              <ToggleBtn
                key={c.key ?? "none"}
                active={category === c.key}
                onClick={() => setCategory(c.key)}
                label={c.label}
              />
            ))}
          </div>
        </Field>

        <Field label={t("badgeLabel")}>
          <div className="flex flex-wrap gap-2">
            {(["", "HOT", "NEW", "SALE"] as const).map((b) => (
              <ToggleBtn
                key={b || "none"}
                active={badge === b}
                onClick={() => setBadge(b)}
                label={
                  b === ""
                    ? t("badgeNone")
                    : b === "HOT"
                      ? t("badgeHot")
                      : b === "NEW"
                        ? t("badgeNew")
                        : t("badgeSale")
                }
              />
            ))}
          </div>
        </Field>

        {/* V2.1 per-product shipping fee. 911korn 2026-05-27 — buyer sees
            this at cart, pays seller via PromptPay direct. Seller bears
            the actual courier cost when they drop off. Hidden for
            digital products since they don't ship physically. */}
        {type === "PHYSICAL" ? (
          <Field
            label="ค่าจัดส่ง (฿)"
            hint="ลูกค้าจะเห็นและจ่ายค่าส่งให้คุณตอน checkout · ปล่อยว่าง = ส่งฟรี"
          >
            <Input
              type="number"
              min={0}
              max={99999}
              value={shippingFeeBaht}
              onChange={(e) =>
                setShippingFeeBaht(e.target.value.replace(/[^\d]/g, ""))
              }
              prefix={<span className="font-semibold">฿</span>}
              placeholder="0"
            />
          </Field>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("stockLabel")} hint={t("stockHint")}>
            <Input
              type="number"
              min={0}
              max={99999}
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              placeholder="-"
            />
          </Field>

          {mode === "edit" ? (
            <Field label={t("statusLabel")}>
              <div className="flex flex-wrap gap-2">
                <ToggleBtn
                  active={status === "ACTIVE"}
                  onClick={() => setStatus("ACTIVE")}
                  label={t("statusActive")}
                />
                <ToggleBtn
                  active={status === "HIDDEN"}
                  onClick={() => setStatus("HIDDEN")}
                  label={t("statusHidden")}
                />
                <ToggleBtn
                  active={status === "SOLD_OUT"}
                  onClick={() => setStatus("SOLD_OUT")}
                  label={t("statusSoldOut")}
                />
              </div>
            </Field>
          ) : null}
        </div>
      </div>

      {images.length === 0 ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-[13px] text-rose-900">
          <strong>⚠ ต้องอัปโหลดรูปสินค้าก่อนบันทึก</strong> · เลื่อนขึ้นไปที่ &ldquo;รูปสินค้า&rdquo; → กดเพิ่มรูปอย่างน้อย 1 ใบ
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        {mode === "edit" ? (
          <Button
            type="button"
            variant="danger"
            size="md"
            onClick={onDelete}
            loading={deletePending}
            disabled={deletePending}
          >
            <Trash2 className="size-4" /> {t("delete")}
          </Button>
        ) : (
          <div />
        )}
        <div className="flex items-center gap-2">
          <Link
            href={productsHref}
            className={cn(
              "rounded-xl border border-[color:var(--color-border)] bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50",
            )}
          >
            {t("cancel")}
          </Link>
          <Button
            type="submit"
            loading={pending}
            disabled={pending || images.length === 0}
            title={
              images.length === 0
                ? "อัปรูปสินค้าอย่างน้อย 1 ใบก่อนบันทึก"
                : undefined
            }
          >
            <Save className="size-4" />
            {mode === "create" ? t("submitNew") : t("submit")}
          </Button>
        </div>
      </div>
    </form>
  );
}

async function optimizeProductImage(file: File): Promise<File> {
  if (file.size <= 500 * 1024) return file;

  let image: {
    source: CanvasImageSource;
    width: number;
    height: number;
    cleanup: () => void;
  } | null = null;

  try {
    image = await loadImageSource(file);
    const scale = Math.min(
      1,
      MAX_IMAGE_DIMENSION / Math.max(image.width, image.height),
    );
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return file;

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image.source, 0, 0, width, height);

    const blob = await canvasToBlob(canvas);
    if (!blob) return file;

    const shouldUseOptimized =
      blob.size < file.size || file.size > MAX_UPLOAD_BYTES || scale < 1;

    if (!shouldUseOptimized) return file;

    return new File([blob], optimizedFileName(file.name), {
      type: OPTIMIZED_IMAGE_TYPE,
      lastModified: Date.now(),
    });
  } catch {
    return file;
  } finally {
    image?.cleanup();
  }
}

async function loadImageSource(file: File) {
  if ("createImageBitmap" in window) {
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
      } as ImageBitmapOptions);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close(),
      };
    } catch {
      // Fall through to the image element path for browsers/codecs without support.
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not read image"));
      img.src = objectUrl;
    });

    return {
      source: image,
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
      cleanup: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, OPTIMIZED_IMAGE_TYPE, OPTIMIZED_IMAGE_QUALITY);
  });
}

function optimizedFileName(name: string) {
  const base = name.replace(/\.[^.]+$/, "") || "product-image";
  return `${base}.webp`;
}

async function deleteUploadedImages(urls: string[]) {
  const ownedBlobUrls = urls.filter(isManagedUploadUrl);
  if (ownedBlobUrls.length === 0) return;

  const res = await fetch("/api/v1/upload", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ urls: ownedBlobUrls }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error?.message ?? "Could not delete image");
  }
}

function isManagedUploadUrl(url: string) {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname.endsWith(".public.blob.vercel-storage.com") &&
      parsed.pathname.startsWith("/u/")
    );
  } catch {
    return url.startsWith("u/");
  }
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">{label}</label>
      {children}
      {hint ? <p className="mt-1.5 text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
        active
          ? "border-[color:var(--color-brand-600)] bg-[color:var(--color-brand-600)] text-white"
          : "border-[color:var(--color-border)] bg-white text-zinc-700 hover:border-[color:var(--color-brand-300)] hover:bg-[color:var(--color-brand-50)]",
      )}
    >
      {label}
    </button>
  );
}
