import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/dashboard/",
          "/o/", // Order tracking pages are token-gated; no value in indexing
          "/billing/",
          "/signin",
          "/signin/check-email",
        ],
      },
    ],
    sitemap: "https://salepage.in.th/sitemap.xml",
    host: "https://salepage.in.th",
  };
}
