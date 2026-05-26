import { View, Text } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Path, Circle } from "react-native-svg";

/**
 * SalePage horizontal lockup: gradient "shopping tag with S-curl" icon
 * paired with "Sale" (ink) + "Page" (brand red) wordmark.
 *
 * Matches the canonical web lockup at /public/brand/salepage-lockup.svg.
 * Icon is rendered as react-native-svg paths so it stays sharp at any size;
 * the wordmark uses native <Text> with system fallbacks because Kanit isn't
 * shipped as an app font yet (drop-in upgrade later if we want pixel match).
 *
 * Usage:
 *   <AppLogo size={32} />        // typical header
 *   <AppLogo size={56} hero />   // signin hero
 *   <AppLogo size={28} mono />   // monochrome variant for dark surfaces
 */
export function AppLogo({
  size = 32,
  hero = false,
  mono = false,
}: {
  size?: number;
  hero?: boolean;
  mono?: boolean;
}) {
  const iconSize = size;
  const fontSize = Math.round(size * 0.7);
  const gap = Math.round(size * 0.22);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="SalePage"
      style={{ flexDirection: "row", alignItems: "center", gap }}
    >
      <Mark size={iconSize} mono={mono} />
      <Text
        style={{
          fontSize,
          fontWeight: hero ? "800" : "700",
          letterSpacing: -0.5,
          color: mono ? "#ffffff" : "#0a0a0a",
        }}
      >
        Sale
        <Text style={{ color: mono ? "#ffffff" : "#e11d48" }}>Page</Text>
      </Text>
    </View>
  );
}

function Mark({ size, mono }: { size: number; mono: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Defs>
        <LinearGradient id="sp-grad" x1="2" y1="2" x2="38" y2="38" gradientUnits="userSpaceOnUse">
          <Stop offset="0%" stopColor={mono ? "#ffffff" : "#fb7185"} />
          <Stop offset="55%" stopColor={mono ? "#ffffff" : "#e11d48"} />
          <Stop offset="100%" stopColor={mono ? "#ffffff" : "#9f1239"} />
        </LinearGradient>
        <LinearGradient id="sp-fold" x1="18" y1="2" x2="2" y2="18" gradientUnits="userSpaceOnUse">
          <Stop offset="0%" stopColor={mono ? "#cbd5e1" : "#ffe4e6"} />
          <Stop offset="100%" stopColor={mono ? "#94a3b8" : "#fda4af"} />
        </LinearGradient>
      </Defs>
      <Path
        d="M14 6 L34 6 A2 2 0 0 1 36 8 L36 34 A2 2 0 0 1 34 36 L6 36 A2 2 0 0 1 4 34 L4 16 Z"
        fill="url(#sp-grad)"
      />
      <Path d="M14 6 L4 16 L14 16 Z" fill="url(#sp-fold)" />
      <Circle cx="10" cy="13" r="1.4" fill={mono ? "#9f1239" : "#9f1239"} opacity={0.85} />
      <Path
        d="M25 15.5 H19.5 C17.6 15.5 16 17.1 16 19 C16 20.9 17.6 22.5 19.5 22.5 H23.5 C25.4 22.5 27 24.1 27 26 C27 27.9 25.4 29.5 23.5 29.5 H17.5"
        stroke="white"
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Circle cx="17.5" cy="29.5" r="1.6" fill="white" />
    </Svg>
  );
}
