/**
 * Platform-wide product categories. Mirrors the keys in
 * `src/messages/{th,en}.json` `categories` block. Mobile uses the
 * Thai labels inline so we don't need a full i18n pass on the
 * seller-side form. Web reads from next-intl.
 */
export const PRODUCT_CATEGORIES = [
  { key: "fashion", labelTh: "แฟชั่น" },
  { key: "food", labelTh: "อาหารและเครื่องดื่ม" },
  { key: "tech", labelTh: "อุปกรณ์ไอที" },
  { key: "beauty", labelTh: "เครื่องสำอาง" },
  { key: "health", labelTh: "สุขภาพ" },
  { key: "furniture", labelTh: "เฟอร์นิเจอร์" },
  { key: "pets", labelTh: "สัตว์เลี้ยง" },
  { key: "books", labelTh: "หนังสือ" },
  { key: "sport", labelTh: "กีฬา" },
  { key: "other", labelTh: "อื่นๆ" },
] as const;

export type CategoryKey = (typeof PRODUCT_CATEGORIES)[number]["key"];

export function categoryLabel(key: string | null | undefined): string | null {
  if (!key) return null;
  return (
    PRODUCT_CATEGORIES.find((c) => c.key === key)?.labelTh ?? key
  );
}
