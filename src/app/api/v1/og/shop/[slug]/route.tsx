import { ImageResponse } from "next/og";
import { db, ProductStatus } from "@/lib/db";
import { getShopBySlug as getDemoShop } from "@/lib/demo-data";

export const runtime = "nodejs";

const size = {
  width: 1200,
  height: 630,
};

const FONT_URLS = {
  regular: "https://fonts.gstatic.com/s/kanit/v17/nKKZ-Go6G5tXcoaS.ttf",
  bold: "https://fonts.gstatic.com/s/kanit/v17/nKKU-Go6G5tXcr4uPiWg.ttf",
  extraBold: "https://fonts.gstatic.com/s/kanit/v17/nKKU-Go6G5tXcr4yPSWg.ttf",
};

const fontPromises = {
  regular: fetch(FONT_URLS.regular).then((res) => res.arrayBuffer()),
  bold: fetch(FONT_URLS.bold).then((res) => res.arrayBuffer()),
  extraBold: fetch(FONT_URLS.extraBold).then((res) => res.arrayBuffer()),
};

async function getKanitFonts() {
  try {
    const [regular, bold, extraBold] = await Promise.all([
      fontPromises.regular,
      fontPromises.bold,
      fontPromises.extraBold,
    ]);
    return [
      { name: "Kanit", data: regular, weight: 400 as const, style: "normal" as const },
      { name: "Kanit", data: bold, weight: 700 as const, style: "normal" as const },
      { name: "Kanit", data: extraBold, weight: 800 as const, style: "normal" as const },
    ];
  } catch {
    return [];
  }
}

function clampText(text: string, maxLength: number) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > maxLength ? `${clean.slice(0, maxLength - 1)}…` : clean;
}

function toAbsoluteUrl(url: string | null | undefined) {
  if (!url) return null;
  try {
    return new URL(url).toString();
  } catch {
    return new URL(url, "https://salepage.in.th").toString();
  }
}

interface ShopOGView {
  slug: string;
  name: string;
  description: string | null;
  logoText: string;
  logoUrl: string | null;
  themeColor: string;
  verified: boolean;
  rating: number;
  totalSold: number;
  productCount: number;
  productThumbs: Array<string | null>;
}

