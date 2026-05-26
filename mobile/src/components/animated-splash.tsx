import { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withSequence,
  withSpring,
  runOnJS,
  Easing,
} from "react-native-reanimated";
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Path,
  Circle,
} from "react-native-svg";

/**
 * Animated splash overlay that runs once on cold start, after the native
 * Expo splash hides. Choreography:
 *
 *   0ms     mark   scale 0.6 → 1.0 (spring), opacity 0 → 1 (160ms)
 *   220ms   sheen  diagonal white gloss sweeps across the mark
 *   360ms   word   "Sale|Page" slides up 12px + fades in (220ms)
 *   880ms   hold   beat to let the brand register
 *   1100ms  exit   whole overlay fades to 0 (260ms), then unmounts
 *
 * Replaces the Expo template's static magnifying-glass splash. The native
 * splash still shows for the first ~200ms (font + i18n load), then this
 * overlay sits on top of the app shell with a white background — so the
 * transition reads as one continuous brand moment.
 */
export function AnimatedSplash({ onDone }: { onDone: () => void }) {
  const overlay = useSharedValue(1);
  const markScale = useSharedValue(0.6);
  const markOpacity = useSharedValue(0);
  const wordOpacity = useSharedValue(0);
  const wordY = useSharedValue(12);
  const sheenX = useSharedValue(-1.2);

  useEffect(() => {
    // Mark — spring up + fade in
    markOpacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
    markScale.value = withSpring(1, { damping: 14, stiffness: 150, mass: 0.7 });

    // Sheen — runs once across the mark
    sheenX.value = withDelay(
      220,
      withTiming(1.2, { duration: 520, easing: Easing.inOut(Easing.cubic) }),
    );

    // Wordmark — slides up + fades in slightly after the mark settles
    wordOpacity.value = withDelay(
      360,
      withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) }),
    );
    wordY.value = withDelay(
      360,
      withTiming(0, { duration: 320, easing: Easing.out(Easing.cubic) }),
    );

    // Exit — fade the entire overlay; report done so the parent unmounts us
    overlay.value = withDelay(
      1100,
      withTiming(
        0,
        { duration: 260, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(onDone)();
        },
      ),
    );
  }, [markOpacity, markScale, sheenX, wordOpacity, wordY, overlay, onDone]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlay.value,
  }));
  const markStyle = useAnimatedStyle(() => ({
    opacity: markOpacity.value,
    transform: [{ scale: markScale.value }],
  }));
  const wordStyle = useAnimatedStyle(() => ({
    opacity: wordOpacity.value,
    transform: [{ translateY: wordY.value }],
  }));
  const sheenStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sheenX.value * 120 }, { rotate: "20deg" }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.root, overlayStyle]}
    >
      <Animated.View style={[styles.markBox, markStyle]}>
        <View style={styles.markClip}>
          <Mark />
          <Animated.View style={[styles.sheen, sheenStyle]} />
        </View>
      </Animated.View>

      <Animated.View style={[styles.wordmark, wordStyle]}>
        <Wordmark />
      </Animated.View>
    </Animated.View>
  );
}

function Mark() {
  return (
    <Svg width={108} height={108} viewBox="0 0 40 40">
      <Defs>
        <LinearGradient
          id="sp-anim-grad"
          x1="6"
          y1="6"
          x2="34"
          y2="34"
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0%" stopColor="#fb7185" />
          <Stop offset="55%" stopColor="#e11d48" />
          <Stop offset="100%" stopColor="#9f1239" />
        </LinearGradient>
        <LinearGradient
          id="sp-anim-fold"
          x1="14"
          y1="6"
          x2="6"
          y2="14"
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0%" stopColor="#ffe4e6" />
          <Stop offset="100%" stopColor="#fda4af" />
        </LinearGradient>
      </Defs>
      <Path
        d="M14 6 L34 6 A2 2 0 0 1 36 8 L36 34 A2 2 0 0 1 34 36 L6 36 A2 2 0 0 1 4 34 L4 16 Z"
        fill="url(#sp-anim-grad)"
      />
      <Path d="M14 6 L4 16 L14 16 Z" fill="url(#sp-anim-fold)" />
      <Circle cx="10" cy="13" r="1.4" fill="#9f1239" opacity={0.85} />
      <Path
        d="M25 15.5 H19.5 C17.6 15.5 16 17.1 16 19 C16 20.9 17.6 22.5 19.5 22.5 H23.5 C25.4 22.5 27 24.1 27 26 C27 27.9 25.4 29.5 23.5 29.5 H17.5"
        stroke="white"
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Circle cx={17.5} cy={29.5} r={1.6} fill="white" />
    </Svg>
  );
}

function Wordmark() {
  return (
    <Animated.Text style={styles.wordText}>
      <Animated.Text style={styles.wordSale}>Sale</Animated.Text>
      <Animated.Text style={styles.wordPage}>Page</Animated.Text>
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  markBox: {
    width: 108,
    height: 108,
    alignItems: "center",
    justifyContent: "center",
  },
  markClip: {
    width: 108,
    height: 108,
    overflow: "hidden",
    borderRadius: 24,
  },
  // The diagonal sheen — a tall semi-transparent white stripe that translates
  // across the mark, rotated 20° so it reads as a glass highlight.
  sheen: {
    position: "absolute",
    top: -40,
    bottom: -40,
    left: 0,
    width: 38,
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  wordmark: {
    marginTop: 22,
  },
  wordText: {
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.5,
    color: "#0a0a0a",
  },
  wordSale: {
    color: "#0a0a0a",
  },
  wordPage: {
    color: "#e11d48",
  },
});
