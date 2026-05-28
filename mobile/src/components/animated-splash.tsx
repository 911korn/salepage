/* eslint-disable react-hooks/immutability */
import { useEffect, useMemo } from "react";
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
  interpolate,
  type SharedValue,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { AppLogo } from "@/components/brand/app-logo";

/**
 * Gen-Z splash — 911korn 2026-05-26 "ทำอนิเมชั่น Slash ใหม่ ขอแบบ GENZ Style".
 *
 * Loud, playful, sticker-pop energy:
 *   1. Mesh-gradient background slides + rotates underneath everything (peach
 *      → rose → fuchsia). Always moving, never static.
 *   2. Eight confetti chips (rotating squares, circles, stars) explode out
 *      from center, each with its own delay + arc + rotation.
 *   3. Logo "pops" with an overshoot spring (scale 0.3 → 1.15 → 1.0) and a
 *      tiny tilt jitter so it lands with a wink.
 *   4. Outline-ring pulse expands from behind the logo (like a y2k bling
 *      bling effect).
 *   5. Cute "OPEN!" chip rotates in next to the logo (or "พร้อม!" — depends
 *      on locale).
 *   6. Hold for a beat, then everything fades out in 240ms.
 *
 * Total runtime ~1.7s.
 */
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

type Chip = {
  /** Color of the confetti chip. */
  color: string;
  /** Final translation angle (degrees) from center. */
  angle: number;
  /** Final distance in px from center. */
  distance: number;
  /** Shape — square, circle, or "star" (rotated square). */
  shape: "square" | "circle" | "star";
  /** Size in px. */
  size: number;
  /** Rotation in degrees at rest (the chip spins from 0 → this). */
  rotation: number;
  /** Stagger delay (ms) from t=0. */
  delay: number;
};

const CHIPS: Chip[] = [
  { color: "#e11d48", angle: -75, distance: 130, shape: "square", size: 16, rotation: 45, delay: 60 },
  { color: "#fb7185", angle: -25, distance: 150, shape: "circle", size: 12, rotation: 0, delay: 110 },
  { color: "#fbbf24", angle: 25, distance: 145, shape: "star", size: 18, rotation: 220, delay: 80 },
  { color: "#06C755", angle: 80, distance: 135, shape: "square", size: 14, rotation: 30, delay: 170 },
  { color: "#a855f7", angle: 135, distance: 140, shape: "circle", size: 10, rotation: 0, delay: 50 },
  { color: "#fda4af", angle: 180, distance: 155, shape: "star", size: 14, rotation: 180, delay: 200 },
  { color: "#3b82f6", angle: 225, distance: 130, shape: "circle", size: 12, rotation: 0, delay: 90 },
  { color: "#9f1239", angle: 270, distance: 140, shape: "square", size: 16, rotation: 60, delay: 140 },
];

