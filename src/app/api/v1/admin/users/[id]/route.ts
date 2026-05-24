import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { logAdminAction, requireAdminApi, requireSuperAdminApi } from "@/lib/admin";
import { db, PlanKey, SubscriptionStatus, UserRole } from "@/lib/db";

const Body = z
  .object({
    role: z.enum(["USER", "ADMIN", "SUPER_ADMIN"]).optional(),
    suspended: z.boolean().optional(),
    plan: z.enum(["FREE", "STARTER", "PRO", "BUSINESS", "AGENCY"]).optional(),
  })
  .refine((b) => b.role !== undefined || b.suspended !== undefined || b.plan !== undefined, {
    message: "ต้องส่ง role, suspended หรือ plan อย่างน้อย 1 ฟิลด์",
  });

interface RouteCtx {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: RouteCtx) {
  const { id } = await params;

  const parsed = await parseJson(request, Body);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  // Role + plan changes require SUPER_ADMIN; suspend only requires ADMIN.
  const guard = body.role || body.plan
    ? await requireSuperAdminApi()
    : await requireAdminApi();
  if (!guard.ok) return guard.response;
  const ctx = guard.ctx;

  const target = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      role: true,
      suspended: true,
      stripeCustomerId: true,
      subscription: {
        select: {
          id: true,
          plan: true,
          status: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
        },
      },
    },
  });
  if (!target) return fail("not_found", "User not found", 404);

  if (target.id === ctx.userId && (body.role || body.suspended)) {
    return fail(
      "self_action_forbidden",
      "ไม่สามารถเปลี่ยน role / suspend ตัวเองได้",
      403,
    );
  }

  const before = {
    role: target.role,
    suspended: target.suspended,
    subscription: target.subscription,
  };
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

  let subscription:
    | {
        id: string;
        plan: PlanKey;
        status: SubscriptionStatus;
        currentPeriodEnd: Date | null;
        cancelAtPeriodEnd: boolean;
      }
    | null
    | undefined;

  if (body.plan !== undefined) {
    subscription = await setUserPlan({
      userId: id,
      email: target.email,
      plan: body.plan as PlanKey,
      existingSubscriptionId: target.subscription?.id ?? null,
      stripeCustomerId: target.stripeCustomerId,
    });
  }

  await logAdminAction(
    ctx.userId,
    body.plan !== undefined
      ? "user.plan_change"
      : body.role !== undefined
        ? "user.role_change"
        : "user.suspend_toggle",
    { type: "user", id },
    {
      before,
      after: {
        role: updated.role,
        suspended: updated.suspended,
        ...(body.plan !== undefined ? { subscription } : {}),
      },
    },
  );

  return ok({ user: updated, subscription });
}

async function setUserPlan({
  userId,
  email,
  plan,
  existingSubscriptionId,
  stripeCustomerId,
}: {
  userId: string;
  email: string;
  plan: PlanKey;
  existingSubscriptionId: string | null;
  stripeCustomerId: string | null;
}) {
  if (plan === PlanKey.FREE) {
    if (!existingSubscriptionId) return null;
    return db.subscription.update({
      where: { id: existingSubscriptionId },
      data: {
        plan,
        status: SubscriptionStatus.CANCELED,
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: true,
      },
      select: {
        id: true,
        plan: true,
        status: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
      },
    });
  }

  const currentPeriodEnd = new Date();
  currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 365);
  const manualId = `admin_${userId}_${Date.now()}`;

  return db.subscription.upsert({
    where: { userId },
    create: {
      userId,
      stripeSubscriptionId: manualId,
      stripeCustomerId: stripeCustomerId ?? `admin_manual_${email}`,
      plan,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodEnd,
      cancelAtPeriodEnd: false,
    },
    update: {
      plan,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodEnd,
      cancelAtPeriodEnd: false,
    },
    select: {
      id: true,
      plan: true,
      status: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
    },
  });
}
