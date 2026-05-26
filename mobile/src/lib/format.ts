/**
 * Formatting helpers — keep parity with web at src/lib (baht display, etc.).
 *
 * Money is stored in **satang** everywhere. Convert to baht only at render.
 */

export function satangToBaht(satang: number | null | undefined): number {
  if (!satang) return 0;
  return Math.round(satang) / 100;
}

export function formatBaht(satang: number | null | undefined): string {
  const baht = satangToBaht(satang);
  return `฿${baht.toLocaleString("th-TH", {
    minimumFractionDigits: baht % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatBahtShort(satang: number | null | undefined): string {
  const baht = satangToBaht(satang);
  if (baht >= 1_000_000) return `฿${(baht / 1_000_000).toFixed(1)}M`;
  if (baht >= 1_000) return `฿${(baht / 1_000).toFixed(1)}k`;
  return `฿${baht.toLocaleString("th-TH")}`;
}

const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING: "รอชำระ",
  PAID: "ชำระแล้ว",
  SHIPPING: "กำลังจัดส่ง",
  DELIVERED: "จัดส่งสำเร็จ",
  CANCELLED: "ยกเลิก",
  REFUNDED: "คืนเงินแล้ว",
};

export function orderStatusLabel(status: string): string {
  return ORDER_STATUS_LABEL[status] ?? status;
}

export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "เมื่อสักครู่";
  if (minutes < 60) return `${minutes} นาทีก่อน`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ชม.ก่อน`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} วันก่อน`;
  return new Date(iso).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
