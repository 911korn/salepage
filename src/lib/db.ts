import { PrismaClient } from "@/generated/prisma";
import { PrismaNeon } from "@prisma/adapter-neon";

export { PrismaClient, type Prisma } from "@/generated/prisma";
export {
  PlanKey,
  SubscriptionStatus,
  ShopStatus,
  ProductBadge,
  ProductType,
  ProductCondition,
  ProductStatus,
  OrderStatus,
  CouponType,
  ConversationMessageDirection,
  UserRole,
  KycStatus,
  KycDocType,
  DisputeStatus,
  DisputeReason,
  AffiliatePayoutStatus,
  LiveBroadcastStatus,
  EscrowStatus,
  GroupBuyStatus,
} from "@/generated/prisma";

function makeClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "production"
        ? ["error", "warn"]
        : ["error", "warn"],
  });
}

declare global {
  var __prisma__: PrismaClient | undefined;
}

/**
 * Shared Prisma client.
 *
 * In dev, Next.js HMR re-imports this module on every change. Without the
 * `globalThis` cache we'd exhaust Neon's connection pool within a few edits.
 */
export const db: PrismaClient = globalThis.__prisma__ ?? makeClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma__ = db;
}
