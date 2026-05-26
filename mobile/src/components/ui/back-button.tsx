import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";

/**
 * Brand back button — a soft-shadowed pill that floats over headers.
 *
 * Used on screens whose header is `headerTransparent: true` (signin, shop
 * detail page) where the default React Navigation chevron looks unmoored
 * against the content beneath. 911korn 2026-05-26 ("ทำดีๆ บอกแล้วอย่าชุ่ย
 * ปุ่ม back ทำให้สวยๆ") flagged the default styling as too plain — this
 * gives the chevron a proper container with a hairline border, drop
 * shadow, and a brand-rose icon that reads as a tappable affordance.
 *
 * `tone="dark"` keeps the chevron dark gray (default — good over white).
 * `tone="light"` switches to white-on-translucent for use over brand-color
 * banners (shop hero).
 */
export function BrandBackButton({
  tone = "dark",
  onPress,
}: {
  tone?: "dark" | "light";
  onPress?: () => void;
}) {
  const isLight = tone === "light";

  return (
    <Pressable
      onPress={onPress ?? (() => router.back())}
      hitSlop={8}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: isLight ? "rgba(15,15,15,0.55)" : "#ffffff",
        borderWidth: isLight ? 0 : 1,
        borderColor: "#e4e4e7",
        // Chunky soft shadow — soft enough not to compete with content,
        // present enough to anchor the button as floating chrome.
        shadowColor: "#0a0a0a",
        shadowOpacity: isLight ? 0 : 0.08,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 6,
        elevation: 2,
        opacity: pressed ? 0.7 : 1,
        transform: [{ scale: pressed ? 0.94 : 1 }],
      })}
      accessibilityRole="button"
      accessibilityLabel="Back"
    >
      <ChevronLeft
        size={22}
        color={isLight ? "#ffffff" : "#0a0a0a"}
        strokeWidth={2.4}
      />
      {/* Tiny brand-rose dot in the bottom-right corner of the button —
          a subtle accent that signals "SalePage chrome" rather than
          generic iOS chevron. */}
      {!isLight ? (
        <View
          style={{
            position: "absolute",
            bottom: 6,
            right: 6,
            width: 5,
            height: 5,
            borderRadius: 2.5,
            backgroundColor: "#e11d48",
          }}
        />
      ) : null}
    </Pressable>
  );
}
