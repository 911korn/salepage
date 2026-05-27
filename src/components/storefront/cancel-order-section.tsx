"use client";

import { useState } from "react";
import { Loader2, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";

/**
 * Small cancel-order CTA mounted at the very bottom of /o/[token].
 *
 * Used to sit inside TrackingPanel as a prominent red card right under
 * the QR — way too easy to tap by accident when scrolling through the
 * payment flow. 911korn 2026-05-27: "ย้ายปุ่มยกเลิก Order ไปไว้ล่างสุด
 * ป้องกันกดผิด". Now it lives below the shop card so the buyer has
 * to scroll past everything else before they can hit it.
 *
 * Style is deliberately understated — small text link, not a button.
 * The confirm dialog still requires an explicit OK, so this is two
 * deliberate taps instead of one.
 */
export function CancelOrderSection({ token }: { token: string }) {
  const t = useTranslations("order.tracking");
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);

  async function cancel() {
    if (!confirm(t("cancelConfirm"))) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/v1/orders/${token}/cancel`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        toast.error(json.error?.message ?? t("cancelFailed"));
        return;
      }
      toast.success(t("cancelledToast"));
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("cancelFailed"));
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="mt-2 flex justify-center pt-2">
      <button
        type="button"
        onClick={cancel}
        disabled={cancelling}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-[12px] text-zinc-400 underline-offset-2 hover:text-rose-600 hover:underline disabled:opacity-60"
      >
        {cancelling ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <XCircle className="size-3" />
        )}
        {t("cancelAction")}
      </button>
    </div>
  );
}