async function loadShopOG(slug: string): Promise<ShopOGView | null> {
  const dbShop = await db.shop.findUnique({
    where: { slug },
    select: {
      slug: true,
      name: true,
      description: true,
      logoText: true,
      logoUrl: true,
      themeColor: true,
      verified: true,
      rating: true,
      totalSold: true,
      status: true,
      suspended: true,
      _count: {
        select: {
          products: { where: { status: { not: ProductStatus.HIDDEN } } },
        },
      },
      products: {
        where: { status: { not: ProductStatus.HIDDEN } },
        orderBy: [{ sold: "desc" }, { createdAt: "desc" }],
        take: 4,
        select: { imageUrls: true },
      },
    },
  });

  if (dbShop && dbShop.status === "ACTIVE" && !dbShop.suspended) {
    return {
      slug: dbShop.slug,
      name: dbShop.name,
      description: dbShop.description ?? null,
      logoText: dbShop.logoText ?? dbShop.name.slice(0, 1).toUpperCase(),
      logoUrl: dbShop.logoUrl,
      themeColor: dbShop.themeColor,
      verified: dbShop.verified,
      rating: dbShop.rating ?? 0,
      totalSold: dbShop.totalSold ?? 0,
      productCount: dbShop._count.products,
      productThumbs: dbShop.products.map((p) => p.imageUrls?.[0] ?? null),
    };
  }

  // Demo data fallback (mirrors the storefront page).
  const demo = getDemoShop(slug);
  if (!demo) return null;
  return {
    slug: demo.slug,
    name: demo.name,
    description: demo.description,
    logoText: demo.logo,
    logoUrl: null,
    themeColor: demo.themeColor,
    verified: demo.verified,
    rating: demo.rating,
    totalSold: demo.totalSold,
    productCount: demo.products.length,
    productThumbs: demo.products.slice(0, 4).map(() => null),
  };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const view = await loadShopOG(slug);

  if (!view) {
    return new Response("not_found", { status: 404 });
  }

  const logoUrl = toAbsoluteUrl(view.logoUrl);
  const description = view.description
    ? clampText(view.description, 96)
    : `เลือกซื้อสินค้าจาก ${view.name} บน SalePage · จ่ายตรง PromptPay · AI ตรวจสลิปอัตโนมัติ`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#ffffff",
          color: "#0a0a0a",
          fontFamily: "Kanit, system-ui, sans-serif",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(120deg, #fff1f2 0%, #ffffff 48%, #fff7ed 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: -160,
            top: -160,
            width: 480,
            height: 480,
            borderRadius: 999,
            background: "#fecdd3",
            opacity: 0.55,
          }}
        />

        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            padding: 56,
            gap: 40,
            position: "relative",
          }}
        >
          {/* LEFT — identity + headline */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              minWidth: 0,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              {/* SalePage wordmark */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    width: 46,
                    height: 46,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 13,
                    background:
                      "linear-gradient(180deg, #f43f5e 0%, #be123c 100%)",
                    color: "white",
                    fontSize: 28,
                    fontWeight: 900,
                  }}
                >
                  S
                </div>
                <div
                  style={{
                    display: "flex",
                    fontSize: 23,
                    fontWeight: 800,
                    color: "#be123c",
                    letterSpacing: -0.5,
                  }}
                >
                  salepage.in.th
                </div>
              </div>

              {/* Shop card */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 24,
                  marginTop: 38,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    width: 130,
                    height: 130,
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    borderRadius: 32,
                    background: view.themeColor || "#e11d48",
                    color: "white",
                    fontSize: 72,
                    fontWeight: 900,
                    boxShadow: "0 18px 42px rgba(15,23,42,0.18)",
                  }}
                >
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logoUrl}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    view.logoText
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        fontSize: 56,
                        fontWeight: 900,
                        lineHeight: 1.05,
                        letterSpacing: -1.5,
                        color: "#09090b",
                      }}
                    >
                      {clampText(view.name, 18)}
                    </div>
                    {view.verified ? (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 36,
                          height: 36,
                          borderRadius: 999,
                          background: "#e11d48",
                          color: "white",
                          fontSize: 22,
                          fontWeight: 900,
                        }}
                      >
                        ✓
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Description */}
              <div
                style={{
                  display: "flex",
                  marginTop: 26,
                  maxWidth: 620,
                  color: "#3f3f46",
                  fontSize: 26,
                  fontWeight: 500,
                  lineHeight: 1.42,
                }}
              >
                {description}
              </div>
            </div>

            {/* Stat trio */}
            <div style={{ display: "flex", gap: 12 }}>
              <Stat value={`${view.productCount}`} label="สินค้า" />
              {view.rating > 0 ? (
                <Stat value={`★ ${view.rating.toFixed(1)}`} label="คะแนน" accent />
              ) : null}
              {view.totalSold > 0 ? (
                <Stat
                  value={`${view.totalSold.toLocaleString("th-TH")}+`}
                  label="ขายแล้ว"
                />
              ) : null}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: 70,
                  padding: "0 28px",
                  borderRadius: 999,
                  background: "#e11d48",
                  color: "white",
                  fontSize: 24,
                  fontWeight: 800,
                  boxShadow: "0 18px 38px rgba(225,29,72,0.26)",
                }}
              >
                เปิดร้าน
              </div>
            </div>
          </div>

          {/* RIGHT — product thumbnail grid */}
          <div
            style={{
              width: 380,
              display: "flex",
              flexWrap: "wrap",
              gap: 14,
              alignContent: "center",
            }}
          >
            {view.productThumbs.length > 0
              ? view.productThumbs.map((thumb, idx) => {
                  const absThumb = toAbsoluteUrl(thumb);
                  return (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        width: 183,
                        height: 183,
                        borderRadius: 24,
                        overflow: "hidden",
                        background: absThumb
                          ? "#f4f4f5"
                          : "linear-gradient(135deg, #fff1f2, #fda4af)",
                        border: "4px solid white",
                        boxShadow: "0 18px 38px rgba(15,23,42,0.12)",
                      }}
                    >
                      {absThumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={absThumb}
                          alt=""
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      ) : null}
                    </div>
                  );
                })
              : null}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      headers: {
        "Cache-Control":
          "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800",
      },
      fonts: await getKanitFonts(),
    },
  );
}

function Stat({
  value,
  label,
  accent,
}: {
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        height: 70,
        padding: "0 20px",
        borderRadius: 22,
        background: accent ? "#fff1f2" : "white",
        border: accent ? "1px solid #fda4af" : "1px solid #e4e4e7",
      }}
    >
      <div
        style={{
          display: "flex",
          color: accent ? "#be123c" : "#09090b",
          fontSize: 24,
          fontWeight: 900,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          display: "flex",
          marginTop: 5,
          color: "#71717a",
          fontSize: 14,
          fontWeight: 700,
        }}
      >
        {label}
      </div>
    </div>
  );
}
