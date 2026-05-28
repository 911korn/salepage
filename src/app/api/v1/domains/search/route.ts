import { z } from "zod";
import { ok, fail } from "@/lib/api";
import { resolveSession } from "@/lib/api-auth";
import { hasBusinessPlan } from "@/lib/plan";
import { isAvailable, priceFor, buyUrl } from "@/lib/porkbun";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/**
 * GET /api/v1/domains/search?q=mystore
 *
 * For a search term like "mystore", check availability + price across a
 * curated TLD shortlist (.com .co .io .shop .in.th .store .me .app)
 * and return rows the dashboard can render.
 *
 * Each row has a Porkbun deep-link the seller follows to actually buy.
 * After buy, they come back and add the domain via the regular
 * /dashboard/settings/domains flow which provisions the CF zone.
 *
 * Business+ gated — non-paying sellers can still browse though, since
 * the search itself doesn't cost us anything (RDAP is free, pricing
 * is cached). Gate only kicks in when they try to ADD the domain.
 *
 * For "mystore.com" style inputs (already has TLD), only checks that
 * specific TLD instead of fanning out.
 */

const TLD_SHORTLIST = [
  "com",
  "co",
  "io",
  "shop",
  "store",
  "online",
  "app",
  "in.th",
  "me",
  "xyz",
] as const;

const Query = z.object({
  q: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(63)
    .regex(
      /^[a-z0-9-]+(\.[a-z0-9-]+)*$/,
      "ใช้เฉพาะ a-z 0-9 ขีดกลาง (เว้นจุดถ้าใส่ TLD เอง)",
    ),
});

export async function GET(request: Request) {
  const session = await resolveSession(request);
  if (!session.ok) return session.response;
  // Business+ optional for search — we WANT non-Pro sellers to discover
  // they can buy a custom domain → encourages upgrade. We just flag
  // hasBusinessPlan in the response so the UI can show an upgrade nudge.
  const hasBusiness = await hasBusinessPlan(session.user.id);

  const url = new URL(request.url);
  const parsed = Query.safeParse({ q: url.searchParams.get("q") });
  if (!parsed.success) {
    return fail(
      "invalid_query",
      parsed.error.issues[0]?.message ?? "Invalid query",
      400,
    );
  }
  const term = parsed.data.q;

  // Decide which TLDs to check.
  let candidates: string[];
  if (term.includes(".")) {
    candidates = [term];
  } else {
    candidates = TLD_SHORTLIST.map((tld) => `${term}.${tld}`);
  }

  // Check which candidates are already mapped in our system — these
  // are "taken on SalePage" (another shop is using them) and should
  // never show as available.
  const taken = await db.shopDomain.findMany({
    where: { domain: { in: candidates } },
    select: { domain: true },
  });
  const takenSet = new Set(taken.map((t) => t.domain));

  // Fan-out availability + price lookups. We swallow per-row errors so
  // the rest of the grid still renders.
  const rows = await Promise.all(
    candidates.map(async (domain) => {
      if (takenSet.has(domain)) {
        return {
          domain,
          available: false,
          takenOnPlatform: true,
          tld: domain.split(".").slice(1).join("."),
          registrationUsd: null,
          renewalUsd: null,
          buyUrl: null,
          error: null,
        };
      }
      try {
        const available = await isAvailable(domain);
        const tld = domain.split(".").slice(1).join(".");
        const price = await priceFor(tld);
        return {
          domain,
          available,
          takenOnPlatform: false,
          tld,
          registrationUsd: price?.registrationUsd ?? null,
          renewalUsd: price?.renewalUsd ?? null,
          buyUrl: available ? buyUrl(domain) : null,
          error: null,
        };
      } catch (err) {
        return {
          domain,
          available: null,
          takenOnPlatform: false,
          tld: domain.split(".").slice(1).join("."),
          registrationUsd: null,
          renewalUsd: null,
          buyUrl: null,
          error: err instanceof Error ? err.message : "lookup_failed",
        };
      }
    }),
  );

  return ok({
    term,
    rows,
    hasBusinessPlan: hasBusiness,
    // FX rate for THB display. Pulled from a constant — Porkbun prices
    // are in USD and we just want a rough THB equivalent in the UI.
    usdToThb: 36.5,
  });
}
