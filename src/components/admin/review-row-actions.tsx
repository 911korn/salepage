"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";

interface Props {
  reviewId: string;
}

export function ReviewRowActions({ reviewId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function remove() {
    if (!window.confirm("ลบรีวิวนี้? ไม่สามารถกู้คืนได้")) return;
    startTransition(async () => {
      const res = await fetch(`/api/v1/admin/reviews/${reviewId}`, {
        method: "DELETE",
      });
      const json = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!res.ok || !json.ok) {
        toast.error(json.error?.message ?? "ลบรีวิวไม่สำเร็จ");
        return;
      }
      toast.success("ลบรีวิวแล้ว");
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={pending}
      title="ลบรีวิว"
      className="grid size-8 shrink-0 place-items-center rounded-lg border border-zinc-200 bg-white text-zinc-500 hover:border-red-300 hover:bg-red-50 hover:text-red-600"
    >
      <Trash2 className="size-4" />
    </button>
  );
}
