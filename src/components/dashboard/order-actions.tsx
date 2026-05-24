"use client";

import { useState, useTransition } from "react";
import { Check, Link2, PackageCheck, Truck, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type OrderStatus =
  | "PENDING"
  | "PAID"
  | "SHIPPING"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

interface Props {
  token: string;
  currentStatus: OrderStatus;
  trackingNumber: string | null;
  shippingManaged?: boolean;
}

export function OrderActions({
  token,
  currentStatus,
  trackingNumber,
  shippingManaged = false,
}: Props) {
  const t = useTranslations("dashboard.orders.detail");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tracking, setTracking] = useState(trackingNumber ?? "");

  async function patchOrder(body: Record<string, unknown>) {
    return new Promise<void>((resolve) =>
      startTransition(async () => {
        try {
          const res = await fetch(`/api/v1/orders/${token}/status`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          });
          const json = await res.json();
          if (!res.ok || !json.ok) {
            toast.error(t("errors.updateFailed"), {
              description: json.error?.message,
            });
            return;
          }
          toast.success(t("actions.save"));
          router.refresh();
        } catch (e) {
          toast.error(t("errors.updateFailed"), {
            description: e instanceof Error ? e.message : "network error",
          });
        } finally {
          resolve();
        }
      }),
    );
  }

  const canShip = currentStatus === "PAID" && !shippingManaged;
  const canMarkPaid = currentStatus === "PENDING";
  const canDeliver = currentStatus === "SHIPPING";
  const canCancel =
    currentStatus === "PENDING" ||
    currentStatus === "PAID" ||
    currentStatus === "SHIPPING";

  return (
    <section className="rounded-3xl border border-[color:var(--color-border)] bg-white p-5 sm:p-6">
      <h2 className="font-display mb-3 text-base font-semibold">Actions</h2>

      <div className="space-y-3">
        {!shippingManaged ? (
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              {t("trackingNumber")}
            </label>
            <Input
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              placeholder={t("trackingPlaceholder")}
              disabled={currentStatus === "CANCELLED" || currentStatus === "REFUNDED"}
            />
            {tracking !== (trackingNumber ?? "") ? (
              <Button
                size="sm"
                variant="outline"
                className="mt-2 w-full"
                loading={pending}
                onClick={() => patchOrder({ trackingNumber: tracking })}
              >
                <Check className="size-4" /> {t("actions.save")}
              </Button>
            ) : null}
          </div>
        ) : null}

        <Button
          size="md"
          className={cn("w-full", !canMarkPaid && "hidden")}
          loading={pending}
          onClick={() => patchOrder({ status: "PAID" })}
        >
          <Check className="size-4" /> {t("actions.markPaid")}
        </Button>

        <Button
          size="md"
          className={cn("w-full", !canShip && "hidden")}
          loading={pending}
          onClick={() =>
            patchOrder({
              status: "SHIPPING",
              trackingNumber: tracking || undefined,
            })
          }
        >
          <Truck className="size-4" /> {t("actions.markShipping")}
        </Button>

        <Button
          size="md"
          className={cn("w-full", !canDeliver && "hidden")}
          loading={pending}
          onClick={() => patchOrder({ status: "DELIVERED" })}
        >
          <PackageCheck className="size-4" /> {t("actions.markDelivered")}
        </Button>

        <Button
          size="md"
          variant="danger"
          className={cn("w-full", !canCancel && "hidden")}
          loading={pending}
          onClick={() => {
            if (confirm(t("actions.cancel") + "?")) {
              patchOrder({ status: "CANCELLED" });
            }
          }}
        >
          <X className="size-4" /> {t("actions.cancel")}
        </Button>

        <Button
          size="md"
          variant="outline"
          className="w-full"
          onClick={() => {
            const url = `${location.origin}/o/${token}`;
            navigator.clipboard.writeText(url);
            toast.success(t("actions.linkCopied"));
          }}
        >
          <Link2 className="size-4" /> {t("actions.copyTrackingLink")}
        </Button>
      </div>
    </section>
  );
}
