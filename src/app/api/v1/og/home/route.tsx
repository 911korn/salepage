import { ImageResponse } from "next/og";

export const runtime = "edge";

const size = {
  width: 1200,
  height: 630,
};

const copy = {
  th: {
    title: "เปิดร้านออนไลน์ใน 30 วินาที",
    subtitle: "รับเงินตรง PromptPay พร้อม AI ตรวจสลิปอัตโนมัติ",
    cta: "สร้างร้านฟรี",
    url: "salepage.in.th",
    stat1: "0%",
    stat1Label: "ค่าคอม",
    stat2: "1 นาที",
    stat2Label: "โอน-ตรวจ-ยืนยัน",
    product: "ข้าวตัง สูตรโบราณ",
    paid: "รับชำระแล้ว",
  },
  en: {
    title: "Launch your online store in 30 seconds",
    subtitle: "Direct PromptPay payments with built-in AI slip verification",
    cta: "Start free",
    url: "salepage.in.th",
    stat1: "0%",
    stat1Label: "commission",
    stat2: "1 min",
    stat2Label: "pay-verify-confirm",
    product: "Classic Thai Snack",
    paid: "Payment verified",
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
          background: "#fff7f8",
          color: "#111111",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(135deg, #fff7f8 0%, #ffffff 42%, #ffe4e6 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: -120,
            top: -120,
            width: 420,
            height: 420,
            borderRadius: 999,
            background: "#fecdd3",
            opacity: 0.52,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: -150,
            bottom: -160,
            width: 470,
            height: 470,
            borderRadius: 999,
            background: "#bbf7d0",
            opacity: 0.45,
          }}
        />

        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            padding: "58px",
            gap: 48,
            position: "relative",
          }}
        >
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
                    width: 76,
                    height: 76,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 22,
                    background: "#e11d48",
                    color: "white",
                    fontSize: 44,
                    fontWeight: 800,
                    boxShadow: "0 18px 42px rgba(225,29,72,0.28)",
                  }}
                >
                  S
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      fontSize: 36,
                      fontWeight: 800,
                      lineHeight: 1,
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

              <div
                style={{
                  display: "flex",
                  marginTop: 54,
                  maxWidth: 610,
                  fontSize: locale === "en" ? 67 : 72,
                  fontWeight: 800,
                  lineHeight: 1.08,
                  letterSpacing: 0,
                  color: "#09090b",
                }}
              >
                {t.title}
              </div>
              <div
                style={{
                  display: "flex",
                  marginTop: 22,
                  maxWidth: 650,
                  color: "#52525b",
                  fontSize: 31,
                  fontWeight: 600,
                  lineHeight: 1.38,
                }}
              >
                {t.subtitle}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: 66,
                  padding: "0 30px",
                  borderRadius: 999,
                  background: "#e11d48",
                  color: "white",
                  fontSize: 27,
                  fontWeight: 800,
                  boxShadow: "0 18px 40px rgba(225,29,72,0.24)",
                }}
              >
                {t.cta}
              </div>
              <Stat value={t.stat1} label={t.stat1Label} />
              <Stat value={t.stat2} label={t.stat2Label} />
            </div>
          </div>

          <div
            style={{
              width: 410,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                borderRadius: 42,
                background: "white",
                border: "1px solid #fecdd3",
                boxShadow: "0 28px 90px rgba(15,23,42,0.16)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  height: 154,
                  background:
                    "linear-gradient(135deg, #e11d48 0%, #fb7185 58%, #f97316 100%)",
                  padding: 28,
                  color: "white",
                  alignItems: "flex-end",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", fontSize: 21, fontWeight: 700 }}>
                    {t.paid}
                  </div>
                  <div style={{ display: "flex", fontSize: 48, fontWeight: 800 }}>
                    ฿60
                  </div>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  padding: 28,
                  gap: 22,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div
                    style={{
                      display: "flex",
                      width: 72,
                      height: 72,
                      borderRadius: 20,
                      background:
                        "linear-gradient(135deg, #fef3c7 0%, #fde68a 42%, #d9f99d 100%)",
                      border: "6px solid white",
                      boxShadow: "0 10px 28px rgba(15,23,42,0.12)",
                    }}
                  />
                  <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        color: "#111827",
                        fontSize: 24,
                        fontWeight: 800,
                      }}
                    >
                      {t.product}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        marginTop: 6,
                        color: "#71717a",
                        fontSize: 18,
                        fontWeight: 600,
                      }}
                    >
                      PromptPay QR
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                  }}
                >
                  <Pill label="PromptPay" />
                  <Pill label="AI Slip" />
                  <Pill label="LINE" />
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    borderRadius: 24,
                    background: "#f8fafc",
                    padding: 18,
                  }}
                >
                  <Row label="Order" value="#20260525" />
                  <Row label="Payment" value="Verified" />
                  <Row label="Shipping" value="Ready" />
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
        "Cache-Control": "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        height: 66,
        padding: "0 22px",
        borderRadius: 22,
        background: "white",
        border: "1px solid #fecdd3",
      }}
    >
      <div style={{ display: "flex", color: "#be123c", fontSize: 25, fontWeight: 800 }}>
        {value}
      </div>
      <div style={{ display: "flex", color: "#71717a", fontSize: 14, fontWeight: 700 }}>
        {label}
      </div>
    </div>
  );
}

function Pill({ label }: { label: string }) {
  return (
    <div
      style={{
        display: "flex",
        borderRadius: 999,
        background: "#fff1f2",
        color: "#be123c",
        padding: "8px 12px",
        fontSize: 15,
        fontWeight: 800,
      }}
    >
      {label}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
      <div style={{ display: "flex", color: "#71717a", fontSize: 18, fontWeight: 700 }}>
        {label}
      </div>
      <div style={{ display: "flex", color: "#111827", fontSize: 18, fontWeight: 800 }}>
        {value}
      </div>
    </div>
  );
}
