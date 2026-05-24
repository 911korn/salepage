import { ok } from "@/lib/api";
import {
  getPlatformLineLiffId,
  isPlatformLineConfigured,
} from "@/lib/line";

export const runtime = "nodejs";

export async function GET() {
  return ok({
    liffId: getPlatformLineLiffId(),
    configured: isPlatformLineConfigured(),
  });
}
