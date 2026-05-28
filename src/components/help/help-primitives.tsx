import type { ReactNode } from "react";
import { AlertCircle, Info, Lightbulb, ShieldAlert } from "lucide-react";

/**
 * Help-system primitives — composable building blocks for the seller
 * manual at /dashboard/help/[topic]. The aim is to render rich, illustrated
 * step-by-step guides without touching real screenshot assets (those would
 * go stale the moment we ship any UI change). Every "screenshot" you see
 * in a guide is actually a pure-HTML/CSS mockup with numbered red callout
 * pins and SVG arrows pointing to the relevant element.
 *
 * 911korn 2026-05-28 "ทำเมนู คู่มือ วิธีการใช้เว็บ ทุกๆ เรื่อง · แคปรูปภาพ
 * ทำลูกษรชี้บอก เอาแบบให้คนที่ไม่เข้าใจอะไรเลย ทำตามได้หมดทุกอย่าง".
 */

export function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="relative flex gap-4 py-5 first:pt-0">
      <div className="flex-shrink-0">
        <span className="grid size-9 place-items-center rounded-full bg-[color:var(--color-brand-600)] text-sm font-bold text-white shadow-lg shadow-rose-200">
          {n}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-display text-base font-semibold leading-tight text-zinc-900 sm:text-lg">
          {title}
        </h3>
        <div className="mt-2 space-y-3 text-[14px] leading-relaxed text-zinc-700">
          {children}
        </div>
      </div>
    </li>
  );
}

export function Steps({ children }: { children: ReactNode }) {
  return (
    <ol className="relative ml-1 divide-y divide-zinc-100">{children}</ol>
  );
}

/** A "screenshot" card — wraps the mockup in a styled bezel with a
 *  fake browser/app chrome so it reads as a screenshot. Use
 *  variant="phone" for mobile UI mockups, "browser" for web. */
export function Mock({
  caption,
  variant = "browser",
  children,
}: {
  caption?: string;
  variant?: "browser" | "phone";
  children: ReactNode;
}) {
  return (
    <figure className="my-3">
      <div
        className={
          variant === "phone"
            ? "mx-auto w-full max-w-[280px] overflow-hidden rounded-[28px] border-[4px] border-zinc-900 bg-zinc-900 shadow-2xl shadow-zinc-300"
            : "overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl shadow-zinc-200/60"
        }
      >
        {variant === "browser" ? (
          <div className="flex items-center gap-1.5 border-b border-zinc-100 bg-zinc-50 px-3 py-2">
            <span className="size-2.5 rounded-full bg-rose-400" />
            <span className="size-2.5 rounded-full bg-amber-400" />
            <span className="size-2.5 rounded-full bg-emerald-400" />
            <span className="ml-3 truncate rounded-md bg-white px-2 py-0.5 font-mono text-[10px] text-zinc-500 ring-1 ring-zinc-200">
              salepage.in.th/dashboard
            </span>
          </div>
        ) : null}
        <div className={variant === "phone" ? "bg-white" : "bg-white"}>
          {children}
        </div>
      </div>
      {caption ? (
        <figcaption className="mt-2 text-center text-[11.5px] italic text-zinc-500">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

/** A numbered red callout pin overlaid on a mockup. Use inside an
 *  element with `position: relative` and absolute-position via inline
 *  style or wrapper classes. */
export function Pin({
  n,
  className = "",
  style,
}: {
  n: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={`absolute grid size-7 place-items-center rounded-full bg-rose-600 text-[12px] font-bold text-white shadow-lg shadow-rose-300 ring-2 ring-white ${className}`}
      style={style}
    >
      {n}
    </span>
  );
}

/** An SVG arrow drawn into the mockup. Coordinates are in 0..100 % space
 *  of the mockup's bounding box. Tilt the SVG to match angle. */
export function Arrow({
  from,
  to,
  className = "",
}: {
  from: [number, number];
  to: [number, number];
  className?: string;
}) {
  const [x1, y1] = from;
  const [x2, y2] = to;
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={`pointer-events-none absolute inset-0 size-full ${className}`}
      aria-hidden
    >
      <defs>
        <marker
          id={`arrowhead-${x1}-${y1}-${x2}-${y2}`}
          markerWidth="6"
          markerHeight="6"
          refX="3"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L0,6 L6,3 z" fill="#e11d48" />
        </marker>
      </defs>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="#e11d48"
        strokeWidth="0.5"
        strokeDasharray="1.5,1"
        markerEnd={`url(#arrowhead-${x1}-${y1}-${x2}-${y2})`}
      />
    </svg>
  );
}

/** Annotation legend below a mockup — explains what each pin means. */
export function Legend({
  items,
}: {
  items: Array<{ n: number; label: ReactNode }>;
}) {
  return (
    <ul className="mt-3 space-y-1.5 rounded-2xl bg-zinc-50 p-3.5 text-[13px] text-zinc-700">
      {items.map((i) => (
        <li key={i.n} className="flex items-start gap-2.5">
          <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-rose-600 text-[10px] font-bold text-white">
            {i.n}
          </span>
          <span>{i.label}</span>
        </li>
      ))}
    </ul>
  );
}

export function Tip({ children }: { children: ReactNode }) {
  return (
    <div className="my-3 flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-[13px] text-amber-900">
      <Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-600" />
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}

export function Warn({ children }: { children: ReactNode }) {
  return (
    <div className="my-3 flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-[13px] text-rose-900">
      <ShieldAlert className="mt-0.5 size-4 shrink-0 text-rose-600" />
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return (
    <div className="my-3 flex items-start gap-2.5 rounded-2xl border border-sky-200 bg-sky-50 p-3.5 text-[13px] text-sky-900">
      <Info className="mt-0.5 size-4 shrink-0 text-sky-600" />
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}

export function Heads({ children }: { children: ReactNode }) {
  return (
    <div className="my-3 flex items-start gap-2.5 rounded-2xl border border-zinc-200 bg-white p-3.5 text-[13px] text-zinc-700 shadow-sm">
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-zinc-500" />
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}

export function HelpHeader({
  title,
  intro,
}: {
  title: string;
  intro: string;
}) {
  return (
    <header className="border-b border-zinc-200 pb-6">
      <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
        {title}
      </h1>
      <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-zinc-600">
        {intro}
      </p>
    </header>
  );
}

/** Generic "button" that looks like a real product button — for use
 *  inside Mock components to illustrate clickable UI. Not interactive. */
export function MockButton({
  variant = "primary",
  children,
  className = "",
}: {
  variant?: "primary" | "outline" | "ghost";
  children: ReactNode;
  className?: string;
}) {
  const styles =
    variant === "primary"
      ? "bg-rose-600 text-white shadow-sm"
      : variant === "outline"
        ? "border border-zinc-200 bg-white text-zinc-900"
        : "text-zinc-700";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-semibold ${styles} ${className}`}
    >
      {children}
    </span>
  );
}
