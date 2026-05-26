import { Tabs } from "expo-router";
import { TabBar } from "@/components/ui/tab-bar";

/**
 * Tab group layout — owns the 4 main tabs (Home / Shops / Orders / Me).
 *
 * Why `<Tabs>` instead of `<Stack>` + manual TabBar:
 *   - Pre-mounts every tab screen so taps switch instantly (no Stack slide).
 *   - Preserves scroll position + form state per tab (Shopee behaviour).
 *   - Single source of truth for the bottom bar — no `<TabBar active="..." />`
 *     duplication on every screen.
 *
 * The custom `tabBar` prop hands React Navigation's BottomTabBarProps to
 * our `<TabBar />` which renders the same look it had before (emoji icons,
 * i18n labels, brand-rose active state).
 *
 * Deeper navigation (product detail, checkout, settings, etc.) still lives
 * in the root `app/_layout.tsx` Stack — Stack pushes from a tab keep the
 * tab bar visible and slide in normally.
 */
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <TabBar {...props} />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="orders" />
      <Tabs.Screen name="me" />
    </Tabs>
  );
}
