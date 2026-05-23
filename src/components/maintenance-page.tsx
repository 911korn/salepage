import { Wrench } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { LogoMark, Wordmark } from "@/components/ui/logo";

interface Props {
  message: string;
  viewerIsAdmin: boolean;
}

/// Full-page maintenance UI rendered in place of the storefront when
/// platform setting `maintenance_mode.enabled` is true. Admins see an
/// extra "bypass" hint.
export function MaintenancePage({ message, viewerIsAdmin }: Props) {
  return (
    <main className="grid min-h-[calc(100vh-6rem)] place-items-center bg-[color:var(--color-soft)] px-4 py-12">
      <div className="w-full max-w-md rounded-3xl border border-[color:var(--color-border)] bg-white p-8 text-center shadow-sm">
        <Link href="/" className="inline-flex items-center gap-2">
          <LogoMark />
          <Wordmark />
        </Link>
        <span className="mx-auto mt-6 grid size-14 place-items-center rounded-2xl bg-amber-50 text-amber-700">
          <Wrench className="size-7" />
        </span>
        <h1 className="font-display mt-4 text-xl font-bold tracking-tight sm:text-2xl">
          ระบบกำลังปรับปรุง
        </h1>
        <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-zinc-600">
          {message}
        </p>
        {viewerIsAdmin ? (
          <p className="mt-4 rounded-xl bg-zinc-100 px-3 py-2 text-[12px] text-zinc-600">
            คุณเข้าใน <code className="font-mono">/admin/settings</code> เพื่อปิด
            maintenance mode ได้ทันที
          </p>
        ) : null}
      </div>
    </main>
  );
}
