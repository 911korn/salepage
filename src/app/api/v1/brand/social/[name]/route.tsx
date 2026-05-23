import { ImageResponse } from "next/og";

export const runtime = "edge";

interface Preset {
  width: number;
  height: number;
  title: string;
  subtitle: string;
}

// Sizes pulled from each platform's current spec sheet (2026). All include
// extra height/width vs the safe area so the design survives crops.
const PRESETS: Record<string, Preset> = {
  "profile-square": {
    width: 1024,
    height: 1024,
    title: "SalePage",
    subtitle: "salepage.in.th",
  },
  "line-square": {
    width: 1024,
    height: 1024,
    title: "SalePage",
    subtitle: "เปิดร้านฟรี 30 วินาที",
  },
  "fb-cover": {
    width: 1640,
    height: 624,
    title: "เปิดร้านออนไลน์ใน 30 วินาที",
    subtitle: "PromptPay · AI ตรวจสลิป · ไม่มีค่าคอม · salepage.in.th",
  },
  "x-header": {
    width: 1500,
    height: 500,
    title: "SalePage",
    subtitle: "เปิดร้านออนไลน์ใน 30 วินาที · PromptPay + AI ตรวจสลิป",
  },
  "linkedin-banner": {
    width: 1584,
    height: 396,
    title: "SalePage",
    subtitle: "Thai-first e-commerce SaaS · salepage.in.th",
  },
  "youtube-art": {
    width: 2560,
    height: 1440,
    title: "SalePage",
    subtitle: "เปิดร้านออนไลน์ใน 30 วินาที — รับเงินตรง PromptPay",
  },
};

export async function GET(
  request: Request,
  context: { params: Promise<{ name: string }> },
) {
  const { name } = await context.params;
  const cleanName = name.replace(/\.png$/, "");
  const preset = PRESETS[cleanName];
  if (!preset) {
    return new Response("not_found", { status: 404 });
  }

  // ?download=1 → force the browser to save as a file rather than open inline
  const url = new URL(request.url);
  const wantsDownload = url.searchParams.get("download") === "1";

  const { width, height, title, subtitle } = preset;
  const isSquare = width === height;
  const isShort = height / width < 0.4;

  const titleSize = isSquare ? 120 : isShort ? 96 : 132;
  const subtitleSize = isSquare ? 36 : isShort ? 38 : 44;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background:
            "linear-gradient(135deg, #fff1f2 0%, #fecdd3 35%, #fda4af 70%, #e11d48 100%)",
          color: "#1f0a12",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
          padding: isShort ? "60px" : "120px",
        }}
      >
        {/* Folded-sale-tag mark — simplified for ImageResponse limits */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
            marginBottom: isShort ? "16px" : "28px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: isSquare ? 156 : 96,
              height: isSquare ? 156 : 96,
              background: "#e11d48",
              borderRadius: isSquare ? 36 : 22,
              color: "white",
              fontSize: isSquare ? 96 : 60,
              fontWeight: 800,
              boxShadow: "0 12px 40px rgba(225,29,72,0.35)",
            }}
          >
            S
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: titleSize,
            fontWeight: 800,
            letterSpacing: -2,
            color: "#1f0a12",
            textAlign: "center",
            lineHeight: 1.05,
          }}
        >
          {title}
        </div>

        <div
          style={{
            display: "flex",
            fontSize: subtitleSize,
            color: "#7f1d33",
            marginTop: isShort ? 12 : 24,
            textAlign: "center",
            lineHeight: 1.3,
            maxWidth: width * 0.85,
          }}
        >
          {subtitle}
        </div>

        {/* Decorative dots */}
        <div
          style={{
            position: "absolute",
            top: 32,
            right: 32,
            display: "flex",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: 999,
              background: "#e11d48",
              opacity: 0.7,
            }}
          />
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: 999,
              background: "#fb7185",
              opacity: 0.7,
            }}
          />
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: 999,
              background: "#fda4af",
              opacity: 0.7,
            }}
          />
        </div>
      </div>
    ),
    {
      width,
      height,
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
        ...(wantsDownload
          ? {
              "Content-Disposition": `attachment; filename="salepage-${cleanName}.png"`,
            }
          : {}),
      },
    },
  );
}
