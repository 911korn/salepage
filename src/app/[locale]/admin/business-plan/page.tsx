import {
  TrendingUp,
  Target,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  Circle,
  Flame,
  Lightbulb,
  Users,
  Building2,
} from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { requireAdmin } from "@/lib/admin";
import {
  getForecastSnapshot,
  buildScenarios,
  project12Months,
  projectCosts,
  PLAN_PRICE_BAHT,
  type MonthlyProjection,
  type CostProjection,
  type ForecastScenario,
} from "@/lib/business-forecast";

export const dynamic = "force-dynamic";

/**
 * /admin/business-plan — super-admin executive dashboard.
 *
 * Two halves:
 *  (1) Numeric forecast — current MRR / GMV / shop count, 12-month
 *      projection under pessimistic / realistic / optimistic scenarios,
 *      cost lines for contribution-margin awareness.
 *  (2) Narrative business plan — positioning vs Shopee/Lazada/TikTok
 *      Shop, key differentiators, growth initiatives ranked by impact,
 *      risks + mitigation, next-90-day roadmap.
 *
 * 911korn 2026-05-28 "ทำหน้าเมนู Business Plan ไว้ที่หลังบ้าน Super
 * Admin · forecast รายได้ และ แผนธุรกิจ ให้ทีว่าต้องทำไรบ้าง แผนยังไง".
 */
export default async function BusinessPlanPage() {
  await requireAdmin();
  const snapshot = await getForecastSnapshot();
  const scenarios = buildScenarios(snapshot);
  const projections = scenarios.map((s) => project12Months(snapshot, s));
  const costs = projections.map((p) => projectCosts(p, snapshot));

  const realistic = projections[1];
  const realisticCosts = costs[1];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Business Plan"
        description="Forecast รายได้ + แผนธุรกิจ — ภาพรวมที่ทีมและนักลงทุนใช้ตัดสินใจ"
      />

      <SnapshotSection snapshot={snapshot} />

      <ForecastSection
        scenarios={scenarios}
        projections={projections}
        costs={costs}
      />

      <MarginSection
        projection={realistic}
        costs={realisticCosts}
      />

      <PositioningSection />

      <RoadmapSection />

      <RisksSection />
    </div>
  );
}

function SnapshotSection({
  snapshot,
}: {
  snapshot: Awaited<ReturnType<typeof getForecastSnapshot>>;
}) {
  const stats = [
    {
      label: "ผู้ใช้สมัครทั้งหมด",
      value: snapshot.totalUsers.toLocaleString(),
      icon: Users,
    },
    {
      label: "ร้านทั้งหมด",
      value: snapshot.totalShops.toLocaleString(),
      sub: `+${snapshot.newShops7d} ใน 7 วัน`,
      icon: Building2,
    },
    {
      label: "Live shops (มีออเดอร์)",
      value: snapshot.liveShops.toLocaleString(),
      sub: `${((snapshot.liveShops / Math.max(1, snapshot.totalShops)) * 100).toFixed(1)}% ของร้านทั้งหมด`,
      icon: Sparkles,
    },
    {
      label: "MRR ปัจจุบัน",
      value: `฿${snapshot.currentMrrBaht.toLocaleString()}`,
      sub: "ค่าสมัครรายเดือนทั้งหมด",
      icon: TrendingUp,
    },
    {
      label: "GMV 30 วัน",
      value: `฿${snapshot.gmv30dBaht.toLocaleString()}`,
      sub: `฿${Math.round(snapshot.gmv7dBaht).toLocaleString()} ใน 7 วัน`,
      icon: Flame,
    },
    {
      label: "% Conversion → Paid",
      value: `${snapshot.paidConversionPct.toFixed(1)}%`,
      sub: "ร้านที่อยู่บนแผนเสียเงิน",
      icon: Target,
    },
  ];

  return (
    <section>
      <h2 className="font-display text-lg font-bold tracking-tight text-zinc-900">
        ภาพปัจจุบัน
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="rounded-2xl border border-zinc-200 bg-white p-4"
            >
              <div className="flex items-center justify-between">
                <p className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-500">
                  {s.label}
                </p>
                <Icon className="size-3.5 text-zinc-400" />
              </div>
              <p className="font-display mt-2 text-2xl font-bold text-zinc-900">
                {s.value}
              </p>
              {s.sub ? (
                <p className="mt-1 text-[11px] text-zinc-500">{s.sub}</p>
              ) : null}
            </div>
          );
        })}
      </div>

      <SubsByPlanBar paidSubsByPlan={snapshot.paidSubsByPlan} />
    </section>
  );
}

