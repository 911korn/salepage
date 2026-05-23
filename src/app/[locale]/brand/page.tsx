import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft, Check, Download, Sparkles, X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { LogoMark, Wordmark } from "@/components/ui/logo";
import { ColorPalette } from "@/components/brand/color-swatch";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "brand" });
  return {
    title: `${t("title")} · SalePage`,
    description: t("subtitle"),
    openGraph: {
      title: `${t("title")} · SalePage`,
      description: t("subtitle"),
    },
  };
}

const BRAND_PALETTE = [
  { name: "50", hex: "#fff1f2", textOn: "light" as const },
  { name: "100", hex: "#ffe4e6", textOn: "light" as const },
  { name: "200", hex: "#fecdd3", textOn: "light" as const },
  { name: "300", hex: "#fda4af", textOn: "light" as const },
  { name: "400", hex: "#fb7185", textOn: "dark" as const },
  { name: "500", hex: "#f43f5e", textOn: "dark" as const },
  { name: "600 ★", hex: "#e11d48", textOn: "dark" as const },
  { name: "700", hex: "#be123c", textOn: "dark" as const },
  { name: "800", hex: "#9f1239", textOn: "dark" as const },
];

const ZINC_PALETTE = [
  { name: "50", hex: "#fafafa", textOn: "light" as const },
  { name: "100", hex: "#f4f4f5", textOn: "light" as const },
  { name: "200", hex: "#e4e4e7", textOn: "light" as const },
  { name: "300", hex: "#d4d4d8", textOn: "light" as const },
  { name: "400", hex: "#a1a1aa", textOn: "dark" as const },
  { name: "500", hex: "#71717a", textOn: "dark" as const },
  { name: "600", hex: "#52525b", textOn: "dark" as const },
  { name: "700", hex: "#3f3f46", textOn: "dark" as const },
  { name: "900", hex: "#09090b", textOn: "dark" as const },
];

const ASSETS = [
  { label: "Icon · Color", path: "/brand/salepage-icon.svg" },
  { label: "Icon · Mono light", path: "/brand/salepage-icon-mono-light.svg" },
  { label: "Icon · Mono dark", path: "/brand/salepage-icon-mono-dark.svg" },
  { label: "Wordmark · Default", path: "/brand/salepage-wordmark.svg" },
  { label: "Wordmark · On dark", path: "/brand/salepage-wordmark-white.svg" },
  { label: "Lockup · Default", path: "/brand/salepage-lockup.svg" },
  { label: "Lockup · On dark", path: "/brand/salepage-lockup-white.svg" },
];

interface SocialAsset {
  label: string;
  dimension: string;
  filename: string;
  aspect: string;
}

// PNGs rendered server-side via /api/v1/brand/social/[name] (ImageResponse)
const SOCIAL_ASSETS: SocialAsset[] = [
  {
    label: "Profile (Universal Square)",
    dimension: "1024 × 1024",
    filename: "profile-square",
    aspect: "1 / 1",
  },
  {
    label: "LINE OA · Square",
    dimension: "1024 × 1024",
    filename: "line-square",
    aspect: "1 / 1",
  },
  {
    label: "Facebook Cover",
    dimension: "1640 × 624",
    filename: "fb-cover",
    aspect: "1640 / 624",
  },
  {
    label: "Twitter / X Header",
    dimension: "1500 × 500",
    filename: "x-header",
    aspect: "3 / 1",
  },
  {
    label: "LinkedIn Banner",
    dimension: "1584 × 396",
    filename: "linkedin-banner",
    aspect: "4 / 1",
  },
  {
    label: "YouTube Channel Art",
    dimension: "2560 × 1440",
    filename: "youtube-art",
    aspect: "16 / 9",
  },
];

