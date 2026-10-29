import { z } from "zod";
import { recordError } from "@/lib/error-log";

/**
 * POST /api/v1/errors — browser error reports from src/instrumentation-client.ts.
 * Public and unauthenticated by design (errors happen before sign-in too);
 * lib/error-log caps new fingerprints per hour and truncates every field.
 * Always answers 204 so a bad report never surfaces in the page.
 */
const Body = z.object({
  message: z.string().min(1).max(2000),
  stack: z.string().max(8000).optional(),
  path: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > 12_000) return new Response(null, { status: 204 });
  let parsed: z.infer<typeof Body> | null = null;
  try {
    const r = Body.safeParse(JSON.parse(raw));
    parsed = r.success ? r.data : null;
  } catch {
    parsed = null;
  }
  if (parsed) {
    await recordError({
      source: "client",
      message: parsed.message,
      stack: parsed.stack,
      path: parsed.path,
      userAgent: request.headers.get("user-agent"),
    });
  }
  return new Response(null, { status: 204 });
}
