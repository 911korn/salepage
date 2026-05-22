import generatePayload from "promptpay-qr";
import QRCode from "qrcode";

export type PromptPayIdType = "phone" | "national-id" | "ewallet";

export interface PromptPayRequest {
  /**
   * The PromptPay identifier — Thai mobile phone (10 digits, e.g. "0812345678"),
   * Thai national ID (13 digits), or e-wallet ID (15 digits).
   */
  id: string;
  /** Optional fixed amount in THB. If omitted, the QR is "any amount". */
  amount?: number;
}

export interface PromptPayResult {
  /** Raw EMVCo payload string that gets encoded into the QR. */
  payload: string;
  /** Base64-encoded PNG data URL of the QR for client display. */
  dataUrl: string;
  /** SVG string for the QR (useful for crisp print). */
  svg: string;
  /** Normalized identifier (only digits). */
  id: string;
  amount?: number;
}

const DIGITS_ONLY = /\D+/g;

export function normalizePromptPayId(input: string): string {
  return input.replace(DIGITS_ONLY, "");
}

export function detectPromptPayIdType(id: string): PromptPayIdType | null {
  const digits = normalizePromptPayId(id);
  if (digits.length === 10 && digits.startsWith("0")) return "phone";
  if (digits.length === 13) return "national-id";
  if (digits.length === 15) return "ewallet";
  return null;
}

export async function generatePromptPay({
  id,
  amount,
}: PromptPayRequest): Promise<PromptPayResult> {
  const digits = normalizePromptPayId(id);
  if (!detectPromptPayIdType(digits)) {
    throw new Error(
      "PromptPay ID ไม่ถูกต้อง: ต้องเป็นเบอร์โทร 10 หลัก เลขบัตร 13 หลัก หรือ e-wallet 15 หลัก",
    );
  }
  if (amount !== undefined) {
    if (!Number.isFinite(amount) || amount <= 0 || amount > 9_999_999.99) {
      throw new Error("ยอดเงินไม่ถูกต้อง: ต้องเป็นจำนวนเงินบวก ไม่เกิน 9,999,999.99 บาท");
    }
  }

  const payload = generatePayload(digits, amount ? { amount } : ({} as { amount: number }));
  const [dataUrl, svg] = await Promise.all([
    QRCode.toDataURL(payload, {
      errorCorrectionLevel: "M",
      margin: 1,
      scale: 8,
      color: { dark: "#0a0a0a", light: "#ffffff" },
    }),
    QRCode.toString(payload, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 1,
      color: { dark: "#0a0a0a", light: "#ffffff" },
    }),
  ]);

  return { payload, dataUrl, svg, id: digits, amount };
}
