import { useEffect } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withSequence,
  withRepeat,
  withSpring,
  runOnJS,
  Easing,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { AppLogo } from "@/components/brand/app-logo";

/**
 * Animated splash overlay that runs once on cold start, after the native
 * Expo splash hides.
 *
 * 911korn 2026-05-26 reviewed the previous version ("เอาอันนี้ออกไปใช้
 * อนิเมชั่นแทน") — the old build wrapped the brand mark in a clipped
 * `overflow: hidden` box + sheen, and on iOS react-native-svg lost its
 * gradient fill so it rendered as a solid red square. This version drops
 * the clip entirely and animates the canonical `<AppLogo />` (which is
 * proven to render correctly on /home, /signin, headers, etc.).
 *
 * Choreography:
 *   0ms     blob   radial brand-tinted blob fades in (180ms)
 *   80ms    logo   AppLogo scales 0.5 → 1.0 spring, opacity 0 → 1 (220ms)
 *   400ms   pulse  three brand-color dots scale up + ripple outward
 *   1000ms  hold   beat
 *   1250ms  exit   whole overlay fades out (260ms), then unmounts
 *
 * Total runtime ~1.5s.
 */
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

export function AnimatedSplash({ onDone }: { onDone: () => void }) {
  const overlay = useSharedValue(1);

  const logoScale = useSharedValue(0.5);
  const logoOpacity = useSharedValue(0);

  const blobScale = useSharedValue(0.4);
  const blobOpacity = useSharedValue(0);

  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  useEffect(() => {
    // Soft radial brand blob backdrop
    blobOpacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
    blobScale.value = withSpring(1, { damping: 18, stiffness: 90, mass: 1.2 });

    // Logo — fade + spring in
    logoOpacity.value = withDelay(
      80,
      withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) }),
    );
    logoScale.value = withDelay(
      80,
      withSpring(1, { damping: 13, stiffness: 160, mass: 0.7 }),
    );

    // Three brand-color dots — staggered ripple. Each goes 0 → 1 → 0 with
    // a tiny lag so they feel like a heartbeat.
    const rippleSpec = withSequence(
      withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) }),
      withTiming(0, { duration: 380, easing: Easing.in(Easing.cubic) }),
    );
    dot1.value = withDelay(400, rippleSpec);
    dot2.value = withDelay(520, rippleSpec);
    dot3.value = withDelay(640, rippleSpec);

    // Exit — fade out the overlay, then unmount
    overlay.value = withDelay(
      1250,
      withTiming(
        0,
        { duration: 260, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(onDone)();
        },
      ),
    );
  }, [blobOpacity, blobScale, logoOpacity, logoScale, dot1, dot2, dot3, overlay]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlay.value }));
  const blobStyle = useAnimatedStyle(() => ({
    opacity: blobOpacity.value,
    transform: [{ scale: blobScale.value }],
  }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));
  const dot1Style = useAnimatedStyle(() => ({
    opacity: dot1.value,
    transform: [{ scale: 0.4 + dot1.value * 0.9 }],
  }));
  const dot2Style = useAnimatedStyle(() => ({
    opacity: dot2.value,
    transform: [{ scale: 0.4 + dot2.value * 0.9 }],
  }));
  const dot3Style = useAnimatedStyle(() => ({
    opacity: dot3.value,
    transform: [{ scale: 0.4 + dot3.value * 0.9 }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.root, overlayStyle]}
    >
      {/* Radial-style brand blob — a wide rose gradient that pulses behind
          the logo. We approximate a radial with a tall LinearGradient inside
          a scaled View; cheaper than rendering an actual radial. */}
      <Animated.View style={[styles.blobWrap, blobStyle]}>
        <LinearGradient
          colors={["#fecdd3", "#ffffff"]}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 1, y: 1 }}
          style={styles.blob}
        />
      </Animated.View>

      {/* Logo — the canonical AppLogo (mark + wordmark) springs in. */}
      <Animated.View style={[styles.logoWrap, logoStyle]}>
        <AppLogo size={56} hero />
      </Animated.View>

      {/* Three pulsing brand-color dots beneath the logo */}
      <View style={styles.dotRow}>
        <Animated.View style={[styles.dot, styles.dotRose, dot1Style]} />
        <Animated.View style={[styles.dot, styles.dotPink, dot2Style]} />
        <Animated.View style={[styles.dot, styles.dotPeach, dot3Style]} />
      </View>
    </Animated.View>
  );
}

const BLOB_SIZE = Math.max(SCREEN_W, SCREEN_H) * 0.9;

const styles = StyleSheet.create({
  root: {
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  blobWrap: {
    position: "absolute",
    width: BLOB_SIZE,
    height: BLOB_SIZE,
    borderRadius: BLOB_SIZE / 2,
    overflow: "hidden",
  },
  blob: {
    flex: 1,
  },
  logoWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  dotRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 28,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotRose: { backgroundColor: "#e11d48" },
  dotPink: { backgroundColor: "#fb7185" },
  dotPeach: { backgroundColor: "#fda4af" },
});

// Suppress unused-imports warning — keeping `withRepeat` available for
// follow-up tweaks if 911korn requests a continuous loop variant.
void withRepeat;
