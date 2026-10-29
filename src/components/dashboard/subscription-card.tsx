"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarClock, CreditCard, Crown } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { Button, buttonStyles } from "@/components/ui/button";

export type SubscriptionKind = "recurring" | "onetime" | "granted" | "none";

export interface SubscriptionSummary {
  kind: SubscriptionKind;
  plan: string | null;
  status: string | null;
  currentPeriodEnd: string | null;
  trialEnd: string | null;
  cancelAtPeriodEnd: boolean;
  hasBillingAccount: boolean;
}

const ENDED = new Set(["CANCELED", "INCOMPLETE_EXPIRED"]);

export function SubscriptionCard({ initial }: { initial: SubscriptionSummary }) {
  const t = useTranslations("dashboard.billing");
  const locale = useLocale();
  const [sub, setSub] = useState(initial);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const fmt = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString(locale === "th" ? "th-TH" : "en-US", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "";

  const ended = sub.status ? ENDED.has(sub.status) : false;
  const active = sub.kind !== "none" && !ended && sub.plan && sub.plan !== "FREE";
  const trialing = sub.status === "TRIALING";

  function change(action: "cancel" | "resume") {
    startTransition(async () => {
      try {
        const res = await fetch("/api/v1/billing/subscription", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const json = (await res.json()) as {
          ok: boolean;
          data?: { cancelAtPeriodEnd: boolean };
          error?: { message?: string };
        };
        if (!json.ok || !json.data) {
          toast.error(json.error?.message ?? t("errorGeneric"));
          return;
        }
        setSub((s) => ({ ...s, cancelAtPeriodEnd: json.data!.cancelAtPeriodEnd }));
        setConfirming(false);
        toast.success(action === "cancel" ? t("canceledToast") : t("resumedToast"));
      } catch {
        toast.error(t("errorGeneric"));
      }
    });
  }

  function openPortal() {
    startTransition(async () => {
      try {
        const res = await fetch("/api/v1/billing/portal", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ locale }),
        });
        const json = (await res.json()) as {
          ok: boolean;
          data?: { url?: string };
          error?: { message?: string };
        };
        if (json.ok && json.data?.url) {
          window.location.href = json.data.url;
          return;
        }
        toast.error(json.error?.message ?? t("errorGeneric"));
      } catch {
        toast.error(t("errorGeneric"));
      }
    });
  }

  let statusLine: string;
  if (!active) statusLine = t("freeLine");
  else if (sub.kind === "granted") statusLine = t("grantedLine");
  else if (sub.kind === "onetime")
    statusLine = t("onetimeLine", { date: fmt(sub.currentPeriodEnd) });
  else if (sub.cancelAtPeriodEnd)
    statusLine = t("endsLine", { date: fmt(sub.currentPeriodEnd) });
  else if (trialing)
    statusLine = t("trialLine", { date: fmt(sub.trialEnd ?? sub.currentPeriodEnd) });
  else statusLine = t("renewsLine", { date: fmt(sub.currentPeriodEnd) });

  return (
    <section
      id="subscription"
      className="scroll-mt-24 rounded-2xl border border-[color:var(--color-border)] bg-white p-4 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-700)]">
          <Crown className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-zinc-500">
            {t("title")}
          </p>
          <p className="font-display mt-0.5 text-lg font-bold text-zinc-900">
            {active ? sub.plan : t("freePlan")}
            {active && trialing && !sub.cancelAtPeriodEnd ? (
              <span className="ml-2 align-middle text-[12px] font-semibold text-amber-600">
                {t("trialBadge")}
              </span>
            ) : null}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-[13px] text-zinc-600">
            <CalendarClock className="size-3.5 shrink-0 text-zinc-400" />
            {statusLine}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {!active || sub.kind === "onetime" ? (
          <Link href="/#pricing" className={buttonStyles({ variant: "primary", size: "sm" })}>
            {active ? t("renewCta") : t("upgradeCta")}
          </Link>
        ) : null}

        {active && sub.kind === "recurring" && sub.cancelAtPeriodEnd ? (
          <Button size="sm" variant="primary" loading={pending} onClick={() => change("resume")}>
            {t("resumeCta")}
          </Button>
        ) : null}

        {active && sub.kind === "recurring" && !sub.cancelAtPeriodEnd && !confirming ? (
          <Button size="sm" variant="danger" onClick={() => setConfirming(true)}>
            {t("cancelCta")}
          </Button>
        ) : null}

        {sub.hasBillingAccount ? (
          <Button size="sm" variant="outline" loading={pending && !confirming} onClick={openPortal}>
            <CreditCard className="size-4" />
            {t("portalCta")}
          </Button>
        ) : null}
      </div>

      {confirming ? (
        <div className="mt-4 rounded-xl border border-[color:var(--color-brand-200)] bg-[color:var(--color-brand-50)] p-3">
          <p className="text-[13px] font-semibold text-zinc-900">{t("confirmTitle")}</p>
          <p className="mt-1 text-[12px] leading-relaxed text-zinc-600">
            {trialing
              ? t("confirmBodyTrial", { date: fmt(sub.trialEnd ?? sub.currentPeriodEnd) })
              : t("confirmBody", { date: fmt(sub.currentPeriodEnd) })}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="danger" loading={pending} onClick={() => change("cancel")}>
              {t("confirmYes")}
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
              {t("confirmNo")}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
