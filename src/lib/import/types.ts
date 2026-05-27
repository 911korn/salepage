/**
 * Shared shape for every importer (CSV row, Shopee URL, Lazada URL, JSON-LD).
 *
 * Importers normalize to this shape so the dashboard preview + commit flow
 * doesn't care where the data came from. `sourceUrl` + `sourcePlatform` get
 * stamped into the Product row's metadata so we can debug + dedupe later.
 */
export type ImportSource =
  | "csv-shopee"
  | "csv-lazada"
  | "csv-generic"
  | "url-shopee"
  | "url-lazada"
  | "url-tiktok"
  | "url-jsonld";

export interface ImportedProduct {
  /** Stable identifier for the preview UI (slugified name + hash). */
  tempId: string;
  /** Detected name. Required to commit. */
  name: string;
  description: string | null;
  /** Price in satang. */
  priceSatang: number;
  /** "Compare at" / original price for sale markups. */
  compareAtSatang: number | null;
  /** Per-product shipping fee in satang. 0 = free. */
  shippingFeeSatang: number;
  /** Absolute image URLs (Shopee/Lazada CDN, or HTTPS from a JSON-LD). */
  imageUrls: string[];
  stock: number | null;
  /** "PHYSICAL" vs "DIGITAL". Default PHYSICAL. */
  type: "PHYSICAL" | "DIGITAL";
  /** Where this row came from — stamped on the Product on commit. */
  source: ImportSource;
  sourceUrl: string | null;
  /** Per-row issues surfaced in the preview UI. */
  warnings: string[];
}

export interface ImportError {
  /** Row index in CSV, or the URL we tried to fetch. */
  ref: string;
  reason: string;
}
