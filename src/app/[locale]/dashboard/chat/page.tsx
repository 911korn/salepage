import { MessageCircle, Sparkles } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { db } from "@/lib/db";
import { requireDashboardSession } from "@/lib/dashboard";
import { hasBusinessPlan } from "@/lib/plan";
import { ChatInbox } from "@/components/dashboard/chat-inbox";
import { LineConfigForm } from "@/components/dashboard/line-config-form";
import type { Locale } from "@/i18n/routing";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { user, shops } = await requireDashboardSession();
  const activeShop = shops[0];
  if (!activeShop) return null;

  const eligible = await hasBusinessPlan(user.id);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <div className="flex items-center gap-2">
          <MessageCircle className="size-5 text-[color:var(--color-brand-600)]" />
          <h1 className="font-display text-2xl font-bold tracking-tight">
            LINE Inbox
          </h1>
          <Badge tone="soft-brand" className="ml-1">
            Business+
          </Badge>
        </div>
        <p className="mt-1 text-[13px] text-zinc-500">
          รับ-ส่งข้อความ LINE OA ของร้านในที่เดียว — เชื่อมผ่าน LINE Messaging API
        </p>
      </header>

      {!eligible ? <UpgradePrompt /> : <EligibleChat shopId={activeShop.id} shopSlug={activeShop.slug} />}
    </div>
  );
}

function UpgradePrompt() {
  return (
    <div className="rounded-3xl border-2 border-dashed border-[color:var(--color-brand-200)] bg-[color:var(--color-brand-50)]/50 p-8 text-center">
      <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[color:var(--color-brand-100)] text-[color:var(--color-brand-700)]">
        <Sparkles className="size-7" />
      </div>
      <h2 className="font-display mt-5 text-xl font-bold sm:text-2xl">
        ฟีเจอร์นี้สำหรับ Business ขึ้นไป
      </h2>
      <p className="mx-auto mt-2 max-w-md text-balance text-[14px] text-zinc-600">
        LINE Inbox ฝังกล่องข้อความ LINE OA ของร้านเข้ามาในหน้า dashboard
        ตอบลูกค้าได้โดยไม่ต้องเปิดแอป LINE — รวมประวัติแชทกับออเดอร์ในที่เดียว
      </p>
      <ul className="mx-auto mt-4 max-w-md space-y-1 text-left text-[13px] text-zinc-600">
        <li className="flex items-start gap-2">
          <span className="text-emerald-600">✓</span> รับข้อความ LINE OA ผ่าน Messaging API webhook
        </li>
        <li className="flex items-start gap-2">
          <span className="text-emerald-600">✓</span> ตอบกลับได้จาก dashboard ส่งกลับผ่าน LINE
        </li>
        <li className="flex items-start gap-2">
          <span className="text-emerald-600">✓</span> เก็บประวัติแชทพร้อม unread counter
        </li>
      </ul>
      <Link
        href="/#pricing"
        className={cn(buttonStyles({ size: "lg" }), "mt-6")}
      >
        ดูแพ็กเกจ Business
      </Link>
    </div>
  );
}

async function EligibleChat({
  shopId,
  shopSlug,
}: {
  shopId: string;
  shopSlug: string;
}) {
  const shop = await db.shop.findUnique({
    where: { id: shopId },
    select: {
      lineChannelId: true,
      lineChannelSecret: true,
      lineChannelAccessToken: true,
      lineWebhookEnabled: true,
    },
  });

  const configured =
    !!shop?.lineChannelId &&
    !!shop?.lineChannelSecret &&
    !!shop?.lineChannelAccessToken;

  const conversations = configured
    ? await db.conversation.findMany({
        where: { shopId },
        orderBy: { lastMessageAt: "desc" },
        take: 100,
      })
    : [];

  return (
    <div className="space-y-6">
      {configured && shop?.lineWebhookEnabled ? (
        <ChatInbox
          shopSlug={shopSlug}
          initialConversations={conversations.map((c) => ({
            id: c.id,
            customerLineUserId: c.customerLineUserId,
            customerName: c.customerName,
            customerAvatar: c.customerAvatar,
            lastMessageAt: c.lastMessageAt.toISOString(),
            lastMessageText: c.lastMessageText,
            unreadCount: c.unreadCount,
          }))}
        />
      ) : null}

      <details
        open={!configured || !shop?.lineWebhookEnabled}
        className="group rounded-2xl border border-[color:var(--color-border)] bg-white p-5"
      >
        <summary className="cursor-pointer font-display text-base font-semibold">
          {configured ? "การตั้งค่า LINE" : "เชื่อม LINE OA ของคุณ"}
        </summary>
        <div className="mt-4">
          <LineConfigForm
            shopId={shopId}
            shopSlug={shopSlug}
            initial={{
              lineChannelId: shop?.lineChannelId ?? "",
              lineChannelSecret: shop?.lineChannelSecret ?? "",
              lineChannelAccessToken: shop?.lineChannelAccessToken ?? "",
              lineWebhookEnabled: shop?.lineWebhookEnabled ?? false,
            }}
          />
        </div>
      </details>
    </div>
  );
}
