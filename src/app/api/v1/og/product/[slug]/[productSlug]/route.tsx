import { ImageResponse } from "next/og";
import { getStorefrontProductView } from "@/lib/storefront-product-view";
import { absoluteStorefrontUrl } from "@/lib/storefront-url";

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

function toAbsoluteUrl(url: string | null | undefined) {
  if (!url) return null;
  try {
    return new URL(url).toString();
  } catch {
    return new URL(url, "https://salepage.in.th").toString();
  }
}

function clampText(text: string, maxLength: number) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > maxLength ? `${clean.slice(0, maxLength - 1)}…` : clean;
}

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

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string; productSlug: string }> },
) {
  const { slug, productSlug } = await context.params;
  const view = await getStorefrontProductView(slug, productSlug);

  if (!view) {
    return new Response("not_found", { status: 404 });
  }

  const { product, shop } = view;
  const imageUrl = toAbsoluteUrl(product.imageUrls[0]);
  const shopLogoUrl = toAbsoluteUrl(shop.logoUrl);
  const productUrl = absoluteStorefrontUrl(shop.slug, product.slug);
  const description = product.description
    ? clampText(product.description, 86)
    : "สั่งซื้อง่าย จ่ายไว ติดตามออเดอร์ได้ทันที";
  const compareAt =
    product.compareAtBaht && product.compareAtBaht > product.priceBaht
      ? `ปกติ ฿${product.compareAtBaht.toLocaleString("th-TH")}`
      : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#fff7f8",
          color: "#111111",
          fontFamily: "Kanit, system-ui, sans-serif",
          padding: "48px",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(255,241,242,0.94) 46%, rgba(254,205,211,0.9) 100%)",
          }}
        />

        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            gap: "44px",
            position: "relative",
          }}
        >
          <div
            style={{
              width: 496,
              height: "100%",
              display: "flex",
              overflow: "hidden",
              border: "10px solid white",
              borderRadius: 44,
              background: imageUrl
                ? "#f4f4f5"
                : "linear-gradient(135deg, #ffe4e6, #fb7185)",
              boxShadow: "0 24px 70px rgba(15, 23, 42, 0.18)",
            }}
          >
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt=""
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            ) : (
              <div
                style={{
                  display: "flex",
                  width: "100%",
                  height: "100%",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontSize: 132,
                  fontWeight: 800,
                }}
              >
                {product.name.slice(0, 1)}
              </div>
            )}
          </div>

          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: "14px 0",
              minWidth: 0,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  color: "#52525b",
                  fontSize: 30,
                  fontWeight: 700,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    width: 58,
                    height: 58,
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    borderRadius: 18,
                    background: shop.themeColor,
                    color: "white",
                    fontSize: 28,
                    fontWeight: 800,
                  }}
                >
                  {shopLogoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={shopLogoUrl}
                      alt=""
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    shop.logoText ?? shop.name.slice(0, 1)
                  )}
                </div>
                <div style={{ display: "flex" }}>{clampText(shop.name, 28)}</div>
              </div>

              <div
                style={{
                  display: "flex",
                  marginTop: 34,
                  fontSize: 64,
                  fontWeight: 800,
                  lineHeight: 1.08,
                  letterSpacing: 0,
                  color: "#09090b",
                }}
              >
                {clampText(product.name, 52)}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  gap: 22,
                  marginTop: 26,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    color: "#be123c",
                    fontSize: 82,
                    fontWeight: 800,
                    lineHeight: 1,
                  }}
                >
                  ฿{product.priceBaht.toLocaleString("th-TH")}
                </div>
                {compareAt ? (
                  <div
                    style={{
                      display: "flex",
                      color: "#9ca3af",
                      fontSize: 30,
                      fontWeight: 700,
                      marginBottom: 10,
                    }}
                  >
                    {compareAt}
                  </div>
                ) : null}
              </div>

              <div
                style={{
                  display: "flex",
                  marginTop: 24,
                  color: "#3f3f46",
                  fontSize: 30,
                  lineHeight: 1.38,
                  fontWeight: 400,
                }}
              >
                {description}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  borderRadius: 999,
                  background: "#e11d48",
                  color: "white",
                  padding: "16px 26px",
                  fontSize: 26,
                  fontWeight: 800,
                  boxShadow: "0 16px 34px rgba(225, 29, 72, 0.24)",
                  whiteSpace: "nowrap",
                }}
              >
                สั่งซื้อบน SalePage
              </div>
              <div
                style={{
                  display: "flex",
                  color: "#71717a",
                  fontSize: 24,
                  fontWeight: 700,
                }}
              >
                {productUrl.replace("https://", "")}
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800",
      },
      fonts: await getKanitFonts(),
    },
  );
}
