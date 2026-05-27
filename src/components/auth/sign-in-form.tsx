"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GoogleIcon } from "@/components/ui/google-icon";
import { AppleIcon } from "@/components/ui/apple-icon";
import { LineIcon } from "@/components/ui/line-icon";
import { InAppBrowserBanner } from "@/components/auth/in-app-browser-banner";

interface Props {
  callbackUrl?: string | null;
  hasGoogle: boolean;
  hasApple: boolean;
  hasLine: boolean;
  hasEmail: boolean;
}

export function SignInForm({
  callbackUrl: callbackUrlParam,
  hasGoogle,
  hasApple,
  hasLine,
  hasEmail,
}: Props) {
  const t = useTranslations("auth.signIn");
  const locale = useLocale();
  const callbackUrl = normalizeCallbackUrl(
    callbackUrlParam ?? null,
    locale,
  );
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);
  const [agreed, setAgreed] = useState(false);

  function requireAgree() {
    if (!agreed) {
      toast.error(t("agreeRequired"));
      return false;
    }
    return true;
  }

  function onEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    if (!requireAgree()) return;
    setSubmitting(true);
    startTransition(async () => {
      try {
        const res = await signIn("resend", {
          email,
          callbackUrl,
          redirect: false,
        });
        if (res?.error) {
          toast.error(res.error);
          return;
        }
        toast.success(t("sentTitle"), { description: t("sentDesc") });
        setEmail("");
      } catch (err) {
        toast.error((err as Error).message);
      } finally {
        setSubmitting(false);
      }
    });
  }

  return (
    <div className="space-y-4">
      <InAppBrowserBanner />
      <label className="flex items-start gap-2 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-soft)]/40 p-3 text-[13px] leading-relaxed text-zinc-700">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-[3px] size-4 shrink-0 cursor-pointer accent-rose-600"
        />
        <span>{t("agreeLabel")}</span>
      </label>
      {hasLine ? (
        <Button
          variant="outline"
          size="lg"
          disabled={!agreed}
          className="w-full bg-[#06C755] text-white hover:bg-[#05a847] hover:text-white disabled:bg-[#06C755]/40"
          onClick={() => {
            if (!requireAgree()) return;
            signIn("line", { callbackUrl });
          }}
        >
          <LineIcon className="size-5" />
          {t("withLine")}
        </Button>
      ) : null}
      {hasGoogle ? (
        <Button
          variant="outline"
          size="lg"
          disabled={!agreed}
          className="w-full"
          onClick={() => {
            if (!requireAgree()) return;
            signIn("google", { callbackUrl });
          }}
        >
          <GoogleIcon className="size-5" />
          {t("withGoogle")}
        </Button>
      ) : (
        <Button
          variant="outline"
          size="lg"
          className="w-full opacity-60"
          disabled
          title={t("googleNotConfigured")}
        >
          <GoogleIcon className="size-5" />
          {t("withGoogle")}
        </Button>
      )}

      {hasApple ? (
        <Button
          variant="outline"
          size="lg"
          disabled={!agreed}
          className="w-full bg-black text-white hover:bg-black/90 hover:text-white disabled:bg-black/40"
          onClick={() => {
            if (!requireAgree()) return;
            signIn("apple", { callbackUrl });
          }}
        >
          <AppleIcon className="size-5" />
          {t("withApple")}
        </Button>
      ) : null}

      {(hasGoogle || hasApple || hasLine) && hasEmail ? (
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-[color:var(--color-border)]" />
          <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
            {t("or")}
          </span>
          <span className="h-px flex-1 bg-[color:var(--color-border)]" />
        </div>
      ) : null}

      {hasEmail ? (
        <form onSubmit={onEmail} className="space-y-3">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("emailPlaceholder")}
            prefix={<Mail className="size-4" />}
            autoComplete="email"
            required
            className="h-12"
          />
          <Button
            type="submit"
            size="lg"
            className="w-full"
            loading={pending || submitting}
            disabled={!email || !agreed}
          >
            {t("sendMagicLink")}
          </Button>
        </form>
      ) : null}
    </div>
  );
}

function normalizeCallbackUrl(value: string | null, locale: string) {
  const dashboardPath = `/${locale === "th" ? "" : `${locale}/`}dashboard`;
  if (!value) return dashboardPath;

  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) return dashboardPath;
    if (!url.pathname.startsWith("/dashboard") && !url.pathname.startsWith("/en/dashboard")) {
      return dashboardPath;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return dashboardPath;
  }
}
