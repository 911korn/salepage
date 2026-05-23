"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { UserRole } from "@/lib/db";

interface Props {
  viewerIsSuperAdmin: boolean;
  viewerId: string;
  user: {
    id: string;
    email: string;
    role: UserRole;
    suspended: boolean;
  };
}

const ROLE_OPTIONS: UserRole[] = ["USER", "ADMIN", "SUPER_ADMIN"] as UserRole[];

export function UserActions({ viewerIsSuperAdmin, viewerId, user }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [role, setRole] = useState<UserRole>(user.role);

  const isSelf = viewerId === user.id;

  function patch(body: Record<string, unknown>, successMsg: string) {
    startTransition(async () => {
      const res = await fetch(`/api/v1/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!res.ok || !json.ok) {
        toast.error(json.error?.message ?? "ทำรายการไม่สำเร็จ");
        return;
      }
      toast.success(successMsg);
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5">
      <h2 className="font-display text-base font-semibold">การจัดการ</h2>

      {viewerIsSuperAdmin ? (
        <div className="mt-4">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Role
          </label>
          <div className="mt-1.5 flex gap-2">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              disabled={pending || isSelf}
              className="h-10 flex-1 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="primary"
              disabled={pending || role === user.role || isSelf}
              onClick={() => patch({ role }, `เปลี่ยน role เป็น ${role} แล้ว`)}
            >
              อัปเดต
            </Button>
          </div>
          {isSelf ? (
            <p className="mt-1 text-[11px] text-amber-700">
              ไม่สามารถเปลี่ยน role ของตัวเองได้
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 text-[12px] text-zinc-500">
          ต้องเป็น SUPER_ADMIN ถึงจะเปลี่ยน role ผู้ใช้ได้
        </p>
      )}

      <div className="mt-4">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          การเข้าใช้งาน
        </label>
        <div className="mt-1.5">
          {user.suspended ? (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                patch({ suspended: false }, "ยกเลิก suspend แล้ว — ผู้ใช้เข้าใช้งานได้")
              }
            >
              ยกเลิก suspend
            </Button>
          ) : (
            <Button
              size="sm"
              variant="danger"
              disabled={pending || isSelf}
              onClick={() => {
                if (
                  !window.confirm(
                    `Suspend ${user.email}? ผู้ใช้จะ login ไม่ได้จนกว่าจะปลดล็อก`,
                  )
                )
                  return;
                patch({ suspended: true }, "Suspend ผู้ใช้แล้ว");
              }}
            >
              Suspend ผู้ใช้
            </Button>
          )}
        </div>
        {isSelf ? (
          <p className="mt-1 text-[11px] text-amber-700">
            ไม่สามารถ suspend ตัวเองได้
          </p>
        ) : null}
      </div>
    </div>
  );
}
