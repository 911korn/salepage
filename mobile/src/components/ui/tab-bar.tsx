import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";

/**
 * Bottom tab bar — present on the 4 V1 main screens (discover, search,
 * orders, me). Other routes are stack-pushed and don't render the bar.
 *
 * We intentionally avoid Expo Router's `(tabs)` group here because the V0.5
 * launcher lives at `app/index.tsx` and we want to evolve that file into the
 * discover feed in-place. Manual tab bar gives us full control over the UI
 * without touching layout files.
 */

type TabKey = "home" | "shops" | "orders" | "me";

interface Props {
  active: TabKey;
}

const TABS: Array<{
  key: TabKey;
  href: string;
  label: string;
  iconActive: string;
  iconInactive: string;
}> = [
  // V1.1: home = product feed (Shopee-style), shops = old discovery + search.
  { key: "home", href: "/", label: "หน้าหลัก", iconActive: "🏠", iconInactive: "🏡" },
  { key: "shops", href: "/search", label: "ร้าน", iconActive: "🛍", iconInactive: "🛒" },
  { key: "orders", href: "/orders", label: "คำสั่งซื้อ", iconActive: "📦", iconInactive: "📋" },
  { key: "me", href: "/me", label: "ฉัน", iconActive: "👤", iconInactive: "👥" },
];

export function TabBar({ active }: Props) {
  return (
    <View className="absolute bottom-0 left-0 right-0 flex-row border-t border-border bg-white pb-6 pt-2">
      {TABS.map((t) => {
        const isActive = t.key === active;
        return (
          <Pressable
            key={t.key}
            onPress={() => {
              if (isActive) return;
              router.replace(t.href as never);
            }}
            className="flex-1 items-center justify-center py-1.5"
          >
            <Text className="text-[20px]">{isActive ? t.iconActive : t.iconInactive}</Text>
            <Text
              className={`mt-0.5 text-[11px] ${
                isActive ? "font-semibold text-brand-700" : "text-muted"
              }`}
            >
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
