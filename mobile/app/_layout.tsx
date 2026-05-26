import "../global.css";

// CET TELEMETRY FIRST law: init telemetry BEFORE any other module so JS
// errors thrown during early imports/hooks still surface in Sentry. Side-effect
// import order matters — Sentry.init() runs at module load when DSN is set.
import { initSentry, Sentry } from "@/lib/sentry";
initSentry();

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
import { useEffect } from "react";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import * as Linking from "expo-linking";
import { registerPushToken, deepLinkFromNotification } from "@/lib/push";
import { setAuthToken } from "@/lib/auth";
import { saveReferrer } from "@/lib/affiliate";

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
  // Kanit (Thai + Latin) — same family as the web. We ship the font as an
  // npm dep (@expo-google-fonts/kanit) so the .ttf is bundled by Metro
  // without us needing to commit binary files to repo. Aliased to "Kanit" /
  // "Kanit-Bold" so existing className styles keep working.
  const [fontsLoaded] = useFonts({
    Kanit: Kanit_400Regular,
    "Kanit-Bold": Kanit_700Bold,
  });

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

  if (!fontsLoaded) return null;

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
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="signin" options={{ title: "เข้าสู่ระบบ" }} />
            <Stack.Screen name="s/[slug]/index" options={{ headerShown: false }} />
            <Stack.Screen
              name="s/[slug]/[productSlug]"
              options={{ headerTransparent: true, title: "" }}
            />
            <Stack.Screen name="cart" options={{ title: "ตะกร้า" }} />
            <Stack.Screen
              name="checkout/[token]"
              options={{ title: "ชำระเงิน", headerBackVisible: false }}
            />
            <Stack.Screen
              name="checkout/multi"
              options={{ title: "ชำระเงิน", headerBackVisible: false }}
            />
            <Stack.Screen name="o/[token]" options={{ title: "สถานะคำสั่งซื้อ" }} />
            <Stack.Screen
              name="me/notifications"
              options={{ title: "การแจ้งเตือน" }}
            />
            <Stack.Screen name="me/kyc" options={{ title: "ยืนยันตัวตน (KYC)" }} />
            <Stack.Screen name="me/addresses" options={{ title: "สมุดที่อยู่" }} />
            <Stack.Screen name="me/wallet" options={{ title: "กระเป๋าสะสมแต้ม" }} />
            <Stack.Screen name="me/earnings" options={{ title: "รายได้แอฟฟิลิเอต" }} />
            <Stack.Screen
              name="o/[token]/dispute"
              options={{ title: "เปิดข้อพิพาท" }}
            />
            <Stack.Screen
              name="o/[token]/review"
              options={{ title: "เขียนรีวิว" }}
            />
            <Stack.Screen
              name="c/[slug]"
              options={{ title: "หมวดหมู่" }}
            />
            <Stack.Screen
              name="stories/[slug]"
              options={{
                headerShown: false,
                presentation: "fullScreenModal",
                animation: "fade",
              }}
            />
            <Stack.Screen name="seller/index" options={{ title: "โหมดผู้ขาย" }} />
            <Stack.Screen name="seller/orders" options={{ title: "คำสั่งซื้อ" }} />
            <Stack.Screen name="seller/products" options={{ title: "สินค้า" }} />
            <Stack.Screen
              name="seller/products/new"
              options={{ title: "เพิ่มสินค้า" }}
            />
            <Stack.Screen name="seller/stories" options={{ title: "สตอรี่ร้าน" }} />
            <Stack.Screen
              name="seller/stories/new"
              options={{ title: "โพสต์สตอรี่" }}
            />
            <Stack.Screen name="seller/live" options={{ title: "ไลฟ์ของร้าน" }} />
            <Stack.Screen
              name="seller/live/new"
              options={{ title: "สร้างไลฟ์" }}
            />
            <Stack.Screen
              name="live/[id]"
              options={{
                headerShown: false,
                presentation: "fullScreenModal",
                animation: "fade",
              }}
            />
            <Stack.Screen name="seller/chat" options={{ title: "แชท" }} />
            <Stack.Screen
              name="seller/chat/[id]"
              options={{ title: "" }}
            />
            <Stack.Screen
              name="seller/group-buys"
              options={{ title: "Group Buy" }}
            />
            <Stack.Screen
              name="seller/group-buys/new"
              options={{ title: "สร้างแคมเปญ" }}
            />
            <Stack.Screen
              name="group-buy/[id]"
              options={{ title: "Group Buy" }}
            />
          </Stack>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// `Sentry.wrap` mounts an ErrorBoundary at the root + native-crash reporter.
// When DSN is missing it falls back to a pass-through wrapper so dev/Expo Go
// stays unaffected.
export default Sentry.wrap(RootLayout);
