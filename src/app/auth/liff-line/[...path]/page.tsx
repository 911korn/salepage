import { headers } from "next/headers";
import { getPlatformLineLiffId } from "@/lib/line";
import { LIFF_RETURN_PARAM } from "@/lib/liff-url";
import { LiffDeepLinkRedirectPage } from "../_render";

export const dynamic = "force-dynamic";

/**
 * /auth/liff-line/[...path]
 *
 * Catch-all that fires when LIFF rewrites a deep-link URL like
 *   https://liff.line.me/<LIFF_ID>/s/911shop/p-a4cpdws3
 * into
 *   https://salepage.in.th/auth/liff-line/s/911shop/p-a4cpdws3
 * because the LIFF endpoint URL is `/auth/liff-line`. The path segments
 * after `liff-line/` ARE the original target — LIFF appends them verbatim.
 * We rebuild the target URL, slap the `sp_liff=1` marker on, and render
 * the same LIFF init + redirect view the `?liff.state=...` branch uses.
 *
 * 911korn 2026-05-27 video at 04:40: tapping a product link in LINE
 * chat landed here and 404'd because the previous build only handled
 * `liff.state` query encoding, not the path-suffix form. LIFF actually
 * uses the path-suffix form when the LIFF URL itself had a path
 * component, so the catch-all is what makes that flow work.
 */
export default async function LiffLinePathCatchallPage({
  params,
  searchParams,
}: {
  params: Promise<{ path: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { path } = await params;
  const sp = await searchParams;

  const liffId = getPlatformLineLiffId();
  if (!liffId) {
    return (
      <html lang="en">
        <body
          style={{
            fontFamily: "system-ui, sans-serif",
            padding: 32,
            textAlign: "center",
          }}
        >
          <p>LIFF not configured on this deployment.</p>
        </body>
      </html>
    );
  }

  // Reconstruct the original URL from the segments after /auth/liff-line/.
  // Forward query params verbatim — LIFF normally appends `?liff.state=...`
  // alongside the path, so we strip that one (it only made sense on the
  // /auth/liff-line root) and keep anything else (`?ref=<userId>`, etc.).
  const origin = await getBaseOrigin();
  const targetPath = "/" + path.map(encodeURIComponent).join("/");
  const target = new URL(targetPath, origin);

  for (const [key, value] of Object.entries(sp)) {
    if (key === "liff.state") continue; // LIFF-internal; not meant for the app
    if (key === LIFF_RETURN_PARAM) continue; // we'll set this fresh below
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) target.searchParams.append(key, v);
    } else {
      target.searchParams.set(key, value);
    }
  }
  target.searchParams.set(LIFF_RETURN_PARAM, "1");

  return (
    <LiffDeepLinkRedirectPage liffId={liffId} targetHref={target.toString()} />
  );
}

async function getBaseOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "salepage.in.th";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}
