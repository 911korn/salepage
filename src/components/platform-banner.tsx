import { getPlatformSetting } from "@/lib/platform-settings";

/// Site-wide announcement banner. Rendered at the top of every public page
/// when `announcement_banner.enabled` is true. Hidden inside /admin and
/// /dashboard layouts already (they have their own).
export async function PlatformBanner() {
  const banner = await getPlatformSetting("announcement_banner");
  if (!banner.enabled || !banner.text) return null;
  const isWarning = banner.tone === "warning";
  return (
    <div
      className={
        isWarning
          ? "border-b border-amber-300 bg-amber-50 text-amber-900"
          : "border-b border-sky-300 bg-sky-50 text-sky-900"
      }
    >
      <div className="mx-auto max-w-7xl px-4 py-2 text-center text-[13px] font-medium sm:px-6 lg:px-8">
        {banner.text}
      </div>
    </div>
  );
}