function SubsByPlanBar({
  paidSubsByPlan,
}: {
  paidSubsByPlan: Record<string, number>;
}) {
  const tiers = [
    {
      plan: "PRO",
      count: paidSubsByPlan.PRO,
      price: PLAN_PRICE_BAHT.PRO,
      color: "bg-rose-500",
    },
    {
      plan: "BUSINESS",
      count: paidSubsByPlan.BUSINESS,
      price: PLAN_PRICE_BAHT.BUSINESS,
      color: "bg-emerald-500",
    },
    {
      plan: "AGENCY",
      count: paidSubsByPlan.AGENCY,
      price: PLAN_PRICE_BAHT.AGENCY,
      color: "bg-amber-500",
    },
  ];

  return (
    <div className="mt-3 rounded-2xl border border-zinc-200 bg-white p-4">
      <p className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-500">
        Active subscriptions by tier
      </p>
      <div className="mt-3 space-y-2">
        {tiers.map((t) => (
          <div key={t.plan} className="flex items-center gap-3">
            <div className="w-24 text-[12px] font-bold text-zinc-700">
              {t.plan}
            </div>
            <div className="flex-1">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[13px] font-bold">
                  {t.count}
                </span>
                <span className="text-[11px] text-zinc-500">
                  × ฿{t.price.toLocaleString()}/เดือน = ฿
                  {(t.count * t.price).toLocaleString()}
                </span>
              </div>
            </div>
            <div className="hidden h-2 w-32 overflow-hidden rounded-full bg-zinc-100 sm:block">
              <div
                className={`h-full ${t.color}`}
                style={{
                  width: `${Math.min(100, t.count * 5)}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ForecastSection({
  scenarios,
  projections,
  costs,
}: {
  scenarios: ForecastScenario[];
  projections: MonthlyProjection[][];
  costs: CostProjection[][];
}) {
  return (
    <section>
      <h2 className="font-display text-lg font-bold tracking-tight text-zinc-900">
        12-month revenue forecast
      </h2>
      <p className="mt-1 text-[13px] text-zinc-500">
        3 scenarios · ตัวเลขมาจาก growth ปัจจุบัน × conversion target
      </p>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {scenarios.map((s, i) => {
          const projection = projections[i];
          const cost = costs[i];
          const finalMonth = projection[11];
          const totalYearRev = projection.reduce(
            (sum, p) => sum + p.totalRevenueBaht,
            0,
          );
          const totalYearCost = cost.reduce(
            (sum, c) =>
              sum + c.slipOkCostBaht + c.hostingBaht + c.stripeFeesBaht,
            0,
          );
          const margin = totalYearRev - totalYearCost;
          const marginPct =
            totalYearRev > 0 ? (margin / totalYearRev) * 100 : 0;
          const isRealistic = i === 1;

          return (
            <div
              key={s.label}
              className={`rounded-2xl border p-4 ${
                isRealistic
                  ? "border-rose-300 bg-rose-50/40"
                  : "border-zinc-200 bg-white"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <h3 className="font-display text-base font-bold">
                  {s.label}
                </h3>
                {isRealistic ? (
                  <span className="rounded-full bg-rose-600 px-1.5 py-0.5 text-[9.5px] font-bold uppercase text-white">
                    base case
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-[10.5px] text-zinc-500">
                +{(s.monthlyGrowth * 100).toFixed(1)}%/เดือน ·{" "}
                {(s.paidConversionAtM12 * 100).toFixed(0)}% conversion@M12
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2 text-[11.5px]">
                <div>
                  <p className="text-[10px] uppercase text-zinc-500">M12 shops</p>
                  <p className="font-display text-lg font-bold">
                    {finalMonth.shops.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-zinc-500">M12 MRR</p>
                  <p className="font-display text-lg font-bold">
                    ฿{Math.round(finalMonth.mrrBaht / 1000).toLocaleString()}K
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-zinc-500">
                    Year revenue
                  </p>
                  <p className="font-display text-lg font-bold text-emerald-700">
                    ฿{Math.round(totalYearRev / 1000).toLocaleString()}K
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-zinc-500">
                    Gross margin
                  </p>
                  <p className="font-display text-lg font-bold">
                    {marginPct.toFixed(0)}%
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <ProjectionTable
        scenarios={scenarios}
        projections={projections}
      />
    </section>
  );
}

function ProjectionTable({
  scenarios,
  projections,
}: {
  scenarios: ForecastScenario[];
  projections: MonthlyProjection[][];
}) {
  const realistic = projections[1];
  return (
    <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
      <table className="w-full text-[11.5px]">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50 text-left">
            <th className="px-3 py-2 font-semibold text-zinc-600">Month</th>
            <th className="px-3 py-2 text-right font-semibold text-zinc-600">
              Shops
            </th>
            <th className="px-3 py-2 text-right font-semibold text-zinc-600">
              Paid shops
            </th>
            <th className="px-3 py-2 text-right font-semibold text-zinc-600">
              MRR
            </th>
            <th className="px-3 py-2 text-right font-semibold text-zinc-600">
              Slip-pack rev
            </th>
            <th className="px-3 py-2 text-right font-semibold text-rose-700">
              Total revenue
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {realistic.map((p) => (
            <tr key={p.month}>
              <td className="px-3 py-1.5 font-mono">M{p.month}</td>
              <td className="px-3 py-1.5 text-right font-mono">
                {p.shops.toLocaleString()}
              </td>
              <td className="px-3 py-1.5 text-right font-mono">
                {p.paidShops.toLocaleString()}
              </td>
              <td className="px-3 py-1.5 text-right font-mono">
                ฿{p.mrrBaht.toLocaleString()}
              </td>
              <td className="px-3 py-1.5 text-right font-mono">
                ฿{p.slipPackRevBaht.toLocaleString()}
              </td>
              <td className="px-3 py-1.5 text-right font-mono font-bold text-rose-700">
                ฿{p.totalRevenueBaht.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-3 py-2 text-[10.5px] text-zinc-500">
        Base case · growth {(scenarios[1].monthlyGrowth * 100).toFixed(1)}%/เดือน · 12-month total ฿
        {realistic
          .reduce((s, p) => s + p.totalRevenueBaht, 0)
          .toLocaleString()}
      </p>
    </div>
  );
}

function MarginSection({
  projection,
  costs,
}: {
  projection: MonthlyProjection[];
  costs: CostProjection[];
}) {
  const m12 = projection[11];
  const c12 = costs[11];
  const totalCost = c12.slipOkCostBaht + c12.hostingBaht + c12.stripeFeesBaht;
  const margin = m12.totalRevenueBaht - totalCost;
  const marginPct =
    m12.totalRevenueBaht > 0
      ? (margin / m12.totalRevenueBaht) * 100
      : 0;

  return (
    <section>
      <h2 className="font-display text-lg font-bold tracking-tight text-zinc-900">
        Contribution margin (M12 — base case)
      </h2>
      <div className="mt-3 grid gap-3 lg:grid-cols-4">
        <MarginCard
          label="Revenue"
          value={m12.totalRevenueBaht}
          tone="emerald"
        />
        <MarginCard
          label="SlipOK API cost"
          value={c12.slipOkCostBaht}
          tone="rose"
          negative
          note="50% subsidy ต่อสลิป"
        />
        <MarginCard
          label="Hosting + infra"
          value={c12.hostingBaht}
          tone="rose"
          negative
          note="~฿2/shop/เดือน"
        />
        <MarginCard
          label="Stripe fees"
          value={c12.stripeFeesBaht}
          tone="rose"
          negative
          note="3.65% ของ revenue"
        />
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 lg:col-span-4">
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-emerald-700">
            Net contribution (M12)
          </p>
          <div className="mt-2 flex items-baseline gap-3">
            <p className="font-display text-2xl font-bold text-emerald-900">
              ฿{margin.toLocaleString()}
            </p>
            <p className="text-[12px] font-bold text-emerald-700">
              {marginPct.toFixed(1)}% margin
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function MarginCard({
  label,
  value,
  tone,
  negative,
  note,
}: {
  label: string;
  value: number;
  tone: "emerald" | "rose";
  negative?: boolean;
  note?: string;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        tone === "emerald"
          ? "border-emerald-200 bg-emerald-50/40"
          : "border-rose-200 bg-rose-50/40"
      }`}
    >
      <p className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <p
        className={`font-display mt-2 text-xl font-bold ${
          tone === "emerald" ? "text-emerald-800" : "text-rose-800"
        }`}
      >
        {negative ? "−" : ""}฿{value.toLocaleString()}
      </p>
      {note ? <p className="mt-1 text-[10.5px] text-zinc-500">{note}</p> : null}
    </div>
  );
}

function PositioningSection() {
  const competitors = [
    {
      name: "Shopee",
      strength: "ฐานลูกค้าใหญ่มาก · มี ad network · cross-border",
      weakness: "หัก commission 5-12% · เงินค้างใน wallet 7-14 วัน · กฎเปลี่ยนบ่อย",
    },
    {
      name: "Lazada",
      strength: "Logistics network ใหญ่ · LazMall premium · live commerce",
      weakness: "หัก commission 3-5% + LazPayLater fees · onboarding ยาว",
    },
    {
      name: "TikTok Shop",
      strength: "Discovery จาก algorithm · live shopping · creator economy",
      weakness: "หัก 5% + flat fee · payout cycle · เพิ่งเข้าไทย ระบบยังไม่นิ่ง",
    },
    {
      name: "Shopify",
      strength: "Full-feature ecommerce · brand-owned · plugins",
      weakness: "ค่าใช้จ่ายเริ่ม $29/เดือน + payment gateway fees · ไม่มี local payment",
    },
  ];
  const differentiators = [
    "0% commission — เงินเข้าบัญชีร้านตรงผ่าน PromptPay 100%",
    "AI ตรวจสลิป 3 วินาที — แม่นกว่ามนุษย์ + ไม่ต้องนั่งเช็คทุกออเดอร์",
    "AI Bulk Tracking — ส่ง 100 ออเดอร์ใส่ tracking ใน 5 นาที (ผูก receipt+label)",
    "ใช้ขนส่งได้ทุกเจ้า — ไม่ผูกกับ courier ใดเจ้าหนึ่ง",
    "เปิดร้านได้ใน 30 วินาที — ไม่ต้องเอกสาร KYC ก่อนเริ่ม",
    "หน้าร้าน mobile-first + LINE LIFF integration native",
  ];

  return (
    <section>
      <h2 className="font-display text-lg font-bold tracking-tight text-zinc-900">
        Market positioning
      </h2>

      <div className="mt-3 rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 to-amber-50 p-4">
        <p className="text-[10.5px] font-semibold uppercase tracking-wider text-rose-700">
          จุดยืน
        </p>
        <p className="font-display mt-2 text-base font-bold leading-snug text-zinc-900">
          &ldquo;SaaS เปิดร้านสำหรับ SME ไทย — เก็บเงิน 100% ของยอดขาย ไม่ผ่านคนกลาง&rdquo;
        </p>
        <p className="mt-2 text-[12.5px] leading-relaxed text-zinc-700">
          เราไม่แข่งกับ marketplace ในด้าน traffic — เราเสริมให้ร้านที่มีลูกค้าอยู่แล้ว (Facebook page,
          Instagram, LINE OA, IG live) มี checkout ที่ดูเป็นมืออาชีพ รับเงินตรง + จัดการออเดอร์ในที่เดียว
        </p>
      </div>

      <h3 className="mt-5 text-[12px] font-bold uppercase tracking-wider text-zinc-600">
        จุดแข็งที่เราถือไพ่
      </h3>
      <ul className="mt-2 grid gap-2 lg:grid-cols-2">
        {differentiators.map((d, i) => (
          <li
            key={i}
            className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50/30 p-3"
          >
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700" />
            <span className="text-[12.5px] text-zinc-800">{d}</span>
          </li>
        ))}
      </ul>

      <h3 className="mt-5 text-[12px] font-bold uppercase tracking-wider text-zinc-600">
        คู่แข่ง — จุดแข็ง / จุดอ่อน
      </h3>
      <div className="mt-2 overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
        <table className="w-full text-[12px]">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-zinc-600">
                Competitor
              </th>
              <th className="px-3 py-2 text-left font-semibold text-emerald-700">
                ของเขาดียังไง
              </th>
              <th className="px-3 py-2 text-left font-semibold text-rose-700">
                ของเขาอ่อนตรงไหน
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {competitors.map((c) => (
              <tr key={c.name}>
                <td className="px-3 py-2 align-top font-bold">{c.name}</td>
                <td className="px-3 py-2 align-top text-zinc-700">
                  {c.strength}
                </td>
                <td className="px-3 py-2 align-top text-zinc-700">
                  {c.weakness}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RoadmapSection() {
  const sprints = [
    {
      label: "Next 30 days",
      focus: "Conversion to paid",
      items: [
        {
          done: false,
          title: "Onboarding wizard ภาคบังคับ",
          why: "ร้านใหม่ที่ตั้งแต่งครบ → upgrade rate สูงกว่า 3x — กั้นให้ต้องตั้ง logo/banner/promptpay/pickup ก่อน publish ผลิตภัณฑ์แรก",
        },
        {
          done: false,
          title: "Pricing modal แบบ contextual",
          why: "ตอนกดฟีเจอร์ Business+ ในร้าน FREE/Starter เด้ง modal upgrade ทันที (ทำแล้วใน Auto Tracking — propagate ไป Bulk Tracking + Chat + Loyalty)",
        },
        {
          done: true,
          title: "AI Bulk Tracking (web + mobile)",
          why: "Phase 1 + 2 ship แล้ว 2026-05-28 — ตอนนี้ต่อด้วย onboarding hint ในหน้า help",
        },
        {
          done: false,
          title: "Email drip campaign 7 วันแรก",
          why: "Day 1 'อัปสินค้าแรก' · Day 3 'แชร์ลิงก์ร้าน' · Day 7 'อัปเกรด Pro' — ใช้ Resend",
        },
      ],
    },
    {
      label: "Next 60-90 days",
      focus: "Activation + retention",
      items: [
        {
          done: false,
          title: "Multi-shop dashboard (Agency tier)",
          why: "ลูกค้า reseller / digital agency ขอมา — 1 บัญชี admin → ดูแลร้าน 5-50 ร้านพร้อมกัน",
        },
        {
          done: false,
          title: "LINE Notify integration",
          why: "ตอนนี้ใช้ LINE Login + LINE Messaging API → เพิ่ม LINE Notify ให้ร้านส่ง broadcast หาลูกค้าสมัครได้ฟรี",
        },
        {
          done: false,
          title: "Shopee/Lazada importer แบบ async batch",
          why: "ร้านที่มี 500+ SKU บน Shopee — รอเปิด tab 5 นาทีน่าเบื่อ → แบ่ง batch 50 SKU ทยอย import ส่ง email เมื่อจบ",
        },
        {
          done: false,
          title: "Referral program — ฿100 ทุกร้านที่ชวน",
          why: "Loop effect: ร้านขายดี = ชวนเพื่อนค้าขายอื่นๆ — เริ่มจาก Pro+ ที่เริ่มเห็นมูลค่าแล้ว",
        },
      ],
    },
    {
      label: "Next 6 months",
      focus: "Scale + ecosystem",
      items: [
        {
          done: false,
          title: "Payouts dashboard + tax invoice generator",
          why: "ร้านที่ขาย ฿100K/เดือน ต้องทำใบกำกับภาษีให้ลูกค้านิติบุคคล — ตอนนี้ทำมือ → ระบบ generate ให้",
        },
        {
          done: false,
          title: "Inventory sync API",
          why: "ร้านที่ขายหลาย channel (Shopee + Lazada + SalePage) ต้อง sync สต็อก — exposed REST + webhook",
        },
        {
          done: false,
          title: "B2B feature — wholesale pricing tier",
          why: "ลูกค้า reseller ต้องการราคาส่งเพิ่ม → ใส่ tier pricing + เลขลูกค้าสมาชิก",
        },
        {
          done: false,
          title: "Live commerce (V2.0 prep)",
          why: "ของบนแอปมือถือมี code อยู่แล้ว (Stories + Live + Group Buy) — ค่อยเปิดเมื่อ user base พร้อม",
        },
      ],
    },
  ];

  return (
    <section>
      <h2 className="font-display text-lg font-bold tracking-tight text-zinc-900">
        Growth roadmap
      </h2>
      <p className="mt-1 text-[13px] text-zinc-500">
        เรียงตาม impact × urgency · ที่ทำเสร็จติ๊กไว้
      </p>

      <div className="mt-4 space-y-4">
        {sprints.map((sprint) => (
          <div
            key={sprint.label}
            className="rounded-2xl border border-zinc-200 bg-white p-4"
          >
            <div className="flex items-center gap-2">
              <h3 className="font-display text-base font-bold text-zinc-900">
                {sprint.label}
              </h3>
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-700">
                {sprint.focus}
              </span>
            </div>
            <ul className="mt-3 space-y-2.5">
              {sprint.items.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  {item.done ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  ) : (
                    <Circle className="mt-0.5 size-4 shrink-0 text-zinc-300" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-[13px] font-bold ${
                        item.done
                          ? "text-zinc-500 line-through"
                          : "text-zinc-900"
                      }`}
                    >
                      {item.title}
                    </p>
                    <p className="mt-0.5 text-[11.5px] leading-relaxed text-zinc-600">
                      {item.why}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function RisksSection() {
  const risks = [
    {
      title: "SlipOK ขึ้นราคา / เปลี่ยน rate limit",
      severity: "high",
      mitigation:
        "ทำ EasySlip adapter ใน slip-verify.ts ไว้แล้ว — สลับ provider ได้ด้วย env เดียว · ต่อรองรายปีกับ SlipOK เพื่อ lock price",
    },
    {
      title: "ธนาคารแห่งประเทศไทย กำหนดเงื่อนไข PromptPay เพิ่ม",
      severity: "med",
      mitigation:
        "เราไม่ได้แตะเงิน — ลูกค้าโอนตรงร้าน · ถ้ามีกฎใหม่ที่กระทบ → adapter pattern ให้สลับไป QR-30 / e-Wallet ได้",
    },
    {
      title: "Vercel cost spike เมื่อ scale ถึง 10K+ shops",
      severity: "med",
      mitigation:
        "Edge runtime สำหรับหน้าร้าน + static OG image · พิจารณา self-host บน Coolify/Hetzner ที่ ฿2K/เดือน flat",
    },
    {
      title: "Shopee/Lazada เปิด feature 'ไม่หัก%' มาแข่ง",
      severity: "low",
      mitigation:
        "ของเขามี cost structure ที่ต้องเลี้ยง wallet + dispute team — เลิก commission เท่ากับยอม subsidise · brand SalePage ผูกกับ '0% ตลอดชีพ' ก่อนพวกเขาทำได้",
    },
    {
      title: "AI cost (Anthropic) ขึ้นเมื่อ volume โต",
      severity: "med",
      mitigation:
        "ตอนนี้ Haiku 4.5 = $1/MTok input · เรียกใช้ ~1k tokens ต่อ image · ตั้ง budget alert บน Anthropic console · พร้อม fallback เป็น GPT-4o-mini ถ้าจำเป็น",
    },
    {
      title: "ทีมเล็ก — bus factor",
      severity: "high",
      mitigation:
        "เขียน CLAUDE.md ละเอียดทั้งระบบ + คู่มือ user-facing ที่ /dashboard/help · agent ตัวใหม่เข้ารับงานได้ใน 1 วัน · ใช้ Claude Code เป็น force-multiplier",
    },
  ];

  return (
    <section>
      <h2 className="font-display text-lg font-bold tracking-tight text-zinc-900">
        ความเสี่ยง + แผนรับมือ
      </h2>
      <div className="mt-3 space-y-2">
        {risks.map((r, i) => {
          const tone =
            r.severity === "high"
              ? "border-rose-300 bg-rose-50"
              : r.severity === "med"
                ? "border-amber-300 bg-amber-50"
                : "border-zinc-200 bg-white";
          const label =
            r.severity === "high"
              ? "HIGH"
              : r.severity === "med"
                ? "MED"
                : "LOW";
          const labelColor =
            r.severity === "high"
              ? "bg-rose-600 text-white"
              : r.severity === "med"
                ? "bg-amber-500 text-white"
                : "bg-zinc-300 text-zinc-700";
          return (
            <div key={i} className={`rounded-2xl border ${tone} p-4`}>
              <div className="flex items-start gap-2">
                <AlertTriangle
                  className={`mt-0.5 size-4 shrink-0 ${
                    r.severity === "high"
                      ? "text-rose-700"
                      : r.severity === "med"
                        ? "text-amber-700"
                        : "text-zinc-500"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-bold text-zinc-900">
                      {r.title}
                    </p>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[9.5px] font-bold ${labelColor}`}
                    >
                      {label}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-zinc-700">
                    <strong>วิธีรับมือ:</strong> {r.mitigation}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-2xl border border-sky-200 bg-sky-50 p-4">
        <div className="flex items-start gap-2">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-sky-700" />
          <div>
            <p className="text-[13px] font-bold text-sky-900">
              สรุปสำหรับการตัดสินใจ
            </p>
            <ul className="mt-2 ml-4 list-disc space-y-1 text-[12.5px] text-zinc-800">
              <li>
                <strong>ไพ่หลักของเรา</strong> = 0% commission + AI auto สลิป + bulk tracking — ทั้ง 3 อย่างคู่แข่งไม่มี
              </li>
              <li>
                <strong>กังวลแรก</strong> = paid conversion ปัจจุบันต่ำ →
                ลงทุนใน onboarding + contextual upsell modal
              </li>
              <li>
                <strong>ทางลัด</strong> = Agency tier (multi-shop) เปิดประตู
                segment B2B/reseller ที่จ่ายแพงกว่า — ARPU สูง ลด churn
              </li>
              <li>
                <strong>เวลาที่ดีที่สุดเริ่มลงทุน growth</strong> = ตอนที่
                conversion ≥ 8 % (base case M12) → CAC payback &lt; 3 เดือน
                ก็เริ่มซื้อ ads ได้
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