export function AnimatedSplash({ onDone }: { onDone: () => void }) {
  const overlay = useSharedValue(1);

  // Background mesh gradient — slides + rotates continuously.
  const bgShift = useSharedValue(0);
  const bgRotate = useSharedValue(0);

  // Logo pop — overshoot scale + tiny tilt jitter
  const logoScale = useSharedValue(0.3);
  const logoOpacity = useSharedValue(0);
  const logoTilt = useSharedValue(-8);

  // Pulse ring behind logo
  const ringScale = useSharedValue(0);
  const ringOpacity = useSharedValue(0);

  // Confetti drivers — shared progress 0 → 1 per chip
  const chipProgress0 = useSharedValue(0);
  const chipProgress1 = useSharedValue(0);
  const chipProgress2 = useSharedValue(0);
  const chipProgress3 = useSharedValue(0);
  const chipProgress4 = useSharedValue(0);
  const chipProgress5 = useSharedValue(0);
  const chipProgress6 = useSharedValue(0);
  const chipProgress7 = useSharedValue(0);
  const chipProgress = useMemo(
    () =>
      [
        chipProgress0,
        chipProgress1,
        chipProgress2,
        chipProgress3,
        chipProgress4,
        chipProgress5,
        chipProgress6,
        chipProgress7,
      ] as const,
    [
      chipProgress0,
      chipProgress1,
      chipProgress2,
      chipProgress3,
      chipProgress4,
      chipProgress5,
      chipProgress6,
      chipProgress7,
    ],
  );

  // "OPEN!" sticker
  const stickerScale = useSharedValue(0);
  const stickerRotate = useSharedValue(-25);

  useEffect(() => {
    // Background mesh — continuous gentle motion
    bgShift.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    bgRotate.value = withTiming(20, { duration: 1700, easing: Easing.out(Easing.cubic) });

    // Confetti — each chip launches at its own delay
    chipProgress.forEach((sv, idx) => {
      sv.value = withDelay(
        CHIPS[idx].delay,
        withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }),
      );
    });

    // Pulse ring — starts small, expands out
    ringOpacity.value = withDelay(
      120,
      withSequence(
        withTiming(0.4, { duration: 200, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 600, easing: Easing.in(Easing.cubic) }),
      ),
    );
    ringScale.value = withDelay(
      120,
      withTiming(2.4, { duration: 800, easing: Easing.out(Easing.cubic) }),
    );

    // Logo pop — overshoot spring, then a tiny jitter tilt
    logoOpacity.value = withDelay(
      200,
      withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) }),
    );
    logoScale.value = withDelay(
      200,
      withSequence(
        withTiming(1.15, { duration: 280, easing: Easing.out(Easing.back(2.4)) }),
        withSpring(1, { damping: 12, stiffness: 220, mass: 0.6 }),
      ),
    );
    logoTilt.value = withDelay(
      200,
      withSequence(
        withTiming(4, { duration: 280, easing: Easing.out(Easing.cubic) }),
        withSpring(0, { damping: 10, stiffness: 180, mass: 0.6 }),
      ),
    );

    // "OPEN!" sticker — pops in after the logo settles
    stickerScale.value = withDelay(
      540,
      withSequence(
        withTiming(1.2, { duration: 240, easing: Easing.out(Easing.back(3)) }),
        withSpring(1, { damping: 11, stiffness: 200 }),
      ),
    );
    stickerRotate.value = withDelay(
      540,
      withSpring(-12, { damping: 9, stiffness: 130 }),
    );

    // Exit
    overlay.value = withDelay(
      1450,
      withTiming(
        0,
        { duration: 240, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(onDone)();
        },
      ),
    );
  }, [
    bgShift,
    bgRotate,
    chipProgress,
    ringOpacity,
    ringScale,
    logoOpacity,
    logoScale,
    logoTilt,
    stickerScale,
    stickerRotate,
    overlay,
  ]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlay.value }));

  const bgStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(bgShift.value, [0, 1], [-30, 30]) },
      { translateY: interpolate(bgShift.value, [0, 1], [20, -20]) },
      { rotate: `${bgRotate.value}deg` },
      { scale: 1.4 },
    ],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }, { rotate: `${logoTilt.value}deg` }],
  }));

  const stickerStyle = useAnimatedStyle(() => ({
    opacity: stickerScale.value > 0.05 ? 1 : 0,
    transform: [{ scale: stickerScale.value }, { rotate: `${stickerRotate.value}deg` }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.root, overlayStyle]}
    >
      {/* Animated mesh background */}
      <Animated.View style={[styles.bgWrap, bgStyle]}>
        <LinearGradient
          colors={["#fff1f2", "#fda4af", "#f0abfc", "#e11d48"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.bg}
        />
      </Animated.View>

      {/* Soft white veil so the foreground reads cleanly */}
      <View style={styles.veil} />

      {/* Confetti chips */}
      {CHIPS.map((chip, idx) => (
        <ConfettiChip key={idx} chip={chip} progress={chipProgress[idx]!} />
      ))}

      {/* Pulse ring behind the logo */}
      <Animated.View style={[styles.ring, ringStyle]} />

      {/* Logo with overshoot + tilt */}
      <Animated.View style={[styles.logoWrap, logoStyle]}>
        <AppLogo size={56} hero />
      </Animated.View>

      {/* OPEN! sticker */}
      <Animated.View style={[styles.sticker, stickerStyle]}>
        <View style={styles.stickerInner}>
          <View style={styles.stickerDot} />
          <Animated.Text style={styles.stickerText}>OPEN!</Animated.Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

function ConfettiChip({
  chip,
  progress,
}: {
  chip: Chip;
  progress: SharedValue<number>;
}) {
  const radians = (chip.angle * Math.PI) / 180;
  const dx = Math.cos(radians) * chip.distance;
  const dy = Math.sin(radians) * chip.distance;

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: interpolate(p, [0, 0.1, 0.85, 1], [0, 1, 1, 0]),
      transform: [
        { translateX: dx * p },
        { translateY: dy * p - 30 * Math.sin(p * Math.PI) }, // arc — small lift mid-flight
        { rotate: `${chip.rotation * p}deg` },
        { scale: interpolate(p, [0, 0.2, 1], [0.4, 1.1, 0.9]) },
      ],
    };
  });

  const base = {
    width: chip.size,
    height: chip.size,
    backgroundColor: chip.color,
  } as const;
  const shapeStyle =
    chip.shape === "circle"
      ? { ...base, borderRadius: chip.size / 2 }
      : chip.shape === "star"
        ? { ...base, borderRadius: 2, transform: [{ rotate: "45deg" }] as const }
        : { ...base, borderRadius: 3 };

  return <Animated.View style={[styles.chip, shapeStyle, style]} />;
}

const RING_SIZE = 160;

const styles = StyleSheet.create({
  root: {
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  bgWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  bg: {
    flex: 1,
  },
  veil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.78)",
  },
  ring: {
    position: "absolute",
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 4,
    borderColor: "#e11d48",
  },
  chip: {
    position: "absolute",
    // Origin = screen center. Animated transforms move them out.
    left: SCREEN_W / 2 - 8,
    top: SCREEN_H / 2 - 8,
  },
  logoWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  sticker: {
    position: "absolute",
    top: SCREEN_H / 2 - 60,
    right: SCREEN_W / 2 - 100,
  },
  stickerInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "#fde047",
    borderWidth: 2,
    borderColor: "#0a0a0a",
    // y2k chunky shadow
    shadowColor: "#0a0a0a",
    shadowOpacity: 1,
    shadowOffset: { width: 3, height: 3 },
    shadowRadius: 0,
    elevation: 4,
  },
  stickerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#0a0a0a",
  },
  stickerText: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.6,
    color: "#0a0a0a",
  },
});
