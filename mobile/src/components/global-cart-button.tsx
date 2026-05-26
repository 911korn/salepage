import { View, Text, Pressable } from "react-native";
import { router, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ShoppingBag } from "lucide-react-native";
import { useCart, selectItemCount } from "@/store/cart";

/**
 * App-wide floating cart shortcut. Mounted at the root after the Stack so
 * it sits on top of every screen and stays in the same place (911korn
 * 2026-05-27: "ทำให้ตระกร้า สามารถกดดูได้ทุก หน้า · ให้มันอยู่ที่เดิม
 * ตรงนั้นไปเลย" — top-right corner, same coordinates as the product
 * modal's `ProductCartButton`).
 *
 * Visibility rules:
 *   1. Hidden when the cart is empty — no need for a phantom button
 *      sitting over content; encourages the buyer to fill the bag first.
 *   2. Hidden on routes where it would either be redundant or get in the
 *      way: /cart (you're already here), /checkout/* (active payment
 *      flow), /signin* (modal sheet), /auth/* (deep-link redirects),
 *      /stories/* (immersive viewer), /s/[slug]/[productSlug] (product
 *      modal renders its own animated <ProductCartButton> with the
 *      bounce target wired up).
 *
 * Same translucent dark pill + count badge as the product-modal version
 * so the affordance reads as a single consistent piece of chrome across
 * the app.
 */
export function GlobalCartButton() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const itemCount = useCart(selectItemCount);

  if (itemCount === 0) return null;
  if (isCartButtonHidden(pathname)) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: insets.top + 8,
        right: 16,
        // Sits above the Stack content. The animated splash also uses
        // absolute positioning but it covers the whole screen during the
        // intro beat — by the time the cart actually has anything in it
        // the splash is long gone.
        zIndex: 50,
      }}
    >
      <Pressable
        onPress={() => router.push("/cart")}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="View cart"
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(15,15,15,0.55)",
          // Subtle shadow keeps it readable when the screen below is
          // white (e.g. me/addresses, seller dashboard cards).
          shadowColor: "#0a0a0a",
          shadowOpacity: 0.15,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 4,
        }}
      >
        <ShoppingBag size={18} color="#ffffff" strokeWidth={2.4} />
        <View
          style={{
            position: "absolute",
            top: -4,
            right: -4,
            minWidth: 18,
            height: 18,
            paddingHorizontal: 4,
            borderRadius: 9,
            backgroundColor: "#e11d48",
            borderWidth: 2,
            borderColor: "#ffffff",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#ffffff", fontSize: 10, fontWeight: "700" }}>
            {itemCount > 99 ? "99+" : itemCount}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

function isCartButtonHidden(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname === "/cart") return true;
  if (pathname.startsWith("/checkout")) return true;
  if (pathname.startsWith("/signin")) return true;
  if (pathname.startsWith("/auth/")) return true;
  if (pathname.startsWith("/stories/")) return true;
  // Product modal renders its own animated cart pill that doubles as the
  // bounce target for the fly-to-cart animation — let it own that slot.
  if (/^\/s\/[^/]+\/[^/]+$/.test(pathname)) return true;
  return false;
}
