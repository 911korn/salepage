import { View, Text } from "react-native";
import { Download, Recycle } from "lucide-react-native";

/**
 * Type/condition tag at the top-right of every product card. Matches
 * the web version in `src/components/buyer/product-type-tag.tsx`
 * (911korn 2026-05-27 parity rule). Renders ONLY for the two non-
 * default cases — Digital and PRE_OWNED. Regular new physical
 * products show nothing, because labelling every common card "ใหม่"
 * is visual noise that competes with the HOT/NEW badge ("UI มันเพี้ยน
 * ไง" 2026-05-27). Lucide icons only — no emoji per the CET rule.
 */
export function ProductTypeTag({
  type,
  condition,
}: {
  type: "PHYSICAL" | "DIGITAL";
  condition: "NEW" | "PRE_OWNED";
}) {
  if (type === "DIGITAL") {
    return <Pill bg="#7c3aed" label="ดิจิทัล" Icon={Download} />;
  }
  if (condition === "PRE_OWNED") {
    return <Pill bg="#f59e0b" label="มือสอง" Icon={Recycle} />;
  }
  return null;
}

function Pill({
  bg,
  label,
  Icon,
}: {
  bg: string;
  label: string;
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 999,
        backgroundColor: bg,
        // Subtle drop-shadow for "lifted" feel over photos.
        shadowColor: "#0a0a0a",
        shadowOpacity: 0.2,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 1 },
        elevation: 2,
      }}
    >
      <Icon size={10} color="#ffffff" strokeWidth={2.5} />
      <Text
        style={{
          color: "#ffffff",
          fontSize: 9,
          fontWeight: "800",
          letterSpacing: 0.3,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
