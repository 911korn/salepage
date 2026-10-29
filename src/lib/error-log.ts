/**
 * Self-hosted error log (replaces Sentry). Distinct errors are grouped by a
 * fingerprint of source + normalized message + top stack frame; repeats only
 * bump `count` / `lastSeenAt`. Surfaced at /admin/errors.
 *
 * Never throws: logging an error must not cause another one.
 */
import { db } from "@/lib/db";

export type ErrorSource = "server" | "client";

export interface ErrorReport {
  source: ErrorSource;
  message: string;
  stack?: string | null;
  path?: string | null;
  userAgent?: string | null;
}

// Cap on brand-new fingerprints per hour so a flood of unique junk (or a
// spammed public endpoint) can't grow the table without bound. Repeats of
// known errors are always counted.
const MAX_NEW_PER_HOUR = 200;

const cut = (s: string | null | undefined, n: number) =>
  s ? s.slice(0, n) : null;

/** Strip the parts that vary between occurrences of the same bug. */
function normalize(message: string): string {
  return message
    .replace(/https?:\/\/\S+/g, "<url>")
    .replace(/\b[0-9a-f]{8,}\b/gi, "<id>")
    .replace(/\bc[a-z0-9]{20,}\b/g, "<id>")
    .replace(/\d+/g, "<n>")
    .trim();
}

function topFrame(stack: string | null | undefined): string {
  const line = stack
    ?.split("\n")
    .map((l) => l.trim())
    .find((l) => l.startsWith("at ") || l.includes("@"));
  return line ? line.replace(/:\d+:\d+\)?$/, "") : "";
}

async function sha1(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-1",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(buf), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

export async function recordError(report: ErrorReport): Promise<void> {
  try {
    const message = cut(report.message, 1000) || "(no message)";
    const stack = cut(report.stack, 6000);
    const fingerprint = await sha1(
      `${report.source}|${normalize(message)}|${topFrame(stack)}`,
    );
    const now = new Date();

    const updated = await db.errorEvent.updateMany({
      where: { fingerprint },
      data: {
        count: { increment: 1 },
        lastSeenAt: now,
        path: cut(report.path, 500),
        userAgent: cut(report.userAgent, 300),
      },
    });
    if (updated.count > 0) return;

    const recentNew = await db.errorEvent.count({
      where: { firstSeenAt: { gte: new Date(now.getTime() - 3_600_000) } },
    });
    if (recentNew >= MAX_NEW_PER_HOUR) return;

    await db.errorEvent.upsert({
      where: { fingerprint },
      create: {
        fingerprint,
        source: report.source,
        message,
        stack,
        path: cut(report.path, 500),
        userAgent: cut(report.userAgent, 300),
      },
      update: { count: { increment: 1 }, lastSeenAt: now },
    });
  } catch (e) {
    console.error("[error-log] failed to record error:", e);
  }
}
