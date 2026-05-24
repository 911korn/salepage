import type { Metadata, Viewport } from "next";
import { Kanit } from "next/font/google";
import { Toaster } from "sonner";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { PlatformBanner } from "@/components/platform-banner";
import "../globals.css";

const kanit = Kanit({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-kanit",
  display: "swap",
});

const kanitDisplay = Kanit({
  subsets: ["thai", "latin"],
  weight: ["600", "700", "800"],
  variable: "--font-kanit-display",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    metadataBase: new URL("https://salepage.in.th"),
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical:
        locale === routing.defaultLocale
          ? "https://salepage.in.th"
          : `https://salepage.in.th/${locale}`,
      languages: {
        th: "https://salepage.in.th",
        en: "https://salepage.in.th/en",
        "x-default": "https://salepage.in.th",
      },
    },
    openGraph: {
      title: t("ogTitle"),
      description: t("ogDescription"),
      url:
        locale === routing.defaultLocale
          ? "https://salepage.in.th"
          : `https://salepage.in.th/${locale}`,
      siteName: "SalePage",
      type: "website",
      locale: locale === "th" ? "th_TH" : "en_US",
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#ffffff",
};

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale as Locale);

  return (
    <html
      lang={locale}
      className={`${kanit.variable} ${kanitDisplay.variable} antialiased`}
    >
      <body className="min-h-screen bg-[color:var(--color-bg)] text-[color:var(--color-fg)]">
        <NextIntlClientProvider>
          <PlatformBanner />
          {children}
          <Toaster
            richColors
            position="top-center"
            toastOptions={{
              classNames: {
                toast:
                  "!rounded-xl !border !border-[color:var(--color-border)] !shadow-lg",
              },
            }}
          />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
