import { getTranslations } from "next-intl/server";
import type { LucideIcon } from "lucide-react";
import { Sparkles } from "lucide-react";

interface Props {
  title: string;
  icon?: LucideIcon;
}

export async function ComingSoon({ title, icon: Icon = Sparkles }: Props) {
  const t = await getTranslations("dashboard.common");
  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-3xl border border-dashed border-[color:var(--color-border)] bg-white p-10 text-center sm:p-14">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-700)]">
          <Icon className="size-7" />
        </div>
        <h1 className="font-display mt-5 text-2xl font-bold tracking-tight sm:text-3xl">
          {title}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-balance text-[15px] leading-relaxed text-zinc-600">
          {t("comingSoon")} — {t("comingSoonDesc")}
        </p>
      </div>
    </div>
  );
}
