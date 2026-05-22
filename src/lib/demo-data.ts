export interface DemoProduct {
  slug: string;
  name: string;
  price: number;
  compareAt?: number;
  image: string;
  badge?: "HOT" | "NEW" | "SALE";
  type: "physical" | "digital";
  sold: number;
  stock?: number;
}

export interface DemoShop {
  slug: string;
  name: string;
  description: string;
  logo: string;
  category: string;
  themeColor: string;
  verified: boolean;
  rating: number;
  productCount: number;
  totalSold: number;
  contact: { phone?: string; line?: string; facebook?: string };
  banners: string[];
  products: DemoProduct[];
}

export const DEMO_SHOPS: Record<string, DemoShop> = {
  "siam-snack": {
    slug: "siam-snack",
    name: "สยามสแน็ค",
    description:
      "ขนมไทยพรีเมียม วัตถุดิบสด รสชาติต้นตำรับ ส่งทั่วประเทศใน 1-3 วัน",
    logo: "ส",
    category: "อาหารและเครื่องดื่ม",
    themeColor: "#e11d48",
    verified: true,
    rating: 4.9,
    productCount: 6,
    totalSold: 1284,
    contact: { phone: "0812345678", line: "@siamsnack" },
    banners: [
      "linear-gradient(135deg,#fff1f2 0%,#fecdd3 100%)",
      "linear-gradient(135deg,#fef3c7 0%,#fde68a 100%)",
      "linear-gradient(135deg,#dcfce7 0%,#bbf7d0 100%)",
    ],
    products: [
      {
        slug: "thong-yip-set",
        name: "เซตทองหยิบทองหยอด 9 ชิ้น",
        price: 290,
        compareAt: 390,
        image:
          "linear-gradient(135deg,#fde047 0%,#facc15 50%,#eab308 100%)",
        badge: "HOT",
        type: "physical",
        sold: 423,
        stock: 28,
      },
      {
        slug: "khanom-mor-kaeng",
        name: "ขนมหม้อแกงเผือก",
        price: 159,
        image:
          "linear-gradient(135deg,#fcd34d 0%,#f59e0b 100%)",
        type: "physical",
        sold: 287,
        stock: 14,
      },
      {
        slug: "lod-chong-coconut",
        name: "ลอดช่องสิงคโปร์ กะทิสด",
        price: 89,
        compareAt: 120,
        image:
          "linear-gradient(135deg,#a7f3d0 0%,#34d399 100%)",
        badge: "SALE",
        type: "physical",
        sold: 198,
      },
      {
        slug: "tako-pandan",
        name: "ตะโก้ใบเตยกล่องไม้ 8 ถ้วย",
        price: 220,
        image:
          "linear-gradient(135deg,#bbf7d0 0%,#22c55e 100%)",
        badge: "NEW",
        type: "physical",
        sold: 156,
      },
      {
        slug: "khanom-chan",
        name: "ขนมชั้นพรีเมียม 5 สี",
        price: 180,
        image:
          "linear-gradient(135deg,#fbcfe8 0%,#ec4899 100%)",
        type: "physical",
        sold: 145,
      },
      {
        slug: "voucher-1000",
        name: "บัตรของขวัญ 1,000 บาท",
        price: 1000,
        image:
          "linear-gradient(135deg,#fda4af 0%,#e11d48 100%)",
        type: "digital",
        sold: 75,
      },
    ],
  },
};

export function getShopBySlug(slug: string): DemoShop | undefined {
  return DEMO_SHOPS[slug];
}

export function getProduct(shopSlug: string, productSlug: string) {
  const shop = getShopBySlug(shopSlug);
  if (!shop) return undefined;
  return shop.products.find((p) => p.slug === productSlug);
}
