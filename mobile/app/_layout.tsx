import "../global.css";

// CET TELEMETRY FIRST law: init telemetry BEFORE any other module so JS
// errors thrown during early imports/hooks still surface in Sentry. Side-effect
// import order matters — Sentry.init() runs at module load when DSN is set.
import { initSentry, Sentry } from "@/lib/sentry";
initSentry();

// i18n hydrates the saved language from AsyncStorage on first render —
// guard the splash hide until it resolves so the very first frame uses
// the right locale (no TH→EN flash).
import { initI18n, i18n } from "@/lib/i18n";
const i18nReady = initI18n();

// Tiny helper — Stack.Screen options serialize once on render, so we can't
// use the `useTranslation` hook there. Read directly off the i18n instance.
// `i18n.t("nav:stack.foo")` re-renders the navigator only on full screen
// remount, which is fine — language changes are rare.
function tnav(key: string): string {
  return i18n.t(`nav:stack.${key}`) as string;
}

import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useFonts,
  Kanit_400Regular,
  Kanit_700Bold,
} from "@expo-google-fonts/kanit";
import { useEffect, useState } from "react";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import * as Linking from "expo-linking";
import { registerPushToken, deepLinkFromNotification } from "@/lib/push";
import { setAuthToken } from "@/lib/auth";
import { saveReferrer } from "@/lib/affiliate";
import { AppLogo } from "@/components/brand/app-logo";
import { AnimatedSplash } from "@/components/animated-splash";
import { BrandBackButton } from "@/components/ui/back-button";
import { View, Text } from "react-native";

/**
 * Stack header title with the SalePage horizontal lockup centered + the
 * screen name beneath it. Used everywhere via `headerTitle: brandHeader(...)`
 * so brand presence is consistent regardless of which screen the user lands
 * on (911korn 2026-05-26: "ใส่ Logo แอพแนวนอน ไว้ด้วย ทุกหน้า").
 */
function brandHeader(captionKey: string) {
  return function HeaderTitle() {
    return (
      <View style={{ alignItems: "center", justifyContent: "center" }}>
        <AppLogo size={20} />
        <Text
          style={{
            fontFamily: "Kanit-Bold",
            fontSize: 11,
            color: "#737373",
            marginTop: 2,
            letterSpacing: 0.2,
          }}
          numberOfLines={1}
        >
          {tnav(captionKey)}
        </Text>
      </View>
    );
  };
}

SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden — fine
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function RootLayout() {
  const [i18nLoaded, setI18nLoaded] = useState(false);
  // True until the AnimatedSplash overlay finishes its choreography. While
  // it's true the overlay sits on top of the Stack; when false the overlay
  // is unmounted and the user sees the real app. We default to true because
  // we want the brand beat to run on cold start.
  const [splashAnimating, setSplashAnimating] = useState(true);
  useEffect(() => {
    void i18nReady.then(() => setI18nLoaded(true));
  }, []);
  // Kanit (Thai + Latin) — same family as the web. We ship the font as an
  // npm dep (@expo-google-fonts/kanit) so the .ttf is bundled by Metro
  // without us needing to commit binary files to repo. Aliased to "Kanit" /
  // "Kanit-Bold" so existing className styles keep working.
  const [fontsLoaded] = useFonts({
    Kanit: Kanit_400Regular,
    "Kanit-Bold": Kanit_700Bold,
  });

  // Hide the NATIVE splash as soon as fonts are ready — the AnimatedSplash
  // overlay then takes over the brand beat with its choreography. Keeping
  // the native splash up too long means iOS double-flashes the static art
  // before the JS overlay can mount.
  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsLoaded]);

  // Register the device's Expo push token whenever the app launches AND
  // the user is authenticated. Idempotent — safe to call repeatedly.
  useEffect(() => {
    void registerPushToken().catch(() => undefined);
  }, []);

  // Handle deep linking from a tapped notification. The data shape is set by
  // the backend in src/lib/push-notify.ts (e.g. { kind: "order.paid", orderToken }).
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as
        | Parameters<typeof deepLinkFromNotification>[0]
        | undefined;
      const path = deepLinkFromNotification(data ?? null);
      if (path) router.push(path as never);
    });
    return () => sub.remove();
  }, []);

  // Handle Universal Links / custom-scheme URLs. We support:
  //   - salepage://auth?token=<JWT>   → email magic-link sign-in
  //   - salepage://o/<token>          → tracking page (mapped via Expo Router automatically)
  //   - salepage://s/<slug>           → shop page (auto-mapped)
  // We only need a custom handler for `auth` because the others map 1:1 to
  // existing screens by route. Process both the cold-start URL (Linking.getInitialURL)
  // and any while-running URL events (Linking.addEventListener).
  useEffect(() => {
    function handleAuthUrl(url: string | null) {
      if (!url) return;
      let parsed: ReturnType<typeof Linking.parse>;
      try {
        parsed = Linking.parse(url);
      } catch {
        return;
      }
      // Affiliate ref capture — works on ANY incoming link (shop, product,
      // auth, etc.) since shares may carry `?ref=<userId>` regardless of
      // the destination page. Idempotent + best-effort.
      const refUserId = parsed.queryParams?.ref;
      const refCode = parsed.queryParams?.refCode;
      if (typeof refUserId === "string" && refUserId.length >= 3) {
        void saveReferrer({
          userId: refUserId,
          code: typeof refCode === "string" ? refCode : undefined,
        });
      }

      // Match `salepage://auth?token=...` — Expo's parse breaks the scheme out
      // so we look at the hostname.
      if (parsed.hostname !== "auth" && parsed.path !== "auth") return;
      const token = parsed.queryParams?.token;
      if (typeof token !== "string" || token.length < 10) return;
      // Persist immediately so any subsequent fetch already has the token
      // before navigation completes.
      void setAuthToken(token).then(() => {
        void registerPushToken().catch(() => undefined);
        router.replace("/me");
      });
    }

    // Cold-start (app was killed when the link was tapped)
    void Linking.getInitialURL().then(handleAuthUrl);
    // Warm (app already running)
    const sub = Linking.addEventListener("url", (e) => handleAuthUrl(e.url));
    return () => sub.remove();
  }, []);

  if (!fontsLoaded || !i18nLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: "#ffffff" },
              headerTitleStyle: { fontFamily: "Kanit-Bold", fontSize: 16 },
              headerShadowVisible: false,
              contentStyle: { backgroundColor: "#fafafa" },
              // Every Stack header shows the SalePage horizontal lockup as
              // the title, with the screen-specific name as a small caption
              // underneath. Keeping the back button intact (the default
              // `headerLeft` is preserved when `headerTitle` is a function).
              // Screens that need a full-bleed UI (tabs, stories, live, the
              // product detail page) override this with `headerShown: false`.
              headerTitleAlign: "center",
              // Hide the iOS back-button label entirely — only the chevron
              // shows. Without this, pushing from the (tabs) group makes
              // iOS print "tabs" / "me" / "Home" beside the arrow, which
              // 911korn 2026-05-26 flagged as cluttered ("เอาคำว่า tab ออก
              // จากปุ่ม back ทั้งหมด"). "minimal" is the React Navigation 7
              // canonical way; the deprecated `headerBackTitleVisible: false`
              // alias is kept for older iOS versions.
              headerBackButtonDisplayMode: "minimal",
              headerBackTitle: "",
            }}
          >
            {/* The 4 bottom-tab screens live in `app/(tabs)/` with their
                own <Tabs> layout. From the root Stack they look like a
                single screen — push/pop into deep routes still slides
                normally, but tapping between Home / Shops / Orders / Me
                is instant (Shopee-style) because <Tabs> pre-mounts them. */}
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="signin"
              options={{
                // Transparent header so the brand-tinted gradient on the
                // signin screen bleeds up to the status bar, with a soft
                // brand-styled back pill instead of the default chevron
                // (911korn 2026-05-26: "ทำดีๆ บอกแล้วอย่าชุ่ย ปุ่ม back
                // ทำให้สวยๆ").
                headerTransparent: true,
                headerTitle: "",
                headerBackButtonDisplayMode: "minimal",
                headerLeft: () => <BrandBackButton tone="dark" />,
              }}
            />
            <Stack.Screen
              name="s/[slug]/index"
              options={{
                // Transparent header so the colored cover banner reaches
                // the status bar. Light-tone BrandBackButton (white
                // chevron on translucent dark pill) survives any banner
                // color without looking misplaced.
                headerTransparent: true,
                headerTitle: "",
                headerBackButtonDisplayMode: "minimal",
                headerLeft: () => <BrandBackButton tone="light" />,
              }}
            />
            <Stack.Screen
              name="s/[slug]/[productSlug]"
              options={{ headerTransparent: true, headerTitle: "" }}
            />
            <Stack.Screen name="cart" options={{ headerTitle: brandHeader("cart") }} />
            <Stack.Screen
              name="checkout/[token]"
              options={{ headerTitle: brandHeader("checkout"), headerBackVisible: false }}
            />
            <Stack.Screen
              name="checkout/multi"
              options={{ headerTitle: brandHeader("checkoutMulti"), headerBackVisible: false }}
            />
            <Stack.Screen
              name="o/[token]"
              options={{ headerTitle: brandHeader("orderTracking") }}
            />
            <Stack.Screen
              name="me/notifications"
              options={{ headerTitle: brandHeader("meNotifications") }}
            />
            <Stack.Screen name="me/kyc" options={{ headerTitle: brandHeader("meKyc") }} />
            <Stack.Screen
              name="me/addresses"
              options={{ headerTitle: brandHeader("meAddresses") }}
            />
            <Stack.Screen name="me/wallet" options={{ headerTitle: brandHeader("meWallet") }} />
            <Stack.Screen
              name="me/earnings"
              options={{ headerTitle: brandHeader("meEarnings") }}
            />
            <Stack.Screen
              name="o/[token]/dispute"
              options={{ headerTitle: brandHeader("dispute") }}
            />
            <Stack.Screen
              name="o/[token]/review"
              options={{ headerTitle: brandHeader("review") }}
            />
            <Stack.Screen
              name="c/[slug]"
              options={{ headerTitle: brandHeader("category") }}
            />
            <Stack.Screen
              name="stories/[slug]"
              options={{
                headerShown: false,
                presentation: "fullScreenModal",
                animation: "fade",
              }}
            />
            <Stack.Screen
              name="seller/index"
              options={{ headerTitle: brandHeader("sellerHome") }}
            />
            <Stack.Screen
              name="seller/orders"
              options={{ headerTitle: brandHeader("sellerOrders") }}
            />
            <Stack.Screen
              name="seller/products"
              options={{ headerTitle: brandHeader("sellerProducts") }}
            />
            <Stack.Screen
              name="seller/products/new"
              options={{ headerTitle: brandHeader("sellerProductsNew") }}
            />
            <Stack.Screen
              name="seller/shop-settings"
              options={{ headerTitle: brandHeader("shopSettings") }}
            />
            <Stack.Screen
              name="seller/stories"
              options={{ headerTitle: brandHeader("sellerStories") }}
            />
            <Stack.Screen
              name="seller/stories/new"
              options={{ headerTitle: brandHeader("sellerStoriesNew") }}
            />
            <Stack.Screen
              name="seller/live"
              options={{ headerTitle: brandHeader("sellerLive") }}
            />
            <Stack.Screen
              name="seller/live/new"
              options={{ headerTitle: brandHeader("sellerLiveNew") }}
            />
            <Stack.Screen
              name="live/[id]"
              options={{
                headerShown: false,
                presentation: "fullScreenModal",
                animation: "fade",
              }}
            />
            <Stack.Screen
              name="seller/chat"
              options={{ headerTitle: brandHeader("sellerChat") }}
            />
            <Stack.Screen name="seller/chat/[id]" options={{ headerTitle: "" }} />
            <Stack.Screen
              name="seller/group-buys"
              options={{ headerTitle: brandHeader("sellerGroupBuys") }}
            />
            <Stack.Screen
              name="seller/group-buys/new"
              options={{ headerTitle: brandHeader("sellerGroupBuysNew") }}
            />
            <Stack.Screen
              name="group-buy/[id]"
              options={{ headerTitle: brandHeader("groupBuy") }}
            />
          </Stack>
          {/* Animated brand splash. Rendered AFTER <Stack> so it sits on top
              via React Native's render-order z-stacking. Unmounts as soon as
              its fade-out finishes (~1.4s after cold start). */}
          {splashAnimating ? (
            <AnimatedSplash onDone={() => setSplashAnimating(false)} />
          ) : null}
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// `Sentry.wrap` mounts an ErrorBoundary at the root + native-crash reporter.
// When DSN is missing it falls back to a pass-through wrapper so dev/Expo Go
// stays unaffected.
export default Sentry.wrap(RootLayout);
