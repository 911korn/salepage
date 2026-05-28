"use client";

import { useMemo, useState } from "react";
import {
  RotateCcw,
  TrendingUp,
  Wallet,
  Building2,
  Users,
} from "lucide-react";

/**
 * Interactive what-if calculator for /admin/business-plan. Every slider
 * recomputes the 12-month forecast client-side in pure JS — no server
 * round-trip per drag, no chart library, just native <input type=range>
 * + memoised math. The defaults are derived from the live server-side
 * snapshot the parent passes in.
 *
 * 911korn 2026-05-28 "ขอ business Plan แบบปรับค่าได้ทุกอย่างที แบบ
 * เลื่อนเอาเองได้".
 */

export interface CalculatorDefaults {
  /** Starting shop count — defaults to the actual live shop count.
   *  The 5K / 10K / etc. presets pre-fill via the parent's ?shops= URL. */
  shops: number;
  /** Current paid-conversion % observed in production (0..100). */
  paidConversionPct: number;
  /** ARPU per paid shop / month in THB. */
  arpuBaht: number;
  /** Trailing GMV per shop per month in THB. */
  gmvPerShopBaht: number;
  /** Trailing slip-verify calls per shop per month. */
  slipCallsPerShop: number;
  /** Monthly compound growth in shop count (decimal, e.g. 0.12 = 12 %). */
  monthlyGrowth: number;
}

interface Inputs {
  shops: number;
  monthlyGrowth: number;
  paidConversionPct: number;
  arpuBaht: number;
  gmvPerShopBaht: number;
  slipCallsPerShop: number;
  slipPackUptakePct: number;
  slipPackAvgBaht: number;
  escrowUptakePct: number;
  escrowFeePct: number;
  hostingPerShopBaht: number;
  stripeFeePct: number;
  slipOkCostBaht: number;
  slipOkSubsidyPct: number;
}

const PRESETS: Array<{ label: string; shops: number }> = [
  { label: "ตอนนี้", shops: -1 },
  { label: "1K", shops: 1000 },
  { label: "5K", shops: 5000 },
  { label: "10K", shops: 10_000 },
  { label: "20K (1% TAM)", shops: 20_000 },
  { label: "50K", shops: 50_000 },
  { label: "100K", shops: 100_000 },
];

