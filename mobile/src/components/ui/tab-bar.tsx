import { View, Text, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

/**
 * Bottom tab bar — rendered by the `<Tabs>` layout in `app/(tabs)/_layout.tsx`
 * via its `tabBar` prop. Receives React Navigation state directly so taps are
 * instant (no Stack slide animation) and per-tab navigation state is kept
 * alive in memory (Shopee-style).
 *
 * Labels resolve through the `common.tabs.*` i18n namespace so the bar
 * re-renders when the user changes language in /me.
 */

type TabKey = "index" | "search" | "orders" | "me";

const TABS: Record<
  TabKey,
  { i18nKey: string; iconActive: string; iconInactive: string }
> = {
  index: { i18nKey: "tabs.home", iconActive: "🏠", iconInactive: "🏡" },
  search: { i18nKey: "tabs.shops", iconActive: "🛍", iconInactive: "🛒" },
  orders: { i18nKey: "tabs.orders", iconActive: "📦", iconInactive: "📋" },
  me: { i18nKey: "tabs.me", iconActive: "👤", iconInactive: "👥" },
};

const ROUTE_ORDER: TabKey[] = ["index", "search", "orders", "me"];

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const { t } = useTranslation("common");

  // Filter + order routes from React Navigation state to our 4 known tabs.
  // Anything else in the (tabs) group gets ignored — keeps the bar stable
  // if we ever add hidden tab routes (e.g. modal scratch screens).
  const visibleRoutes = ROUTE_ORDER.filter((key) =>
    state.routes.some((r) => r.name === key),
  );

  return (
    <View className="flex-row border-t border-border bg-white pb-6 pt-2">
      {visibleRoutes.map((key) => {
        const route = state.routes.find((r) => r.name === key)!;
        const focused =
          state.routes[state.index]?.name === key;
        const meta = TABS[key];

        return (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            onPress={() => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            }}
            className="flex-1 items-center justify-center py-1.5"
          >
            <Text className="text-[20px]">
              {focused ? meta.iconActive : meta.iconInactive}
            </Text>
            <Text
              className={`mt-0.5 text-[11px] ${
                focused ? "font-semibold text-brand-700" : "text-muted"
              }`}
            >
              {t(meta.i18nKey)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
