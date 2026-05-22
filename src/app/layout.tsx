import type { Metadata, Viewport } from "next";
import { Kanit } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

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

export const metadata: Metadata = {
  metadataBase: new URL("https://salepage.in.th"),
  title: "SalePage — เปิดร้านออนไลน์ใน 30 วินาที | salepage.in.th",
  description:
    "แพลตฟอร์มสร้างร้านขายของออนไลน์แบบสำเร็จรูป รับเงินตรง PromptPay พร้อมระบบตรวจสลิปอัตโนมัติ — ฟรี ไม่ต้องเขียนโค้ด",
  keywords: [
    "SalePage",
    "เปิดร้านออนไลน์",
    "ขายของออนไลน์",
    "PromptPay QR",
    "ตรวจสลิปอัตโนมัติ",
    "สร้างร้านค้าฟรี",
    "salepage.in.th",
  ],
  alternates: { canonical: "https://salepage.in.th" },
  openGraph: {
    title: "SalePage — เปิดร้านออนไลน์ใน 30 วินาที",
    description:
      "สร้างร้านขายของออนไลน์ฟรี รับเงินตรง PromptPay พร้อมตรวจสลิปอัตโนมัติ",
    url: "https://salepage.in.th",
    siteName: "SalePage",
    type: "website",
    locale: "th_TH",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="th"
      className={`${kanit.variable} ${kanitDisplay.variable} antialiased`}
    >
      <body className="min-h-screen bg-[color:var(--color-bg)] text-[color:var(--color-fg)]">
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
      </body>
    </html>
  );
}
