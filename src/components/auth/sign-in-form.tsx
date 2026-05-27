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

interface Props {
  callbackUrl?: string | null;
  hasGoogle: boolean;
  hasApple: boolean;
  hasEmail: boolean;
}

export function SignInForm({
  callbackUrl: callbackUrlParam,
  hasGoogle,
  hasApple,
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

  function onEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
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
      {hasGoogle ? (
        <Button
          variant="outline"
          size="lg"
          className="w-full"
          onClick={() =>
            signIn("google", {
              callbackUrl,
            })
          }
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
          className="w-full bg-black text-white hover:bg-black/90 hover:text-white"
          onClick={() =>
            signIn("apple", {
              callbackUrl,
            })
          }
        >
          <AppleIcon className="size-5" />
          {t("withApple")}
        </Button>
      ) : null}

      {(hasGoogle || hasApple) && hasEmail ? (
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
            disabled={!email}
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
