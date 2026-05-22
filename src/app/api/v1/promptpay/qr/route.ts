import { z } from "zod";
import { generatePromptPay } from "@/lib/promptpay";
import { ok, fail, parseJson } from "@/lib/api";

const Body = z.object({
  id: z.string().min(9, "PromptPay ID สั้นเกินไป").max(20),
  amount: z
    .union([z.number(), z.string()])
    .optional()
    .transform((v) =>
      v === undefined || v === ""
        ? undefined
        : typeof v === "number"
          ? v
          : Number(v),
    )
    .refine((v) => v === undefined || (Number.isFinite(v) && v > 0), {
      message: "ยอดเงินไม่ถูกต้อง",
    }),
});

export async function POST(request: Request) {
  const parsed = await parseJson(request, Body);
  if (!parsed.ok) return parsed.response;
  try {
    const result = await generatePromptPay(parsed.data);
    return ok(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return fail("promptpay_error", message, 400);
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const amountRaw = url.searchParams.get("amount");
  if (!id) return fail("missing_id", "ต้องระบุ ?id=<promptpay-id>", 400);
  try {
    const result = await generatePromptPay({
      id,
      amount: amountRaw ? Number(amountRaw) : undefined,
    });
    return ok(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return fail("promptpay_error", message, 400);
  }
}
