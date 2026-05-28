import { PaymentGatewayProvider } from "@/lib/db";

/**
 * Catalogue of every payment gateway the platform supports, with the
 * metadata the dashboard UI + the adapter layer share. Adding a new
 * provider is a 3-step process:
 *   1. Add to PaymentGatewayProvider enum in prisma schema + migrate
 *   2. Add an entry here
 *   3. Add an adapter under ./adapters/<provider>.ts that exports
 *      testConnection({ publicKey, secretKey, mode }): Promise<TestResult>
 *
 * The registry stays decoupled from React — page.tsx imports it and
 * renders one card per entry.
 */

export interface ProviderMetadata {
  provider: PaymentGatewayProvider;
  /** Display name shown in the dashboard. */
  name: string;
  /** Brand label / short tagline for the seller. */
  tagline: string;
  /** Documentation URL where the seller finds their API keys. */
  docsUrl: string;
  /** Where the seller goes to grab their dashboard credentials. */
  dashboardUrl: string;
  /** What the public-side identifier is named in this provider's lingo,
   *  used as the input field label (e.g. "Publishable Key", "Merchant ID"). */
  publicKeyLabel: string;
  /** Same for the secret. */
  secretKeyLabel: string;
  /** True when this provider issues a webhook signing secret. UI shows
   *  a 3rd input field when true. */
  hasWebhookSecret: boolean;
  /** Currencies the provider settles in. THB-supporting providers are
   *  marked. PayPal/Stripe support multi-currency. */
  currencies: string[];
  /** Whether this provider supports credit-card processing — drives the
   *  feature badges in the UI. */
  supportsCards: boolean;
  /** PromptPay QR support — some local gateways generate dynamic QR. */
  supportsPromptPay: boolean;
  /** Brand colour for the card border / badge. */
  brandColor: string;
  /** Single-letter monogram for the card thumbnail. */
  monogram: string;
  /** "live" = seller can plug in keys right now. "roadmap" = adapter not
   *  wired yet; the card shows a "Coming soon" badge with a heart-button
   *  so we can prioritise based on demand. 911korn 2026-05-28 "เอาแค่
   *  เจ้าหลักมาสัก 3 เจ้าก่อนพอ ที่เหลือเก็บเป็น Road map". */
  availability: "live" | "roadmap";
  /** Optional ETA label shown next to "Coming soon" — undefined = no ETA. */
  roadmapEta?: string;
}

