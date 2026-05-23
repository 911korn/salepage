import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { LogoLockup } from "@/components/ui/logo";

interface Props {
  title: string;
  lastUpdated: string;
  intro: string;
  sections: Array<{ h: string; p: string }>;
}

export function LegalPage({ title, lastUpdated, intro, sections }: Props) {
  return (
    <div className="min-h-screen bg-[color:var(--color-soft)]">
      <header className="border-b border-[color:var(--color-border)] bg-white">
        <div className="container-page flex h-16 items-center justify-between">
          <Link href="/" className="inline-flex">
            <LogoLockup />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-[color:var(--color-fg)]"
          >
            <ArrowLeft className="size-4" /> กลับหน้าแรก
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 text-sm text-zinc-500">{lastUpdated}</p>

        <div className="prose prose-zinc mt-8 max-w-none">
          <p className="text-balance text-[16px] leading-relaxed text-zinc-700">
            {intro}
          </p>

          {sections.map((s, i) => (
            <section key={i} className="mt-7">
              <h2 className="font-display text-xl font-bold tracking-tight">
                {s.h}
              </h2>
              <p className="mt-2 leading-relaxed text-zinc-700">{s.p}</p>
            </section>
          ))}
        </div>
      </article>
    </div>
  );
}
