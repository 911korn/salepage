import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";

/**
 * Bottom tab bar — present on the 4 V1 main screens (home, shops,
 * orders, me). Other routes are stack-pushed and don't render the bar.
 *
 * Labels resolve through the `common.tabs.*` i18n namespace so the bar
 * re-renders instantly when the user changes language in /me.
 */

type TabKey = "home" | "shops" | "orders" | "me";

interface Props {
  active: TabKey;
}

const TABS: Array<{
  key: TabKey;
  href: string;
  iconActive: string;
  iconInactive: string;
}> = [
  // V1.1: home = product feed (Shopee-style), shops = old discovery + search.
  { key: "home", href: "/", iconActive: "🏠", iconInactive: "🏡" },
  { key: "shops", href: "/search", iconActive: "🛍", iconInactive: "🛒" },
  { key: "orders", href: "/orders", iconActive: "📦", iconInactive: "📋" },
  { key: "me", href: "/me", iconActive: "👤", iconInactive: "👥" },
];

export function TabBar({ active }: Props) {
  const { t } = useTranslation("common");
  return (
    <View className="absolute bottom-0 left-0 right-0 flex-row border-t border-border bg-white pb-6 pt-2">
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            onPress={() => {
              if (isActive) return;
              router.replace(tab.href as never);
            }}
            className="flex-1 items-center justify-center py-1.5"
          >
            <Text className="text-[20px]">
              {isActive ? tab.iconActive : tab.iconInactive}
            </Text>
            <Text
              className={`mt-0.5 text-[11px] ${
                isActive ? "font-semibold text-brand-700" : "text-muted"
              }`}
            >
              {t(`tabs.${tab.key}`)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