export function BusinessPlanCalculator({
  defaults,
}: {
  defaults: CalculatorDefaults;
}) {
  const [inputs, setInputs] = useState<Inputs>(() => initialInputs(defaults));

  function reset() {
    setInputs(initialInputs(defaults));
  }
  function set<K extends keyof Inputs>(key: K, value: Inputs[K]) {
    setInputs((prev) => ({ ...prev, [key]: value }));
  }

  const projection = useMemo(() => project12Months(inputs), [inputs]);
  const m12 = projection[11];
  const totalYearRev = projection.reduce(
    (sum, p) => sum + p.totalRevenueBaht,
    0,
  );
  const totalYearCost = projection.reduce(
    (sum, p) => sum + p.totalCostBaht,
    0,
  );
  const yearMargin = totalYearRev - totalYearCost;
  const yearMarginPct =
    totalYearRev > 0 ? (yearMargin / totalYearRev) * 100 : 0;

  return (
    <section className="rounded-2xl border-2 border-rose-200 bg-gradient-to-br from-rose-50/40 to-amber-50/30 p-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-rose-700">
            Interactive forecast
          </p>
          <p className="font-display mt-1 text-base font-bold text-zinc-900">
            ลากเลื่อนค่าได้ทุกตัว — ตัวเลขข้างล่างคำนวณใหม่ทันที
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50"
        >
          <RotateCcw className="size-3" />
          คืนค่าเริ่มต้น
        </button>
      </header>

      {/* Quick presets */}
      <div className="mt-4">
        <p className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-500">
          ตั้งค่าจำนวนร้านอย่างเร็ว
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PRESETS.map((p) => {
            const active =
              (p.shops === -1 && inputs.shops === defaults.shops) ||
              inputs.shops === p.shops;
            const value = p.shops === -1 ? defaults.shops : p.shops;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => set("shops", value)}
                className={`rounded-full px-3 py-1 text-[11.5px] font-bold transition ${
                  active
                    ? "bg-rose-600 text-white shadow-sm"
                    : "border border-zinc-200 bg-white text-zinc-700 hover:border-rose-300"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 grid gap-x-6 gap-y-4 lg:grid-cols-2">
        <div>
          <Group title="Scale + growth">
            <Slider
              label="จำนวนร้าน"
              value={inputs.shops}
              min={100}
              max={200_000}
              step={100}
              format={(v) => v.toLocaleString() + " ร้าน"}
              onChange={(v) => set("shops", v)}
            />
            <Slider
              label="เติบโต / เดือน"
              value={inputs.monthlyGrowth}
              min={0}
              max={0.4}
              step={0.005}
              format={(v) => (v * 100).toFixed(1) + " %"}
              onChange={(v) => set("monthlyGrowth", v)}
            />
            <Slider
              label="GMV ต่อร้าน / เดือน"
              value={inputs.gmvPerShopBaht}
              min={500}
              max={30_000}
              step={500}
              format={(v) => "฿" + v.toLocaleString()}
              onChange={(v) => set("gmvPerShopBaht", v)}
            />
          </Group>
        </div>
        <div>
          <Group title="Monetization">
            <Slider
              label="Paid conversion %"
              value={inputs.paidConversionPct}
              min={0}
              max={30}
              step={0.5}
              format={(v) => v.toFixed(1) + " %"}
              onChange={(v) => set("paidConversionPct", v)}
            />
            <Slider
              label="ARPU / paid shop / เดือน"
              value={inputs.arpuBaht}
              min={200}
              max={2_500}
              step={10}
              format={(v) => "฿" + v.toLocaleString()}
              onChange={(v) => set("arpuBaht", v)}
            />
            <Slider
              label="% paid shops ซื้อ slip pack / เดือน"
              value={inputs.slipPackUptakePct}
              min={0}
              max={100}
              step={1}
              format={(v) => v.toFixed(0) + " %"}
              onChange={(v) => set("slipPackUptakePct", v)}
            />
            <Slider
              label="ราคาเฉลี่ย slip pack"
              value={inputs.slipPackAvgBaht}
              min={125}
              max={7_500}
              step={25}
              format={(v) => "฿" + v.toLocaleString()}
              onChange={(v) => set("slipPackAvgBaht", v)}
            />
            <Slider
              label="% GMV ใช้ Escrow"
              value={inputs.escrowUptakePct}
              min={0}
              max={50}
              step={1}
              format={(v) => v.toFixed(0) + " %"}
              onChange={(v) => set("escrowUptakePct", v)}
            />
            <Slider
              label="Escrow fee %"
              value={inputs.escrowFeePct}
              min={0.5}
              max={5}
              step={0.1}
              format={(v) => v.toFixed(1) + " %"}
              onChange={(v) => set("escrowFeePct", v)}
            />
          </Group>
        </div>
        <div className="lg:col-span-2">
          <Group title="ต้นทุน">
            <div className="grid gap-4 sm:grid-cols-2">
              <Slider
                label="Slip calls / ร้าน / เดือน"
                value={inputs.slipCallsPerShop}
                min={0}
                max={50}
                step={1}
                format={(v) => v.toFixed(0) + " calls"}
                onChange={(v) => set("slipCallsPerShop", v)}
              />
              <Slider
                label="ต้นทุน SlipOK / call"
                value={inputs.slipOkCostBaht}
                min={1}
                max={10}
                step={0.25}
                format={(v) => "฿" + v.toFixed(2)}
                onChange={(v) => set("slipOkCostBaht", v)}
              />
              <Slider
                label="SalePage subsidy SlipOK"
                value={inputs.slipOkSubsidyPct}
                min={0}
                max={100}
                step={5}
                format={(v) => v.toFixed(0) + " %"}
                onChange={(v) => set("slipOkSubsidyPct", v)}
              />
              <Slider
                label="Hosting ต่อร้าน / เดือน"
                value={inputs.hostingPerShopBaht}
                min={0.5}
                max={20}
                step={0.5}
                format={(v) => "฿" + v.toFixed(1)}
                onChange={(v) => set("hostingPerShopBaht", v)}
              />
              <Slider
                label="Stripe fees %"
                value={inputs.stripeFeePct}
                min={0}
                max={6}
                step={0.05}
                format={(v) => v.toFixed(2) + " %"}
                onChange={(v) => set("stripeFeePct", v)}
              />
            </div>
          </Group>
        </div>
      </div>

      {/* Result KPI cards */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiBlock
          label="M12 shops"
          value={m12.shops.toLocaleString()}
          icon={Building2}
        />
        <KpiBlock
          label="M12 paid shops"
          value={m12.paidShops.toLocaleString()}
          icon={Users}
        />
        <KpiBlock
          label="M12 monthly revenue"
          value={"฿" + m12.totalRevenueBaht.toLocaleString()}
          icon={TrendingUp}
          tone="emerald"
        />
        <KpiBlock
          label="ปีนี้ Net margin"
          value={"฿" + yearMargin.toLocaleString()}
          sub={yearMarginPct.toFixed(1) + " %"}
          icon={Wallet}
          tone="rose"
        />
      </div>

      {/* Compact bar chart — revenue per month */}
      <RevenueBars projection={projection} />

      {/* Detailed projection table */}
      <ProjectionTable projection={projection} />
    </section>
  );
}

function initialInputs(d: CalculatorDefaults): Inputs {
  return {
    shops: d.shops > 0 ? d.shops : 1000,
    monthlyGrowth: Math.max(0.02, Math.min(d.monthlyGrowth, 0.4)),
    paidConversionPct: Math.max(0.5, d.paidConversionPct || 5),
    arpuBaht: d.arpuBaht || 531,
    gmvPerShopBaht: Math.max(500, d.gmvPerShopBaht || 2000),
    slipCallsPerShop: Math.max(1, d.slipCallsPerShop || 5),
    slipPackUptakePct: 20,
    slipPackAvgBaht: 330,
    escrowUptakePct: 8,
    escrowFeePct: 2,
    hostingPerShopBaht: 2,
    stripeFeePct: 3.65,
    slipOkCostBaht: 5,
    slipOkSubsidyPct: 50,
  };
}

interface MonthProjection {
  month: number;
  shops: number;
  paidShops: number;
  mrrBaht: number;
  slipPackRevBaht: number;
  escrowRevBaht: number;
  totalRevenueBaht: number;
  slipOkCostBaht: number;
  hostingBaht: number;
  stripeFeesBaht: number;
  totalCostBaht: number;
  netBaht: number;
}

function project12Months(inputs: Inputs): MonthProjection[] {
  const out: MonthProjection[] = [];
  for (let m = 1; m <= 12; m++) {
    const shops = Math.round(
      inputs.shops * Math.pow(1 + inputs.monthlyGrowth, m),
    );
    const paidShops = Math.round(shops * (inputs.paidConversionPct / 100));
    const mrrBaht = Math.round(paidShops * inputs.arpuBaht);
    const slipPackRevBaht = Math.round(
      paidShops * (inputs.slipPackUptakePct / 100) * inputs.slipPackAvgBaht,
    );
    const escrowRevBaht = Math.round(
      shops *
        inputs.gmvPerShopBaht *
        (inputs.escrowUptakePct / 100) *
        (inputs.escrowFeePct / 100),
    );
    const totalRevenueBaht = mrrBaht + slipPackRevBaht + escrowRevBaht;

    const slipOkCostBaht = Math.round(
      shops *
        inputs.slipCallsPerShop *
        inputs.slipOkCostBaht *
        (inputs.slipOkSubsidyPct / 100),
    );
    const hostingBaht = Math.round(shops * inputs.hostingPerShopBaht);
    const stripeFeesBaht = Math.round(
      (mrrBaht + slipPackRevBaht) * (inputs.stripeFeePct / 100),
    );
    const totalCostBaht = slipOkCostBaht + hostingBaht + stripeFeesBaht;
    const netBaht = totalRevenueBaht - totalCostBaht;

    out.push({
      month: m,
      shops,
      paidShops,
      mrrBaht,
      slipPackRevBaht,
      escrowRevBaht,
      totalRevenueBaht,
      slipOkCostBaht,
      hostingBaht,
      stripeFeesBaht,
      totalCostBaht,
      netBaht,
    });
  }
  return out;
}

function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <p className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-500">
        {title}
      </p>
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12px] font-semibold text-zinc-700">{label}</span>
        <span className="font-mono text-[12px] font-bold text-rose-700">
          {format(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 w-full accent-rose-600"
      />
    </label>
  );
}

function KpiBlock({
  label,
  value,
  sub,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "emerald" | "rose";
}) {
  const wrapTone =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50/60"
      : tone === "rose"
        ? "border-rose-200 bg-rose-50/60"
        : "border-zinc-200 bg-white";
  return (
    <div className={`rounded-2xl border p-4 ${wrapTone}`}>
      <div className="flex items-center justify-between">
        <p className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-500">
          {label}
        </p>
        <Icon className="size-3.5 text-zinc-400" />
      </div>
      <p className="font-display mt-2 text-xl font-bold text-zinc-900">
        {value}
      </p>
      {sub ? <p className="mt-0.5 text-[11px] text-zinc-500">{sub}</p> : null}
    </div>
  );
}

function RevenueBars({ projection }: { projection: MonthProjection[] }) {
  const maxRev = Math.max(...projection.map((p) => p.totalRevenueBaht));
  return (
    <div className="mt-5 rounded-2xl border border-zinc-200 bg-white p-4">
      <p className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-500">
        Monthly revenue (12 months)
      </p>
      <div className="mt-3 flex h-32 items-end gap-1">
        {projection.map((p) => {
          const heightPct =
            maxRev > 0 ? (p.totalRevenueBaht / maxRev) * 100 : 0;
          return (
            <div
              key={p.month}
              className="group relative flex-1"
              title={`M${p.month} ฿${p.totalRevenueBaht.toLocaleString()}`}
            >
              <div
                className="w-full rounded-t-md bg-gradient-to-t from-rose-600 to-rose-400 transition hover:from-rose-700 hover:to-rose-500"
                style={{ height: `${Math.max(2, heightPct)}%` }}
              />
              <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 font-mono text-[9px] text-zinc-400">
                M{p.month}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-5 text-[10.5px] text-zinc-500">
        M1 ฿{projection[0].totalRevenueBaht.toLocaleString()} → M12 ฿
        {projection[11].totalRevenueBaht.toLocaleString()}
      </p>
    </div>
  );
}

function ProjectionTable({ projection }: { projection: MonthProjection[] }) {
  return (
    <details className="mt-3 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
      <summary className="cursor-pointer px-4 py-2.5 text-[12px] font-semibold text-zinc-700 hover:bg-zinc-50">
        ดูตารางแบบรายเดือนเต็ม ▾
      </summary>
      <div className="overflow-x-auto border-t border-zinc-100">
        <table className="w-full text-[11px]">
          <thead className="bg-zinc-50 text-left">
            <tr>
              <th className="px-3 py-2 font-semibold text-zinc-600">M</th>
              <th className="px-3 py-2 text-right font-semibold text-zinc-600">
                Shops
              </th>
              <th className="px-3 py-2 text-right font-semibold text-zinc-600">
                Paid
              </th>
              <th className="px-3 py-2 text-right font-semibold text-zinc-600">
                MRR
              </th>
              <th className="px-3 py-2 text-right font-semibold text-zinc-600">
                Slip pack
              </th>
              <th className="px-3 py-2 text-right font-semibold text-zinc-600">
                Escrow
              </th>
              <th className="px-3 py-2 text-right font-semibold text-rose-700">
                Revenue
              </th>
              <th className="px-3 py-2 text-right font-semibold text-zinc-600">
                Cost
              </th>
              <th className="px-3 py-2 text-right font-semibold text-emerald-700">
                Net
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {projection.map((p) => (
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
                <td className="px-3 py-1.5 text-right font-mono">
                  ฿{p.escrowRevBaht.toLocaleString()}
                </td>
                <td className="px-3 py-1.5 text-right font-mono font-bold text-rose-700">
                  ฿{p.totalRevenueBaht.toLocaleString()}
                </td>
                <td className="px-3 py-1.5 text-right font-mono text-zinc-500">
                  −฿{p.totalCostBaht.toLocaleString()}
                </td>
                <td className="px-3 py-1.5 text-right font-mono font-bold text-emerald-700">
                  ฿{p.netBaht.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-zinc-200 bg-zinc-50">
            <tr>
              <td className="px-3 py-2 font-bold">12-mo</td>
              <td />
              <td />
              <td className="px-3 py-2 text-right font-mono font-bold">
                ฿{sum(projection, (p) => p.mrrBaht).toLocaleString()}
              </td>
              <td className="px-3 py-2 text-right font-mono font-bold">
                ฿{sum(projection, (p) => p.slipPackRevBaht).toLocaleString()}
              </td>
              <td className="px-3 py-2 text-right font-mono font-bold">
                ฿{sum(projection, (p) => p.escrowRevBaht).toLocaleString()}
              </td>
              <td className="px-3 py-2 text-right font-mono font-bold text-rose-700">
                ฿{sum(projection, (p) => p.totalRevenueBaht).toLocaleString()}
              </td>
              <td className="px-3 py-2 text-right font-mono font-bold text-zinc-600">
                −฿{sum(projection, (p) => p.totalCostBaht).toLocaleString()}
              </td>
              <td className="px-3 py-2 text-right font-mono font-bold text-emerald-700">
                ฿{sum(projection, (p) => p.netBaht).toLocaleString()}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </details>
  );
}

function sum<T>(arr: T[], fn: (t: T) => number) {
  return Math.round(arr.reduce((s, t) => s + fn(t), 0));
}
