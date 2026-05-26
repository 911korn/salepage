import { View, Text, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Home, Store, Package, User } from "lucide-react-native";

/**
 * Bottom tab bar — rendered by the `<Tabs>` layout in `app/(tabs)/_layout.tsx`
 * via its `tabBar` prop. Receives React Navigation state directly so taps are
 * instant (no Stack slide animation) and per-tab navigation state is kept
 * alive in memory (Shopee-style).
 *
 * Icons are lucide-react-native line icons (no emojis — emojis make a CET
 * app look amateurish, per the company-wide "official logos / proper icons
 * only" rule). The active state is solid brand-rose with a filled glyph
 * weight; inactive is a muted outline.
 *
 * Labels resolve through the `common.tabs.*` i18n namespace so the bar
 * re-renders when the user changes language in /me.
 */

type TabKey = "index" | "search" | "orders" | "me";

const TABS: Record<
  TabKey,
  { i18nKey: string; Icon: typeof Home }
> = {
  index: { i18nKey: "tabs.home", Icon: Home },
  search: { i18nKey: "tabs.shops", Icon: Store },
  orders: { i18nKey: "tabs.orders", Icon: Package },
  me: { i18nKey: "tabs.me", Icon: User },
};

const ROUTE_ORDER: TabKey[] = ["index", "search", "orders", "me"];

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const { t } = useTranslation("common");

  const visibleRoutes = ROUTE_ORDER.filter((key) =>
    state.routes.some((r) => r.name === key),
  );

  return (
    <View className="flex-row border-t border-border bg-white pb-6 pt-2">
      {visibleRoutes.map((key) => {
        const route = state.routes.find((r) => r.name === key)!;
        const focused = state.routes[state.index]?.name === key;
        const meta = TABS[key];
        const color = focused ? "#e11d48" : "#737373";

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
            <meta.Icon
              size={22}
              color={color}
              strokeWidth={focused ? 2.4 : 1.8}
              fill={focused ? "#fee2e2" : "transparent"}
            />
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
