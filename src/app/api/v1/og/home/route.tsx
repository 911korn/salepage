import { ImageResponse } from "next/og";

export const runtime = "edge";

const size = {
  width: 1200,
  height: 630,
};

const copy = {
  th: {
    headline: "ไม่เก็บ %",
    headlineAccent: "เงินเข้าตรงร้าน",
    sub: "ขายของผ่าน SalePage · ไม่หักค่าคอม · เงินถึงคุณตรง PromptPay",
    autoSlipTitle: "Auto Slip",
    autoSlipSub: "AI ตรวจสลิปอัตโนมัติใน 3 วินาที",
    statA: "0%",
    statALabel: "ค่าคอมมิชชั่น",
    statB: "3 วิ",
    statBLabel: "AI ตรวจสลิป",
    statC: "30 วิ",
    statCLabel: "เปิดร้านได้เลย",
    cta: "เปิดร้านฟรี",
    url: "salepage.in.th",
  },
  en: {
    headline: "0% Commission",
    headlineAccent: "Money lands direct",
    sub: "Sell on SalePage · keep 100% · paid straight to your PromptPay",
    autoSlipTitle: "Auto Slip",
    autoSlipSub: "AI verifies payment slips in 3 seconds",
    statA: "0%",
    statALabel: "commission",
    statB: "3s",
    statBLabel: "AI slip check",
    statC: "30s",
    statCLabel: "open a shop",
    cta: "Open shop free",
    url: "salepage.in.th",
  },
};

export function GET(request: Request) {
  const url = new URL(request.url);
  const locale = url.searchParams.get("locale") === "en" ? "en" : "th";
  const t = copy[locale];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "#ffffff",
          color: "#0a0a0a",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Soft brand wash */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(120deg, #fff1f2 0%, #ffffff 48%, #fff7ed 100%)",
          }}
        />
        {/* Decorative circles */}
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
            position: "absolute",
            left: -180,
            bottom: -180,
            width: 520,
            height: 520,
            borderRadius: 999,
            background: "#fed7aa",
            opacity: 0.4,
          }}
        />

        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            padding: "60px",
            gap: 48,
            position: "relative",
          }}
        >
          {/* LEFT — brand + giant headline + stats */}
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
              {/* Wordmark */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 18,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    width: 78,
                    height: 78,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 22,
                    background:
                      "linear-gradient(180deg, #f43f5e 0%, #be123c 100%)",
                    color: "white",
                    fontSize: 46,
                    fontWeight: 900,
                    boxShadow: "0 18px 42px rgba(225,29,72,0.30)",
                  }}
                >
                  S
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div
                    style={{
                      display: "flex",
                      fontSize: 38,
                      fontWeight: 900,
                      lineHeight: 1,
                      letterSpacing: -1,
                    }}
                  >
                    SalePage
                  </div>
                  <div
                    style={{
                      display: "flex",
                      marginTop: 8,
                      color: "#be123c",
                      fontSize: 22,
                      fontWeight: 700,
                    }}
                  >
                    {t.url}
                  </div>
                </div>
              </div>

              {/* Giant headline — the punchline */}
              <div
                style={{
                  display: "flex",
                  marginTop: 56,
                  fontSize: locale === "en" ? 110 : 132,
                  fontWeight: 900,
                  lineHeight: 0.96,
                  letterSpacing: -3,
                  color: "#09090b",
                }}
              >
                {t.headline}
              </div>
              {/* Accent line */}
              <div
                style={{
                  display: "flex",
                  marginTop: 16,
                  fontSize: locale === "en" ? 46 : 54,
                  fontWeight: 800,
                  lineHeight: 1.05,
                  color: "#be123c",
                  letterSpacing: -1,
                }}
              >
                {t.headlineAccent}
              </div>
              <div
                style={{
                  display: "flex",
                  marginTop: 18,
                  maxWidth: 620,
                  color: "#52525b",
                  fontSize: 24,
                  fontWeight: 500,
                  lineHeight: 1.42,
                }}
              >
                {t.sub}
              </div>
            </div>

            {/* Footer: CTA + stat trio */}
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: 70,
                  padding: "0 30px",
                  borderRadius: 999,
                  background: "#e11d48",
                  color: "white",
                  fontSize: 27,
                  fontWeight: 800,
                  boxShadow: "0 18px 40px rgba(225,29,72,0.26)",
                }}
              >
                {t.cta}
              </div>
              <Stat value={t.statA} label={t.statALabel} accent />
              <Stat value={t.statB} label={t.statBLabel} />
              <Stat value={t.statC} label={t.statCLabel} />
            </div>
          </div>

          {/* RIGHT — Auto Slip showpiece card */}
          <div
            style={{
              width: 396,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                borderRadius: 36,
                background: "white",
                border: "1px solid #fecdd3",
                boxShadow: "0 30px 90px rgba(15,23,42,0.18)",
                overflow: "hidden",
              }}
            >
              {/* Header band */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  padding: 28,
                  background:
                    "linear-gradient(135deg, #e11d48 0%, #fb7185 55%, #f97316 100%)",
                  color: "white",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                  }}
                >
                  {/* AI sparkle icon */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 54,
                      height: 54,
                      borderRadius: 16,
                      background: "rgba(255,255,255,0.22)",
                      color: "white",
                      fontSize: 32,
                      fontWeight: 900,
                    }}
                  >
                    ✦
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <div
                      style={{
                        display: "flex",
                        fontSize: 36,
                        fontWeight: 900,
                        lineHeight: 1,
                        letterSpacing: -0.5,
                      }}
                    >
                      {t.autoSlipTitle}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        marginTop: 6,
                        fontSize: 17,
                        fontWeight: 700,
                        opacity: 0.92,
                      }}
                    >
                      AI · 3s
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    marginTop: 18,
                    fontSize: 20,
                    fontWeight: 600,
                    lineHeight: 1.35,
                    opacity: 0.95,
                  }}
                >
                  {t.autoSlipSub}
                </div>
              </div>

              {/* Body — verification rows */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  padding: 28,
                  gap: 14,
                }}
              >
                <SlipRow label="PromptPay QR" status="ตรง" ok />
                <SlipRow label="ยอดโอน ฿1,290" status="ตรง" ok />
                <SlipRow label="ผู้รับโอน" status="ตรง" ok />
                <SlipRow label="วันที่ + เวลา" status="ตรง" ok />
                <div
                  style={{
                    display: "flex",
                    marginTop: 6,
                    height: 56,
                    borderRadius: 16,
                    background:
                      "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)",
                    border: "1px solid #a7f3d0",
                    color: "#047857",
                    fontSize: 22,
                    fontWeight: 800,
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                  }}
                >
                  ✓ ผ่านการตรวจสอบ
                </div>
              </div>
            </div>
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
          fontSize: 25,
          fontWeight: 900,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          display: "flex",
          marginTop: 6,
          color: "#71717a",
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function SlipRow({
  label,
  status,
  ok,
}: {
  label: string;
  status: string;
  ok?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          color: "#27272a",
          fontSize: 18,
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          color: ok ? "#047857" : "#dc2626",
          fontSize: 17,
          fontWeight: 800,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 22,
            height: 22,
            borderRadius: 999,
            background: ok ? "#10b981" : "#ef4444",
            color: "white",
            fontSize: 14,
            fontWeight: 900,
          }}
        >
          ✓
        </div>
        {status}
      </div>
    </div>
  );
}
