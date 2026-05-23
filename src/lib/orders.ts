import { randomBytes } from "node:crypto";

/**
 * Public, URL-safe order token a customer can use to track / pay for an order
 * without authenticating. Stored on `Order.publicToken`.
 *
 * Format: 16 random bytes encoded as base64url (~22 chars).
 * Unguessable in practice and shorter than UUIDs.
 */
export function generateOrderToken(): string {
  return randomBytes(16).toString("base64url");
}

/**
 * Display-friendly order reference shown to the customer (e.g. "#A2391").
 * Built from the order's createdAt timestamp + a short random suffix so it's
 * monotonic-ish per day but uncoupled from the public token.
 */
export function buildOrderRef(date: Date, idSuffix: string): string {
  const ymd = [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("");
  return `#${ymd}-${idSuffix.toUpperCase().slice(-5)}`;
}
