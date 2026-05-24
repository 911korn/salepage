import { createHash } from "crypto";

export function normalizeCustomerPhone(value: string | null | undefined) {
  const digits = (value ?? "").replace(/[^\d]/g, "");
  if (digits.startsWith("66") && digits.length === 11) {
    return `0${digits.slice(2)}`;
  }
  return digits;
}

export function normalizeAddress(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function makeAddressKey(address: string) {
  return createHash("sha256")
    .update(normalizeAddress(address).toLowerCase())
    .digest("hex")
    .slice(0, 40);
}

export function extractThaiPostcode(address: string) {
  return normalizeAddress(address).match(/\b\d{5}\b/)?.[0] ?? null;
}

export function makeAddressLabel(address: string) {
  const clean = normalizeAddress(address).replace(/\s+/g, " ");
  if (clean.length <= 48) return clean;
  return `${clean.slice(0, 45).trim()}...`;
}
