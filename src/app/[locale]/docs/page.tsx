import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { ArrowLeft, Code2, ExternalLink } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { LogoLockup } from "@/components/ui/logo";
import { Badge } from "@/components/ui/badge";
import type { Locale } from "@/i18n/routing";

export const metadata: Metadata = {
  title: "Developer docs · SalePage",
  description:
    "REST API documentation for SalePage — PromptPay QR generation, slip verification, shops, orders, billing.",
};

const ENDPOINTS = [
  {
    group: "PromptPay",
    items: [
      { method: "POST", path: "/api/v1/promptpay/qr", desc: "Generate Thai QR Payment from a phone / national ID + optional amount." },
      { method: "GET", path: "/api/v1/promptpay/qr?id=…&amount=…", desc: "Same, accepts query params." },
    ],
  },
  {
    group: "Slip verification",
    items: [
      { method: "POST", path: "/api/v1/slip/verify", desc: "Verify a bank transfer slip image / QR payload. Returns parsed sender / receiver / amount." },
    ],
  },
  {
    group: "Shops",
    items: [
      { method: "GET", path: "/api/v1/shops", desc: "List shops owned by the signed-in user.", auth: true },
      { method: "POST", path: "/api/v1/shops", desc: "Create a shop.", auth: true },
      { method: "GET", path: "/api/v1/shops/:slug", desc: "Public shop info." },
      { method: "PATCH", path: "/api/v1/shops/:slug", desc: "Update shop (owner only).", auth: true },
      { method: "GET", path: "/api/v1/shops/:slug/products", desc: "Public product list." },
      { method: "POST", path: "/api/v1/shops/:slug/products", desc: "Create a product.", auth: true },
      { method: "GET / PATCH / DELETE", path: "/api/v1/shops/:slug/products/:productSlug", desc: "Product detail / update / delete." },
    ],
  },
  {
    group: "Orders",
    items: [
      { method: "POST", path: "/api/v1/orders", desc: "Place an order. Returns tracking token + PromptPay QR." },
      { method: "GET", path: "/api/v1/orders/:token", desc: "Public order detail." },
      { method: "POST", path: "/api/v1/orders/:token/slip", desc: "Upload + auto-verify a transfer slip for an order." },
      { method: "PATCH", path: "/api/v1/orders/:token/status", desc: "Mark as shipping / delivered / cancelled (owner only).", auth: true },
    ],
  },
  {
    group: "Billing",
    items: [
      { method: "GET", path: "/api/v1/billing/plans", desc: "Public plan catalog (price + trial)." },
      { method: "POST", path: "/api/v1/billing/checkout", desc: "Start a Stripe Checkout session for Pro / Business." },
      { method: "POST", path: "/api/v1/billing/portal", desc: "Get Stripe billing portal URL for an existing customer." },
      { method: "POST", path: "/api/v1/billing/webhook", desc: "Stripe-signed webhook (server-to-server)." },
    ],
  },
  {
    group: "Misc",
    items: [
      { method: "GET", path: "/api/v1/health", desc: "Lists all endpoints + server time. Useful for uptime monitors." },
      { method: "POST", path: "/api/v1/upload", desc: "Upload an image to Vercel Blob; returns a permanent URL.", auth: true },
    ],
  },
];

export default async function DocsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="min-h-screen bg-[color:var(--color-soft)]">
      <header className="border-b border-[color:var(--color-border)] bg-white">
        <div className="container-page flex h-16 items-center justify-between">
          <Link href="/" className="inline-flex">
            <LogoLockup />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-[color:var(--color-fg)]"
          >
            <ArrowLeft className="size-4" /> กลับหน้าแรก
          </Link>
        </div>
      </header>

      <main className="container-page py-12 sm:py-16">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center gap-2">
            <Code2 className="size-5 text-[color:var(--color-brand-600)]" />
            <Badge tone="soft-brand" className="text-[10px]">
              API v1
            </Badge>
          </div>
          <h1 className="font-display mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Developer documentation
          </h1>
          <p className="mt-3 max-w-2xl text-balance text-[15px] leading-relaxed text-zinc-600">
            SalePage is API-first. ทุกฟีเจอร์เปิดเป็น REST endpoint
            ที่ใช้ได้ทั้ง web app และ mobile app — response เป็น JSON
            มาตรฐาน{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[12px]">
              {"{ ok, data }"}
            </code>{" "}
            หรือ{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[12px]">
              {"{ ok: false, error }"}
            </code>
            .
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <a
              href="/api/v1/health"
              className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-border)] bg-white px-3 py-1.5 text-sm font-medium hover:border-[color:var(--color-brand-300)]"
            >
              <ExternalLink className="size-3.5" /> /api/v1/health (live)
            </a>
          </div>

          <div className="mt-10 space-y-8">
            {ENDPOINTS.map((group) => (
              <section key={group.group}>
                <h2 className="font-display text-xl font-bold tracking-tight">
                  {group.group}
                </h2>
                <ul className="mt-3 overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-white">
                  {group.items.map((it, i) => (
                    <li
                      key={i}
                      className="flex flex-col gap-1 border-b border-[color:var(--color-border)] px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:gap-3"
                    >
                      <span className="inline-flex shrink-0 items-center gap-2">
                        <span className="inline-block rounded bg-[color:var(--color-brand-50)] px-2 py-0.5 font-mono text-[11px] font-semibold text-[color:var(--color-brand-700)]">
                          {it.method}
                        </span>
                        <code className="font-mono text-[12px] text-zinc-800">
                          {it.path}
                        </code>
                        {it.auth ? (
                          <Badge tone="warning" className="text-[10px]">
                            auth
                          </Badge>
                        ) : null}
                      </span>
                      <span className="text-[13px] text-zinc-600 sm:ml-auto">
                        {it.desc}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <p className="mt-12 rounded-2xl border border-dashed border-[color:var(--color-border)] bg-white p-5 text-center text-[13px] text-zinc-600">
            เอกสารแบบ OpenAPI / interactive playground (Stoplight, Mintlify) อยู่
            ในแผน — ติดต่อ{" "}
            <a
              href="mailto:dev@salepage.in.th"
              className="font-medium text-[color:var(--color-brand-700)] hover:underline"
            >
              dev@salepage.in.th
            </a>{" "}
            ถ้าต้องการ early access
          </p>
        </div>
      </main>
    </div>
  );
}
