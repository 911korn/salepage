/**
 * Shared JSON-LD schema builders for SEO rich results.
 *
 * Returned objects are emitted via `<script type="application/ld+json">`
 * inline on the relevant pages. Google parses these and unlocks the
 * Product result (with price + rating), Store sitelinks, Organization
 * "knowledge panel" data, and sitelinks search box on the homepage.
 *
 * Keep these builders pure: no fetch, no `db` access — pass the data in.
 */

const SITE = "https://salepage.in.th";

export interface OrganizationSchemaInput {
  locale?: "th" | "en";
}

export function organizationSchema(_input: OrganizationSchemaInput = {}) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE}/#organization`,
    name: "SalePage",
    alternateName: "SalePage : ขายของไม่หัก %",
    url: SITE,
    logo: `${SITE}/icon-512.png`,
    sameAs: [
      // Add real social URLs here as they go live.
    ],
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: "ceo@911.co.th",
        availableLanguage: ["Thai", "English"],
      },
    ],
  };
}

export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE}/#website`,
    url: SITE,
    name: "SalePage",
    description:
      "เปิดร้านออนไลน์ฟรี ไม่หักค่าคอม รับเงินตรง PromptPay พร้อม AI ตรวจสลิปอัตโนมัติ",
    inLanguage: ["th", "en"],
    publisher: { "@id": `${SITE}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export interface StoreSchemaInput {
  slug: string;
  name: string;
  description?: string | null;
  logoUrl?: string | null;
  themeColor?: string | null;
  rating?: number;
  totalSold?: number;
  category?: string | null;
}

export function storeSchema(input: StoreSchemaInput) {
  const url = `${SITE}/${input.slug}`;
  const obj: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Store",
    "@id": `${url}#store`,
    name: input.name,
    url,
    image:
      input.logoUrl ||
      `${SITE}/api/v1/og/shop/${encodeURIComponent(input.slug)}`,
  };
  if (input.description) obj.description = input.description.slice(0, 500);
  if (input.category) obj.knowsAbout = input.category;
  // Aggregate rating only emits when there are *real* reviews — schema.org
  // requires reviewCount ≥ 1 + a meaningful rating. Skipping aggregate for
  // shops with totalSold=0 prevents Google Rich Results "rating too sparse"
  // flag warnings in Search Console.
  if (input.rating && input.rating > 0 && (input.totalSold ?? 0) > 0) {
    obj.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: input.rating.toFixed(1),
      ratingCount: input.totalSold,
      bestRating: 5,
      worstRating: 1,
    };
  }
  return obj;
}

export interface ProductSchemaInput {
  slug: string;
  productSlug: string;
  name: string;
  description?: string | null;
  imageUrls: string[];
  priceBaht: number;
  compareAtBaht?: number | null;
  inStock?: boolean;
  sold?: number;
  shopName: string;
  shopSlug: string;
  rating?: number;
  reviewCount?: number;
}

export function productSchema(input: ProductSchemaInput) {
  const productUrl = `${SITE}/${input.shopSlug}/${input.productSlug}`;
  const images = input.imageUrls.length > 0
    ? input.imageUrls
    : [`${SITE}/api/v1/og/product/${encodeURIComponent(input.shopSlug)}/${encodeURIComponent(input.productSlug)}`];

  const obj: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${productUrl}#product`,
    name: input.name,
    url: productUrl,
    image: images,
    sku: `${input.shopSlug}-${input.productSlug}`,
    brand: {
      "@type": "Brand",
      name: input.shopName,
    },
    offers: {
      "@type": "Offer",
      url: productUrl,
      priceCurrency: "THB",
      price: input.priceBaht,
      availability: input.inStock === false
        ? "https://schema.org/OutOfStock"
        : "https://schema.org/InStock",
      seller: {
        "@type": "Organization",
        name: input.shopName,
        url: `${SITE}/${input.shopSlug}`,
      },
    },
  };
  if (input.description) {
    obj.description = input.description.replace(/\s+/g, " ").trim().slice(0, 500);
  }
  if (input.rating && input.rating > 0 && (input.reviewCount ?? 0) > 0) {
    obj.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: input.rating.toFixed(1),
      ratingCount: input.reviewCount,
      bestRating: 5,
      worstRating: 1,
    };
  }
  return obj;
}

export interface ItemListInput {
  shopSlug: string;
  products: Array<{
    slug: string;
    name: string;
    priceBaht: number;
    imageUrl?: string | null;
  }>;
}

export function itemListSchema(input: ItemListInput) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: input.products.slice(0, 20).map((p, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      url: `${SITE}/${input.shopSlug}/${p.slug}`,
      name: p.name,
    })),
  };
}