export const PROVIDERS: readonly ProviderMetadata[] = [
  // ── Live · 3 เจ้าหลักครอบคลุม Thai SME use case ─────────────────────
  {
    provider: PaymentGatewayProvider.OMISE,
    name: "Omise (Opn Payments)",
    tagline: "PSP ที่ Thai SME ใช้บ่อยที่สุด — รับบัตร + PromptPay + TrueMoney",
    docsUrl: "https://docs.opn.ooo/api-keys",
    dashboardUrl: "https://dashboard.omise.co",
    publicKeyLabel: "Public Key (pkey_...)",
    secretKeyLabel: "Secret Key (skey_...)",
    hasWebhookSecret: false,
    currencies: ["THB"],
    supportsCards: true,
    supportsPromptPay: true,
    brandColor: "#1A56DB",
    monogram: "O",
    availability: "live",
  },
  {
    provider: PaymentGatewayProvider.STRIPE,
    name: "Stripe",
    tagline: "บัตรเครดิตทั่วโลก + รองรับ THB · webhook signing secret ต้องใส่ด้วย",
    docsUrl: "https://stripe.com/docs/keys",
    dashboardUrl: "https://dashboard.stripe.com/apikeys",
    publicKeyLabel: "Publishable Key (pk_...)",
    secretKeyLabel: "Secret Key (sk_...)",
    hasWebhookSecret: true,
    currencies: ["THB", "USD", "EUR", "JPY", "+135 อื่นๆ"],
    supportsCards: true,
    supportsPromptPay: false,
    brandColor: "#635BFF",
    monogram: "S",
    availability: "live",
  },
  {
    provider: PaymentGatewayProvider.KSHER,
    name: "Ksher",
    tagline: "Cross-border CN↔TH — รับ Alipay + WeChat Pay จากนักท่องเที่ยวจีน",
    docsUrl: "https://docs.ksher.com",
    dashboardUrl: "https://merchant.ksher.com",
    publicKeyLabel: "Merchant ID",
    secretKeyLabel: "API Secret",
    hasWebhookSecret: false,
    currencies: ["THB", "CNY"],
    supportsCards: true,
    supportsPromptPay: true,
    brandColor: "#00A859",
    monogram: "K",
    availability: "live",
  },
  {
    provider: PaymentGatewayProvider.C2P,
    name: "2C2P",
    tagline: "Hub ใหญ่ในเอเชีย — รับบัตร + ผ่อน 0% + หลายช่องทาง local",
    docsUrl: "https://developer.2c2p.com",
    dashboardUrl: "https://merchant.2c2p.com",
    publicKeyLabel: "Merchant ID",
    secretKeyLabel: "Secret Key",
    hasWebhookSecret: true,
    currencies: ["THB", "USD", "SGD", "MYR", "IDR"],
    supportsCards: true,
    supportsPromptPay: true,
    brandColor: "#0066CC",
    monogram: "2",
    availability: "live",
  },
  // ── Roadmap · adapter ยังไม่ wired — 911korn 2026-05-28 "ที่เหลือ
  //    เก็บเป็น Road map". UI โชว์การ์ดเป็น "Coming soon" + ETA
  {
    provider: PaymentGatewayProvider.PAYPAL,
    name: "PayPal",
    tagline: "ลูกค้าต่างประเทศ — รับ USD/EUR/JPY แล้วถอนเข้าบัญชีไทย",
    docsUrl: "https://developer.paypal.com",
    dashboardUrl: "https://www.paypal.com/businessmanage/credentials",
    publicKeyLabel: "Client ID",
    secretKeyLabel: "Client Secret",
    hasWebhookSecret: true,
    currencies: ["USD", "EUR", "GBP", "JPY", "THB", "+25 อื่นๆ"],
    supportsCards: true,
    supportsPromptPay: false,
    brandColor: "#003087",
    monogram: "P",
    availability: "roadmap",
    roadmapEta: "Q3 2026",
  },
  {
    provider: PaymentGatewayProvider.GBPRIMEPAY,
    name: "GBPrimePay",
    tagline: "Backed Bangkok Bank · บัตร + QR + e-Wallet — SME-friendly fee",
    docsUrl: "https://doc.gbprimepay.com",
    dashboardUrl: "https://www.gbprimepay.com/merchant",
    publicKeyLabel: "Public Key",
    secretKeyLabel: "Secret Key",
    hasWebhookSecret: false,
    currencies: ["THB"],
    supportsCards: true,
    supportsPromptPay: true,
    brandColor: "#003F87",
    monogram: "G",
    availability: "live",
  },
  {
    provider: PaymentGatewayProvider.KBANK,
    name: "K-Payment Gateway",
    tagline: "Kasikornbank — ราคาดี รับบัตร + K PLUS QR",
    docsUrl: "https://www.kasikornbank.com/business/merchants",
    dashboardUrl: "https://merchant.kasikornbank.com",
    publicKeyLabel: "Merchant ID",
    secretKeyLabel: "API Secret",
    hasWebhookSecret: true,
    currencies: ["THB"],
    supportsCards: true,
    supportsPromptPay: true,
    brandColor: "#138F2D",
    monogram: "K",
    availability: "roadmap",
    roadmapEta: "Q4 2026",
  },
  {
    provider: PaymentGatewayProvider.SCB,
    name: "SCB Easy Pay",
    tagline: "Siam Commercial Bank — ลูกค้า SCB QR เข้าบัญชีตรง",
    docsUrl: "https://developer.scb",
    dashboardUrl: "https://merchant.scb",
    publicKeyLabel: "Application Key",
    secretKeyLabel: "Application Secret",
    hasWebhookSecret: false,
    currencies: ["THB"],
    supportsCards: true,
    supportsPromptPay: true,
    brandColor: "#4E2B7E",
    monogram: "฿",
    availability: "roadmap",
    roadmapEta: "Q4 2026",
  },
  {
    provider: PaymentGatewayProvider.KRUNGSRI,
    name: "Krungsri Online Payment",
    tagline: "Krungsri (Bay) — ครอบคลุมบัตร + Krungsri Wallet",
    docsUrl: "https://www.krungsri.com/en/business/merchants",
    dashboardUrl: "https://www.krungsri.com/en/business/merchants",
    publicKeyLabel: "Merchant ID",
    secretKeyLabel: "Secret Key",
    hasWebhookSecret: false,
    currencies: ["THB"],
    supportsCards: true,
    supportsPromptPay: false,
    brandColor: "#FCC100",
    monogram: "K",
    availability: "roadmap",
  },
  {
    provider: PaymentGatewayProvider.TRUEMONEY,
    name: "TrueMoney Wallet",
    tagline: "Wallet ใหญ่ — ลูกค้าวัยรุ่นนิยมจ่ายจาก TrueMoney",
    docsUrl: "https://developer.truemoney.com",
    dashboardUrl: "https://merchant.truemoney.com",
    publicKeyLabel: "App ID",
    secretKeyLabel: "App Secret",
    hasWebhookSecret: true,
    currencies: ["THB"],
    supportsCards: false,
    supportsPromptPay: false,
    brandColor: "#FF6B00",
    monogram: "T",
    availability: "roadmap",
  },
  {
    provider: PaymentGatewayProvider.RABBIT_LINEPAY,
    name: "Rabbit LINE Pay",
    tagline: "ลูกค้า LINE — payment ใน LIFF จบในแชทเดียว",
    docsUrl: "https://pay.line.me/developers",
    dashboardUrl: "https://pay.line.me/portal/global",
    publicKeyLabel: "Channel ID",
    secretKeyLabel: "Channel Secret",
    hasWebhookSecret: false,
    currencies: ["THB"],
    supportsCards: false,
    supportsPromptPay: false,
    brandColor: "#06C755",
    monogram: "L",
    availability: "roadmap",
  },
  {
    provider: PaymentGatewayProvider.PAYSOLUTIONS,
    name: "PaySolutions",
    tagline: "Local Thai PSP — popular for billing + recurring",
    docsUrl: "https://www.paysolutions.asia/document",
    dashboardUrl: "https://www.paysolutions.asia/MerchantDashboard",
    publicKeyLabel: "Merchant ID",
    secretKeyLabel: "API Key",
    hasWebhookSecret: false,
    currencies: ["THB"],
    supportsCards: true,
    supportsPromptPay: true,
    brandColor: "#E6342A",
    monogram: "P",
    availability: "roadmap",
  },
];

export function getProvider(provider: PaymentGatewayProvider): ProviderMetadata {
  const found = PROVIDERS.find((p) => p.provider === provider);
  if (!found) throw new Error(`Unknown payment provider: ${provider}`);
  return found;
}
