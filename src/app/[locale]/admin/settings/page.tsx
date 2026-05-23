import { PageHeader } from "@/components/admin/page-header";
import { SettingsForm } from "@/components/admin/settings-form";
import { requireAdmin } from "@/lib/admin";
import { getAllPlatformSettings } from "@/lib/platform-settings";

export default async function AdminSettingsPage() {
  const viewer = await requireAdmin();
  const settings = await getAllPlatformSettings();

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title="Platform settings"
        description="ค่าระดับแพลตฟอร์ม — ผลทันทีหลังบันทึก"
      />
      <SettingsForm
        viewerIsSuperAdmin={viewer.isSuperAdmin}
        initial={settings}
      />
    </div>
  );
}

export const dynamic = "force-dynamic";
