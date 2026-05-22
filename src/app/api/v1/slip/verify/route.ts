import { z } from "zod";
import { verifySlip } from "@/lib/slip-verify";
import { ok, fail, parseJson } from "@/lib/api";

const Body = z
  .object({
    imageBase64: z.string().optional(),
    qrPayload: z.string().optional(),
    expectAmount: z.number().positive().optional(),
    expectReceiverId: z.string().optional(),
  })
  .refine((v) => Boolean(v.imageBase64 || v.qrPayload), {
    message: "ต้องส่ง imageBase64 หรือ qrPayload",
  });

export async function POST(request: Request) {
  const parsed = await parseJson(request, Body);
  if (!parsed.ok) return parsed.response;
  try {
    const result = await verifySlip(parsed.data);
    return ok(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return fail("slip_verify_error", message, 400);
  }
}