export default async function BrandPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("brand");
  const tSections = await getTranslations("brand.sections");

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-[color:var(--color-border)] bg-white">
        <div className="container-page flex h-16 items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-700 hover:text-[color:var(--color-fg)]"
          >
            <ArrowLeft className="size-4" /> salepage.in.th
          </Link>
          <Badge tone="soft-brand" className="text-[11px]">
            <Sparkles className="size-3" /> {t("version")} · {t("lastUpdated")}
          </Badge>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-[color:var(--color-border)] bg-gradient-to-br from-rose-50 via-white to-rose-50">
        <div className="absolute inset-0 -z-10 bg-grid opacity-30" />
        <div className="container-page py-20 sm:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex">
              <LogoMark size="size-24" glow />
            </div>
            <h1 className="font-display mt-7 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              {t("title")}
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-balance text-lg leading-relaxed text-zinc-600">
              {t("subtitle")}
            </p>
            <p className="mt-2 text-sm italic text-zinc-500">
              &ldquo;{t("tagline")}&rdquo;
            </p>
          </div>
        </div>
      </section>

      <main className="container-page py-16 sm:py-20">
        <div className="mx-auto max-w-5xl space-y-20">
          {/* Logo */}
          <Section title={tSections("logo")} desc={tSections("logoDesc")}>
            <div className="grid gap-4 lg:grid-cols-3">
              {/* Mark */}
              <LogoTile label={tSections("logoMark")}>
                <LogoMark size="size-28" />
              </LogoTile>
              {/* Wordmark */}
              <LogoTile label={tSections("logoWordmark")}>
                <Wordmark className="text-4xl" />
              </LogoTile>
              {/* Lockup */}
              <LogoTile label={tSections("logoLockup")}>
                <div className="flex items-center gap-3">
                  <LogoMark size="size-12" />
                  <Wordmark className="text-2xl" />
                </div>
              </LogoTile>
            </div>

            {/* On dark */}
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <LogoTile label={tSections("onLight")} bg="light">
                <div className="flex items-center gap-3">
                  <LogoMark size="size-16" />
                  <Wordmark className="text-3xl" />
                </div>
              </LogoTile>
              <LogoTile label={tSections("onDark")} bg="dark">
                <div className="flex items-center gap-3">
                  <LogoMark size="size-16" />
                  <span className="font-display text-3xl font-bold tracking-tight text-white">
                    Sale<span className="text-rose-300">Page</span>
                  </span>
                </div>
              </LogoTile>
            </div>
          </Section>

          {/* Colors */}
          <Section title={tSections("colors")} desc={tSections("colorsDesc")}>
            <ColorPalette title={tSections("primary")} swatches={BRAND_PALETTE} />
            <div className="mt-8">
              <ColorPalette title={tSections("neutrals")} swatches={ZINC_PALETTE} />
            </div>
          </Section>

          {/* Typography */}
          <Section
            title={tSections("typography")}
            desc={tSections("typographyDesc")}
          >
            <div className="space-y-3 rounded-3xl border border-[color:var(--color-border)] bg-[color:var(--color-soft)] p-6 sm:p-8">
              <p className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Kanit — Google Fonts
              </p>
              <p className="font-display text-5xl font-extrabold tracking-tight leading-tight sm:text-6xl">
                เปิดร้านออนไลน์ใน 30 วินาที
              </p>
              <p className="font-display text-3xl font-bold tracking-tight">
                Launch your online store in 30 seconds
              </p>
              <p className="text-lg leading-relaxed text-zinc-600">
                แพลตฟอร์มสร้างร้านขายของออนไลน์แบบสำเร็จรูป รับเงินตรง PromptPay
                พร้อมระบบตรวจสลิปอัตโนมัติ
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  { w: "300", label: "Light" },
                  { w: "400", label: "Regular" },
                  { w: "500", label: "Medium" },
                  { w: "600", label: "Semibold" },
                  { w: "700", label: "Bold" },
                  { w: "800", label: "ExtraBold" },
                ].map((s) => (
                  <span
                    key={s.w}
                    className="inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border)] bg-white px-3 py-1.5 text-sm"
                  >
                    <span className="text-zinc-500 text-[11px]">{s.w}</span>
                    <span style={{ fontWeight: Number(s.w) }}>{s.label}</span>
                  </span>
                ))}
              </div>
            </div>
          </Section>

          {/* Voice & tone */}
          <Section title={tSections("voice")} desc={tSections("voiceDesc")}>
            <div className="grid gap-4 sm:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-3xl border border-[color:var(--color-border)] bg-white p-6"
                >
                  <p className="font-display text-2xl font-bold text-[color:var(--color-brand-600)]">
                    {t(`sections.voicePrinciple${i}` as `sections.voicePrinciple1`)}
                  </p>
                  <p className="mt-2 text-[14px] leading-relaxed text-zinc-600">
                    {t(`sections.voicePrinciple${i}Body` as `sections.voicePrinciple1Body`)}
                  </p>
                </div>
              ))}
            </div>

            {/* Say / don't say */}
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <p className="text-sm font-semibold text-emerald-900">
                  {tSections("doSay")}
                </p>
                <ul className="mt-3 space-y-2 text-[14px] text-emerald-900">
                  {[1, 2, 3].map((i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                      <span>{t(`sections.doSay${i}` as `sections.doSay1`)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                <p className="text-sm font-semibold text-zinc-700">
                  {tSections("dontSay")}
                </p>
                <ul className="mt-3 space-y-2 text-[14px] text-zinc-700">
                  {[1, 2, 3].map((i) => (
                    <li key={i} className="flex items-start gap-2">
                      <X className="mt-0.5 size-4 shrink-0 text-zinc-400" />
                      <span className="line-through decoration-zinc-300">
                        {t(`sections.dontSay${i}` as `sections.dontSay1`)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Section>

          {/* Do's and don'ts */}
          <Section title={tSections("usage")} desc={tSections("usageDesc")}>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
                <p className="font-display text-base font-semibold text-emerald-900">
                  ✅ {tSections("do")}
                </p>
                <ul className="mt-3 space-y-2.5 text-[14px] leading-relaxed text-emerald-900">
                  {[1, 2, 3].map((i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                      <span>{t(`sections.do${i}` as `sections.do1`)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6">
                <p className="font-display text-base font-semibold text-rose-900">
                  ❌ {tSections("dont")}
                </p>
                <ul className="mt-3 space-y-2.5 text-[14px] leading-relaxed text-rose-900">
                  {[1, 2, 3].map((i) => (
                    <li key={i} className="flex items-start gap-2">
                      <X className="mt-0.5 size-4 shrink-0 text-rose-600" />
                      <span>{t(`sections.dont${i}` as `sections.dont1`)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Section>

          {/* Downloads */}
          <Section title={tSections("download")} desc="">
            <ul className="grid gap-2 sm:grid-cols-2">
              {ASSETS.map((a) => (
                <li key={a.path}>
                  <a
                    href={a.path}
                    download
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3 transition-all hover:-translate-y-0.5 hover:border-[color:var(--color-brand-200)] hover:shadow-sm",
                    )}
                  >
                    <span className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={a.path}
                        alt={a.label}
                        className="size-10 shrink-0 rounded-lg bg-[color:var(--color-soft)] p-1"
                      />
                      <span>
                        <span className="block text-sm font-medium">
                          {a.label}
                        </span>
                        <span className="block font-mono text-[10px] text-zinc-500">
                          {a.path}
                        </span>
                      </span>
                    </span>
                    <Download className="size-4 text-zinc-400" />
                  </a>
                </li>
              ))}
            </ul>
          </Section>

          {/* Social media assets — server-rendered PNG covers + profile pics */}
          <Section
            title="Social media assets"
            desc="Profile pic + cover/banner สำหรับทุก platform — gen เป็น PNG ออกมาที่ขนาดมาตรฐานพร้อมใช้"
          >
            <ul className="grid gap-3 sm:grid-cols-2">
              {SOCIAL_ASSETS.map((a) => {
                const previewUrl = `/api/v1/brand/social/${a.filename}.png`;
                // ?download=1 makes the response Content-Disposition: attachment,
                // so the browser saves the file instead of navigating to it inline.
                const downloadUrl = `${previewUrl}?download=1`;
                return (
                  <li
                    key={a.filename}
                    className="overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-white"
                  >
                    <div
                      className="relative w-full overflow-hidden bg-[color:var(--color-soft)]"
                      style={{ aspectRatio: a.aspect }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrl}
                        alt={a.label}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{a.label}</p>
                        <p className="font-mono text-[10px] text-zinc-500">
                          {a.dimension} px · PNG
                        </p>
                      </div>
                      <a
                        href={downloadUrl}
                        download={`salepage-${a.filename}.png`}
                        className={cn(
                          buttonStyles({ size: "sm", variant: "outline" }),
                          "gap-1.5 shrink-0",
                        )}
                      >
                        <Download className="size-3.5" /> ดาวน์โหลด
                      </a>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 text-[12px] text-zinc-500">
              ทุกภาพสร้างสดผ่าน <code className="rounded bg-zinc-100 px-1 font-mono">/api/v1/brand/social/[name].png</code> — fork ไปแก้ดีไซน์ได้ที่ <code className="rounded bg-zinc-100 px-1 font-mono">src/app/api/v1/brand/social/[name]/route.ts</code>
            </p>
          </Section>

          {/* Contact */}
          <Section title={tSections("contact")} desc={tSections("contactDesc")}>
            <a
              href="mailto:press@salepage.in.th"
              className={cn(buttonStyles({ size: "lg" }), "inline-flex")}
            >
              press@salepage.in.th
            </a>
          </Section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[color:var(--color-border)] bg-white">
        <div className="container-page py-8 text-center text-[13px] text-zinc-500">
          © {new Date().getFullYear()} SalePage — Brand Kit {t("version")} ·{" "}
          {t("lastUpdated")}
        </div>
      </footer>
    </div>
  );
}

function Section({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <header className="mb-6">
        <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          {title}
        </h2>
        {desc ? (
          <p className="mt-2 max-w-3xl text-balance text-[15px] leading-relaxed text-zinc-600">
            {desc}
          </p>
        ) : null}
      </header>
      {children}
    </section>
  );
}

function LogoTile({
  label,
  bg = "light",
  children,
}: {
  label: string;
  bg?: "light" | "dark";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative flex h-44 flex-col items-center justify-center rounded-2xl border",
        bg === "light"
          ? "border-[color:var(--color-border)] bg-white"
          : "border-zinc-800 bg-zinc-900",
      )}
    >
      {children}
      <span
        className={cn(
          "absolute bottom-3 left-3 text-[10px] font-semibold uppercase tracking-wider",
          bg === "light" ? "text-zinc-400" : "text-zinc-500",
        )}
      >
        {label}
      </span>
    </div>
  );
}
