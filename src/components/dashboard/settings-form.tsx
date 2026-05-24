"use client";

import { useRef, useState, useTransition } from "react";
import { Check, ImagePlus, Save, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

interface ShopProps {
  slug: string;
  name: string;
  description: string | null;
  category: string | null;
  themeColor: string;
  logoText: string | null;
  logoUrl: string | null;
  promptpayId: string | null;
  contact: { phone?: string; line?: string; facebook?: string } | null;
  policies: { returnPolicy?: string; shippingTime?: string } | null;
}

const CATEGORIES = [
  "fashion",
  "food",
  "tech",
  "beauty",
  "health",
  "furniture",
  "pets",
  "books",
  "sport",
  "other",
] as const;

const THEME_PRESETS = [
  "#e11d48",
  "#0f172a",
  "#2563eb",
  "#16a34a",
  "#7c3aed",
  "#ec4899",
  "#d97706",
  "#52525b",
];

const MAX_PROFILE_BYTES = 5 * 1024 * 1024;
const PROFILE_IMAGE_SIZE = 640;
const OPTIMIZED_IMAGE_TYPE = "image/webp";
const OPTIMIZED_IMAGE_QUALITY = 0.84;

export function SettingsForm({ shop }: { shop: ShopProps }) {
  const t = useTranslations("dashboard.settings");
  const tCat = useTranslations("categories");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState(shop.name);
  const [description, setDescription] = useState(shop.description ?? "");
  const [category, setCategory] = useState<string | null>(shop.category);
  const [themeColor, setThemeColor] = useState(shop.themeColor);
  const [logoText, setLogoText] = useState(shop.logoText ?? "");
  const [logoUrl, setLogoUrl] = useState(shop.logoUrl ?? "");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [promptpayId, setPromptpayId] = useState(shop.promptpayId ?? "");
  const [phone, setPhone] = useState(shop.contact?.phone ?? "");
  const [line, setLine] = useState(shop.contact?.line ?? "");
  const [facebook, setFacebook] = useState(shop.contact?.facebook ?? "");
  const [returnPolicy, setReturnPolicy] = useState(
    shop.policies?.returnPolicy ?? "",
  );
  const [shippingTime, setShippingTime] = useState(
    shop.policies?.shippingTime ?? "",
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        const res = await fetch(`/api/v1/shops/${shop.slug}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || null,
            category: category ?? null,
            themeColor,
            logoText: logoText.trim() || null,
            logoUrl: logoUrl || null,
            promptpayId: promptpayId.trim() || null,
            contact: {
              phone: phone.trim() || null,
              line: line.trim() || null,
              facebook: facebook.trim() || null,
            },
            policies: {
              returnPolicy: returnPolicy.trim() || null,
              shippingTime: shippingTime.trim() || null,
            },
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          toast.error(t("errors.saveFailed"), {
            description: json.error?.message,
          });
          return;
        }
        toast.success(t("saved"));
        router.refresh();
      } catch (e) {
        toast.error(t("errors.saveFailed"), {
          description: e instanceof Error ? e.message : "network error",
        });
      }
    });
  }

  async function uploadProfileImage(file: File | null | undefined) {
    if (!file || uploadingLogo) return;
    if (!file.type.startsWith("image/")) {
      toast.error("ไฟล์ต้องเป็นรูปภาพ");
      return;
    }

    setUploadingLogo(true);
    try {
      const optimized = await optimizeProfileImage(file);
      if (optimized.size > MAX_PROFILE_BYTES) {
        toast.error("รูปใหญ่เกินไป", { description: "สูงสุด 5MB" });
        return;
      }
      const form = new FormData();
      form.append("file", optimized);
      const res = await fetch("/api/v1/upload", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        toast.error(json.error?.message ?? "อัปโหลดรูปไม่สำเร็จ");
        return;
      }
      setLogoUrl(json.data.url);
      toast.success("อัปโหลดรูปโปรไฟล์แล้ว กดบันทึกเพื่อใช้กับร้าน");
    } catch (e) {
      toast.error("อัปโหลดรูปไม่สำเร็จ", {
        description: e instanceof Error ? e.message : "network error",
      });
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {/* General */}
      <Card title={t("sections.general")}>
        <Field label={t("fields.name")}>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label={t("fields.description")}>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={280}
            className="w-full resize-y rounded-xl border border-[color:var(--color-border)] bg-white p-3 text-[15px] outline-none focus:border-[color:var(--color-brand-400)] focus:ring-2 focus:ring-[color:var(--color-brand-100)]"
          />
        </Field>
        <Field label={t("fields.category")}>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(category === c ? null : c)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
                  category === c
                    ? "border-[color:var(--color-brand-600)] bg-[color:var(--color-brand-600)] text-white"
                    : "border-[color:var(--color-border)] bg-white text-zinc-700 hover:border-[color:var(--color-brand-300)]",
                )}
              >
                {tCat(c)}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("fields.profileImage")} hint={t("fields.profileImageHint")}>
            <div className="flex items-center gap-3">
              <div
                className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl border-4 border-white font-display text-3xl font-bold text-white shadow-md ring-1 ring-[color:var(--color-border)]"
                style={{ background: themeColor }}
              >
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="" className="size-full object-cover" />
                ) : (
                  logoText || name.slice(0, 1).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => uploadProfileImage(e.target.files?.[0])}
                />
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploadingLogo}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[color:var(--color-border)] bg-white px-3 text-sm font-semibold text-zinc-800 disabled:opacity-60"
                >
                  <ImagePlus className="size-4" />
                  {uploadingLogo
                    ? t("fields.profileImageUploading")
                    : logoUrl
                      ? t("fields.profileImageChange")
                      : t("fields.profileImageUpload")}
                </button>
                {logoUrl ? (
                  <button
                    type="button"
                    onClick={() => setLogoUrl("")}
                    className="ml-2 inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-rose-50 px-3 text-sm font-semibold text-rose-700 ring-1 ring-rose-100"
                  >
                    <Trash2 className="size-4" />
                    {t("fields.profileImageRemove")}
                  </button>
                ) : null}
              </div>
            </div>
          </Field>
          <Field label={t("fields.themeColor")}>
            <div className="flex flex-wrap items-center gap-2">
              {THEME_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setThemeColor(c)}
                  className={cn(
                    "grid size-9 place-items-center rounded-xl transition-transform",
                    themeColor === c
                      ? "scale-105 ring-2 ring-offset-2 ring-[color:var(--color-brand-600)]"
                      : "hover:scale-105",
                  )}
                  style={{ background: c }}
                >
                  {themeColor === c ? (
                    <Check className="size-4 text-white" strokeWidth={3} />
                  ) : null}
                </button>
              ))}
              <input
                type="color"
                value={themeColor}
                onChange={(e) => setThemeColor(e.target.value)}
                className="size-9 cursor-pointer rounded-xl border-2 border-[color:var(--color-border)]"
                title="Custom"
              />
            </div>
          </Field>
          <Field label={t("fields.logoText")} hint={t("fields.logoHint")}>
            <Input
              value={logoText}
              onChange={(e) => setLogoText(e.target.value.slice(0, 2))}
              maxLength={2}
              placeholder={name.slice(0, 1).toUpperCase()}
            />
          </Field>
        </div>
      </Card>

      {/* Payment */}
      <Card title={t("sections.payment")}>
        <Field label={t("fields.promptpayId")} hint={t("fields.promptpayHint")}>
          <Input
            value={promptpayId}
            onChange={(e) => setPromptpayId(e.target.value)}
            placeholder="0812345678"
            inputMode="numeric"
          />
        </Field>
      </Card>

      {/* Contact */}
      <Card title={t("sections.contact")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("fields.phone")}>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="08x-xxx-xxxx"
              inputMode="numeric"
            />
          </Field>
          <Field label={t("fields.line")}>
            <Input
              value={line}
              onChange={(e) => setLine(e.target.value)}
              placeholder="@yourshop"
            />
          </Field>
        </div>
        <Field label={t("fields.facebook")}>
          <Input
            value={facebook}
            onChange={(e) => setFacebook(e.target.value)}
            placeholder="https://facebook.com/yourpage"
            type="url"
          />
        </Field>
      </Card>

      {/* Policies */}
      <Card title={t("sections.policies")}>
        <Field label={t("fields.returnPolicy")}>
          <textarea
            value={returnPolicy}
            onChange={(e) => setReturnPolicy(e.target.value)}
            rows={3}
            maxLength={500}
            className="w-full resize-y rounded-xl border border-[color:var(--color-border)] bg-white p-3 text-[15px] outline-none focus:border-[color:var(--color-brand-400)] focus:ring-2 focus:ring-[color:var(--color-brand-100)]"
          />
        </Field>
        <Field label={t("fields.shippingTime")}>
          <Input
            value={shippingTime}
            onChange={(e) => setShippingTime(e.target.value)}
            placeholder="1-3 วันทำการ"
          />
        </Field>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" loading={pending} disabled={pending}>
          <Save className="size-4" /> {t("save")}
        </Button>
      </div>
    </form>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-[color:var(--color-border)] bg-white p-5 sm:p-7">
      <h2 className="font-display text-base font-semibold">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

async function optimizeProfileImage(file: File): Promise<File> {
  let image: {
    source: CanvasImageSource;
    width: number;
    height: number;
    cleanup: () => void;
  } | null = null;

  try {
    image = await loadImageSource(file);
    const side = Math.min(image.width, image.height);
    const sx = Math.max(0, Math.round((image.width - side) / 2));
    const sy = Math.max(0, Math.round((image.height - side) / 2));
    const size = Math.min(PROFILE_IMAGE_SIZE, side);

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return file;

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image.source, sx, sy, side, side, 0, 0, size, size);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, OPTIMIZED_IMAGE_TYPE, OPTIMIZED_IMAGE_QUALITY);
    });
    if (!blob) return file;
    return new File([blob], optimizedProfileFileName(file.name), {
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
      // Fall through to img element path.
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

function optimizedProfileFileName(name: string) {
  const base = name.replace(/\.[^.]+$/, "") || "shop-profile";
  return `${base}.webp`;
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
