import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { logAdminAction, requireAdminApi, requireSuperAdminApi } from "@/lib/admin";
import { db, UserRole } from "@/lib/db";

const Body = z
  .object({
    role: z.enum(["USER", "ADMIN", "SUPER_ADMIN"]).optional(),
    suspended: z.boolean().optional(),
  })
  .refine((b) => b.role !== undefined || b.suspended !== undefined, {
    message: "ต้องส่ง role หรือ suspended อย่างน้อย 1 ฟิลด์",
  });

interface RouteCtx {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: RouteCtx) {
  const { id } = await params;

  const parsed = await parseJson(request, Body);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  // Role changes require SUPER_ADMIN; suspend only requires ADMIN.
  const guard = body.role
    ? await requireSuperAdminApi()
    : await requireAdminApi();
  if (!guard.ok) return guard.response;
  const ctx = guard.ctx;

  const target = await db.user.findUnique({
    where: { id },
    select: { id: true, email: true, role: true, suspended: true },
  });
  if (!target) return fail("not_found", "User not found", 404);

  if (target.id === ctx.userId && (body.role || body.suspended)) {
    return fail(
      "self_action_forbidden",
      "ไม่สามารถเปลี่ยน role / suspend ตัวเองได้",
      403,
    );
  }

  const before = { role: target.role, suspended: target.suspended };
  const updated = await db.user.update({
    where: { id },
    data: {
      ...(body.role !== undefined ? { role: body.role as UserRole } : {}),
      ...(body.suspended !== undefined ? { suspended: body.suspended } : {}),
    },
    select: { id: true, email: true, role: true, suspended: true },
  });

  // If we just suspended a user, revoke their sessions so they can't keep
  // browsing on the cached cookie.
  if (body.suspended === true) {
    await db.session.deleteMany({ where: { userId: id } });
  }

  await logAdminAction(
    ctx.userId,
    body.role !== undefined ? "user.role_change" : "user.suspend_toggle",
    { type: "user", id },
    { before, after: { role: updated.role, suspended: updated.suspended } },
  );

  return ok({ user: updated });
}
