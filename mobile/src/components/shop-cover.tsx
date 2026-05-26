import { View, Text } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

/**
 * Default shop cover for shops that haven't uploaded a banner yet.
 *
 * The plain `themeColor` solid block we used before looked unprofessional
 * (911korn's feedback: "โล้นๆ แดงๆ ดูตลก"). This component renders a
 * branded fallback so empty banners still look intentional:
 *
 *   - vertical gradient from shop.themeColor → lightened mix-with-white
 *   - 3 low-opacity white blobs as a soft pattern
 *   - large shop initial / logo centered (logoUrl wins if provided)
 *   - small "SalePage" wordmark in the top-right so buyers know it's
 *     a SalePage shop, not a third-party banner
 *
 * Drop it in wherever we used to render `<View style={{backgroundColor:
 * shop.themeColor}} />` — same prop API (themeColor, logoText, logoUrl,
 * shop name).
 */
export function ShopCoverFallback({
  themeColor,
  logoText,
  logoUrl,
  shopName,
  height = 96,
  showWordmark = true,
}: {
  themeColor: string;
  logoText: string | null;
  logoUrl: string | null;
  shopName: string;
  /** Pixel height of the cover. Cards use 96; shop hero uses 144. */
  height?: number;
  /** Set false to hide the "SalePage" wordmark (e.g. when used in the
   *  shop's own page hero where it's redundant). */
  showWordmark?: boolean;
}) {
  const lighter = mixWithWhite(themeColor, 0.45);

  return (
    <View
      className="w-full overflow-hidden"
      style={{ height, backgroundColor: themeColor }}
    >
      {/* Vertical gradient — themeColor at top, lighter at bottom. */}
      <LinearGradient
        colors={[themeColor, lighter]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.6, y: 1 }}
        style={{ position: "absolute", inset: 0 }}
      />

      {/* Decorative blobs — random-ish circles in low-opacity white so the
          cover doesn't read as flat. Sized + positioned to feel intentional
          but stay out of the way of the centered logo. */}
      <View
        className="absolute rounded-full bg-white/20"
        style={{
          width: height * 0.9,
          height: height * 0.9,
          top: -height * 0.35,
          right: -height * 0.15,
        }}
      />
      <View
        className="absolute rounded-full bg-white/10"
        style={{
          width: height * 0.55,
          height: height * 0.55,
          bottom: -height * 0.25,
          left: height * 0.12,
        }}
      />
      <View
        className="absolute rounded-full bg-white/15"
        style={{
          width: height * 0.3,
          height: height * 0.3,
          top: height * 0.2,
          left: height * 0.6,
        }}
      />

      {/* "SalePage" wordmark — tiny, top-right, semi-transparent so it
          doesn't compete with the shop name. */}
      {showWordmark ? (
        <View className="absolute right-2.5 top-2 rounded-full bg-white/85 px-2 py-0.5">
          <Text className="text-[9px] font-bold tracking-tight text-fg">
            Sale<Text className="text-brand-600">Page</Text>
          </Text>
        </View>
      ) : null}

      {/* Center: shop logo image OR shop initial in big white text. */}
      <View className="flex-1 items-center justify-center">
        {logoUrl ? (
          <View
            className="overflow-hidden rounded-2xl border-2 border-white/40 bg-white/10"
            style={{ width: height * 0.55, height: height * 0.55 }}
          >
            <Image
              source={{ uri: logoUrl }}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
            />
          </View>
        ) : (
          <Text
            className="font-bold text-white"
            style={{
              fontSize: height * 0.4,
              lineHeight: height * 0.42,
              textShadowColor: "rgba(0,0,0,0.15)",
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 2,
            }}
            numberOfLines={1}
          >
            {logoText ?? shopName.slice(0, 1).toUpperCase()}
          </Text>
        )}
      </View>
    </View>
  );
}

/**
 * Drop-in cover renderer — picks between the user's uploaded banner and
 * the branded fallback. Use this everywhere we previously did
 * `bannerUrls[0] ? <Image .../> : <View style={{backgroundColor: themeColor}}/>`.
 */
export function ShopCover({
  bannerUrl,
  themeColor,
  logoText,
  logoUrl,
  shopName,
  height = 96,
  showWordmark = true,
}: {
  bannerUrl: string | null | undefined;
  themeColor: string;
  logoText: string | null;
  logoUrl: string | null;
  shopName: string;
  height?: number;
  showWordmark?: boolean;
}) {
  if (bannerUrl) {
    return (
      <View
        className="w-full overflow-hidden"
        style={{ height, backgroundColor: themeColor }}
      >
        <Image
          source={{ uri: bannerUrl }}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
        />
      </View>
    );
  }
  return (
    <ShopCoverFallback
      themeColor={themeColor}
      logoText={logoText}
      logoUrl={logoUrl}
      shopName={shopName}
      height={height}
      showWordmark={showWordmark}
    />
  );
}

/**
 * Blend hex color with white by `amount` (0..1). 0 returns the color
 * unchanged, 1 returns pure white. We use it to compute the bottom of
 * the cover gradient so dark brand colors (slate-900, rose-700) still
 * fade to something visually distinct.
 */
function mixWithWhite(hex: string, amount: number): string {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return hex;
  const num = parseInt(m[1]!, 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  r = Math.round(r + (255 - r) * amount);
  g = Math.round(g + (255 - g) * amount);
  b = Math.round(b + (255 - b) * amount);
  const hexVal = ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
  return `#${hexVal}`;
}
