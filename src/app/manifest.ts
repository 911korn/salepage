import type { MetadataRoute } from "next";

/**
 * PWA manifest — drives "Add to Home Screen" on iOS Safari + Android Chrome.
 * Also makes Lighthouse's "Installable" audit pass + unlocks the Web Share
 * Target intent registration for the future "share product to SalePage" flow.
 *
 * Icons live under /public so they're served as static assets. The maskable
 * 512 has its own entry so Android can crop into adaptive icons without
 * revealing white edges.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SalePage : ขายของไม่หัก %",
    short_name: "SalePage",
    description:
      "เปิดร้านออนไลน์ฟรี ไม่หักค่าคอม รับเงินตรง PromptPay พร้อม AI ตรวจสลิปอัตโนมัติ",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#e11d48",
    lang: "th",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    categories: ["shopping", "business"],
  };
}
