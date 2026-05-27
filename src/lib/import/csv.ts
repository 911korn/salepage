import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { ImportSource, ImportedProduct } from "./types";
import { priceToSatang, parseStock, splitImageUrls, tempIdFor } from "./util";

/**
 * Multi-format CSV/XLSX importer.
 *
 * Auto-detection runs in order: Shopee TH export → Lazada TH export →
 * "generic" by header-name fuzzy match (English + Thai). The user can
 * always override the column mapping in the dashboard preview if our
 * detection guesses wrong.
 */
export type CsvRow = Record<string, unknown>;

export interface ParseResult {
  source: ImportSource;
  detected: "shopee" | "lazada" | "generic";
  rows: CsvRow[];
  /** Column → semantic field, what we picked. The dashboard surfaces this
   *  in the preview UI as a "verify these columns are right" panel. */
  mapping: ColumnMap;
  warnings: string[];
}

export interface ColumnMap {
  name: string | null;
  description: string | null;
  price: string | null;
  compareAtPrice: string | null;
  stock: string | null;
  images: string | null;
  shippingFee: string | null;
}

const SHOPEE_SIGNATURE = [
  "ชื่อสินค้า",
  "รหัสสินค้า",
  "ราคา",
  "คลังสินค้า",
];

const LAZADA_SIGNATURE = [
  "Product Name",
  "Product SKU",
  "Selling Price",
  "Quantity",
];

export function parseSpreadsheetText(text: string): CsvRow[] {
  const out = Papa.parse<CsvRow>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  return out.data.filter((r) => Object.values(r).some((v) => v != null && String(v).trim() !== ""));
}

export function parseSpreadsheetBuffer(buf: Buffer | ArrayBuffer): CsvRow[] {
  const wb = XLSX.read(buf, { type: "array" });
  const firstSheet = wb.SheetNames[0];
  if (!firstSheet) return [];
  const sheet = wb.Sheets[firstSheet]!;
  return XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false }) as CsvRow[];
}

export function detectFormat(rows: CsvRow[]): ParseResult["detected"] {
  if (!rows.length) return "generic";
  const headers = Object.keys(rows[0]!);
  const hasAll = (sig: string[]) =>
    sig.every((s) => headers.some((h) => h.toLowerCase().includes(s.toLowerCase())));
  if (hasAll(SHOPEE_SIGNATURE)) return "shopee";
  if (hasAll(LAZADA_SIGNATURE)) return "lazada";
  return "generic";
}

/**
 * Suggest a column mapping based on header names. The dashboard lets the
 * user override per-field via a Select dropdown, so this just needs to be
 * "good enough most of the time" — defaults derive from real Shopee and
 * Lazada export templates.
 */
export function suggestMapping(rows: CsvRow[]): ColumnMap {
  if (!rows.length) return emptyMap();
  const headers = Object.keys(rows[0]!);
  const find = (...needles: string[]): string | null =>
    headers.find((h) => needles.some((n) => h.toLowerCase().includes(n.toLowerCase()))) ?? null;
  return {
    name: find("ชื่อสินค้า", "product name", "name", "title"),
    description: find("รายละเอียดสินค้า", "description", "desc"),
    price: find("ราคา", "selling price", "price"),
    compareAtPrice: find("ราคาเดิม", "original price", "compare", "msrp"),
    stock: find("คลังสินค้า", "stock", "quantity", "qty"),
    images:
      find("รูปภาพปก", "ลิงก์รูปภาพ", "image url", "image", "photo") ?? null,
    shippingFee: find("ค่าจัดส่ง", "ค่าส่ง", "shipping fee", "shipping"),
  };
}

function emptyMap(): ColumnMap {
  return {
    name: null,
    description: null,
    price: null,
    compareAtPrice: null,
    stock: null,
    images: null,
    shippingFee: null,
  };
}

export function parseSpreadsheet(input: string | Buffer): ParseResult {
  const rows =
    typeof input === "string"
      ? parseSpreadsheetText(input)
      : parseSpreadsheetBuffer(input);
  const detected = detectFormat(rows);
  const mapping = suggestMapping(rows);
  const source: ImportSource =
    detected === "shopee"
      ? "csv-shopee"
      : detected === "lazada"
        ? "csv-lazada"
        : "csv-generic";
  const warnings: string[] = [];
  if (!mapping.name) warnings.push("หาคอลัมน์ชื่อสินค้าไม่เจอ — โปรดเลือกเอง");
  if (!mapping.price) warnings.push("หาคอลัมน์ราคาไม่เจอ — โปรดเลือกเอง");
  return { source, detected, rows, mapping, warnings };
}

/**
 * Apply a column mapping to a list of raw rows, producing ImportedProduct
 * rows ready for preview/commit. Each row carries its own warnings so the
 * UI can highlight the broken ones without rejecting the whole batch.
 */
export function rowsToProducts(
  rows: CsvRow[],
  mapping: ColumnMap,
  source: ImportSource,
): ImportedProduct[] {
  return rows.map((row, idx) => {
    const get = (key: string | null): string => {
      if (!key) return "";
      const v = row[key];
      return v == null ? "" : String(v);
    };
    const name = get(mapping.name).trim();
    const description = get(mapping.description).trim() || null;
    const priceRaw = get(mapping.price);
    const compareRaw = get(mapping.compareAtPrice);
    const stockRaw = get(mapping.stock);
    const imagesRaw = get(mapping.images);
    const shippingRaw = get(mapping.shippingFee);

    const priceSatang = priceToSatang(priceRaw);
    const compareAtSatang = compareRaw ? priceToSatang(compareRaw) : null;
    const stock = stockRaw ? parseStock(stockRaw) : null;
    const imageUrls = splitImageUrls(imagesRaw);
    const shippingFeeSatang = shippingRaw ? priceToSatang(shippingRaw) : 0;

    const warnings: string[] = [];
    if (!name) warnings.push(`แถวที่ ${idx + 1}: ไม่มีชื่อสินค้า`);
    if (priceSatang === 0) warnings.push(`แถวที่ ${idx + 1}: ราคาเป็น 0`);
    if (imageUrls.length === 0) warnings.push(`แถวที่ ${idx + 1}: ไม่มีรูป`);

    return {
      tempId: tempIdFor(`csv-${idx}-${name}`),
      name: name || `Imported row ${idx + 1}`,
      description,
      priceSatang,
      compareAtSatang: compareAtSatang && compareAtSatang > priceSatang ? compareAtSatang : null,
      shippingFeeSatang,
      imageUrls,
      stock,
      type: "PHYSICAL",
      source,
      sourceUrl: null,
      warnings,
    };
  });
}
