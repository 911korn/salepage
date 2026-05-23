import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db, UserRole } from "@/lib/db";
import { fail } from "@/lib/api";

const ADMIN_ROLES: ReadonlySet<UserRole> = new Set([
  UserRole.ADMIN,
  UserRole.SUPER_ADMIN,
]);

function parseEmailList(value: string | undefined): Set<string> {
  if (!value) return new Set();
  return new Set(
    value
      .split(/[\s,;]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

/// Failsafe seed list. If the User.role column has somehow been wiped (DB
/// restore, manual edit), env-listed emails still get in and can re-grant
/// themselves SUPER_ADMIN. Update via Vercel env, never hardcode.
function isFailsafeAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return parseEmailList(process.env.ADMIN_EMAILS).has(email.toLowerCase());
}

function isFailsafeSuperAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return parseEmailList(process.env.SUPER_ADMIN_EMAILS).has(email.toLowerCase());
}

export interface AdminContext {
  userId: string;
  email: string;
  name: string | null;
  role: UserRole;
  isSuperAdmin: boolean;
}

/// Page-side guard. Redirects to /signin or / if the user isn't an admin.
/// Use inside `/admin/**` layouts and pages.
export async function requireAdmin(): Promise<AdminContext> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin?callbackUrl=/admin");
  }
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, role: true, suspended: true },
  });
  if (!user || user.suspended) {
    redirect("/");
  }
  const failsafe = isFailsafeAdmin(user.email) || isFailsafeSuperAdmin(user.email);
  if (!ADMIN_ROLES.has(user.role) && !failsafe) {
    redirect("/");
  }
  const isSuperAdmin =
    user.role === UserRole.SUPER_ADMIN || isFailsafeSuperAdmin(user.email);
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isSuperAdmin,
  };
}

/// API-side guard. Returns { ctx } on success or { response } with a 401/403.
/// Use at the top of every /api/v1/admin/* route handler.
export async function requireAdminApi(): Promise<
  { ok: true; ctx: AdminContext } | { ok: false; response: Response }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, response: fail("unauthorized", "Sign in required", 401) };
  }
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, role: true, suspended: true },
  });
  if (!user || user.suspended) {
    return { ok: false, response: fail("unauthorized", "Sign in required", 401) };
  }
  const failsafe = isFailsafeAdmin(user.email) || isFailsafeSuperAdmin(user.email);
  if (!ADMIN_ROLES.has(user.role) && !failsafe) {
    return { ok: false, response: fail("forbidden", "Admin access required", 403) };
  }
  const isSuperAdmin =
    user.role === UserRole.SUPER_ADMIN || isFailsafeSuperAdmin(user.email);
  return {
    ok: true,
    ctx: {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isSuperAdmin,
    },
  };
}

/// SUPER_ADMIN-only guard. Use for role grants/revokes + PlatformSetting writes
/// that could lock everyone out (maintenance mode, default plan caps).
export async function requireSuperAdminApi(): Promise<
  { ok: true; ctx: AdminContext } | { ok: false; response: Response }
> {
  const result = await requireAdminApi();
  if (!result.ok) return result;
  if (!result.ctx.isSuperAdmin) {
    return {
      ok: false,
      response: fail("forbidden", "Super-admin access required", 403),
    };
  }
  return result;
}

/// Append-only audit log writer. Never throws — failures are logged to console
/// so the surrounding action still succeeds. Add a row before returning OK
/// from any admin mutation.
export async function logAdminAction(
  actorId: string,
  action: string,
  target?: { type: string; id: string },
  diff?: unknown,
): Promise<void> {
  try {
    await db.adminAuditLog.create({
      data: {
        actorId,
        action,
        targetType: target?.type ?? null,
        targetId: target?.id ?? null,
        diff: (diff as never) ?? undefined,
      },
    });
  } catch (err) {
    console.error("[admin-audit] failed to write log row", { action, target, err });
  }
}

/// True if the currently signed-in user can see /admin. Cheap; safe to call
/// from layouts that want to render an "Admin" link conditionally.
export async function viewerIsAdmin(): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, role: true, suspended: true },
  });
  if (!user || user.suspended) return false;
  if (ADMIN_ROLES.has(user.role)) return true;
  return isFailsafeAdmin(user.email) || isFailsafeSuperAdmin(user.email);
}
