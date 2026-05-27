import "server-only";

import { cache } from "react";
import { db, ProductStatus, ShopStatus } from "@/lib/db";
import { getProduct as getDemoProduct, getShopBySlug as getDemoShop } from "@/lib/demo-data";

export interface StorefrontProductView {
  product: {
    slug: string;
    name: string;
    description: string | null;
    priceBaht: number;
    compareAtBaht: number | null;
    imageUrls: string[];
    badge: "HOT" | "NEW" | "SALE" | null;
    type: "PHYSICAL" | "DIGITAL";
    stock: number | null;
    sold: number;
    /** V2.1 per-product shipping fee in baht. 0 = free shipping. */
    shippingFeeBaht: number;
    updatedAtMs: number;
  };
  shop: {
    slug: string;
    name: string;
    logoText: string | null;
    logoUrl: string | null;
    themeColor: string;
    verified: boolean;
  };
}

export const getStorefrontProductView = cache(
  async (
    slug: string,
    productSlug: string,
  ): Promise<StorefrontProductView | null> => {
    const shop = await db.shop.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        name: true,
        logoText: true,
        logoUrl: true,
        themeColor: true,
        verified: true,
        status: true,
      },
    });

    if (shop && shop.status === ShopStatus.ACTIVE) {
      const p = await db.product.findUnique({
        where: { shopId_slug: { shopId: shop.id, slug: productSlug } },
      });

      if (p && p.status !== ProductStatus.HIDDEN) {
        return {
          product: {
            slug: p.slug,
            name: p.name,
            description: p.description,
            priceBaht: Math.round(p.priceSatang / 100),
            compareAtBaht: p.compareAtSatang
              ? Math.round(p.compareAtSatang / 100)
              : null,
            imageUrls: p.imageUrls,
            badge: p.badge,
            type: p.type as "PHYSICAL" | "DIGITAL",
            stock: p.stock,
            sold: p.sold,
            shippingFeeBaht: Math.round((p.shippingFeeSatang ?? 0) / 100),
            updatedAtMs: p.updatedAt.getTime(),
          },
          shop: {
            slug: shop.slug,
            name: shop.name,
            logoText: shop.logoText,
            logoUrl: shop.logoUrl,
            themeColor: shop.themeColor,
            verified: shop.verified,
          },
        };
      }
    }

    const demoShop = getDemoShop(slug);
    const demoProduct = getDemoProduct(slug, productSlug);
    if (!demoShop || !demoProduct) {
      return null;
    }

    return {
      product: {
        slug: demoProduct.slug,
        name: demoProduct.name,
        description: null,
        priceBaht: demoProduct.price,
        compareAtBaht: demoProduct.compareAt ?? null,
        imageUrls: [],
        badge: (demoProduct.badge ?? null) as "HOT" | "NEW" | "SALE" | null,
        type: demoProduct.type === "digital" ? "DIGITAL" : "PHYSICAL",
        stock: demoProduct.stock ?? null,
        sold: demoProduct.sold,
        shippingFeeBaht: 0,
        updatedAtMs: 0,
      },
      shop: {
        slug: demoShop.slug,
        name: demoShop.name,
        logoText: demoShop.logo,
        logoUrl: null,
        themeColor: demoShop.themeColor,
        verified: demoShop.verified,
      },
    };
  },
);
