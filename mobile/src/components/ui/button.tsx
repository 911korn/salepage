import { Pressable, Text, ActivityIndicator } from "react-native";
import { cssInterop } from "nativewind";

cssInterop(Pressable, { className: "style" });
cssInterop(Text, { className: "style" });

type Variant = "primary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface Props {
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: Variant;
  size?: Size;
  children: React.ReactNode;
  className?: string;
}

const VARIANT: Record<Variant, { box: string; text: string }> = {
  primary: {
    box: "bg-brand-600 active:bg-brand-700",
    text: "text-white",
  },
  outline: {
    box: "border border-border bg-white active:bg-soft",
    text: "text-fg",
  },
  ghost: {
    box: "bg-transparent active:bg-soft",
    text: "text-fg",
  },
  danger: {
    box: "bg-rose-600 active:bg-rose-700",
    text: "text-white",
  },
};

const SIZE: Record<Size, { box: string; text: string }> = {
  sm: { box: "px-3 py-2 rounded-xl", text: "text-[13px] font-semibold" },
  md: { box: "px-4 py-3 rounded-2xl", text: "text-[15px] font-semibold" },
  lg: { box: "px-5 py-4 rounded-2xl", text: "text-[16px] font-semibold" },
};

export function Button({
  onPress,
  disabled,
  loading,
  variant = "primary",
  size = "md",
  children,
  className = "",
}: Props) {
  const v = VARIANT[variant];
  const s = SIZE[size];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      className={`flex-row items-center justify-center gap-2 ${v.box} ${s.box} ${
        disabled || loading ? "opacity-60" : ""
      } ${className}`}
    >
      {loading ? <ActivityIndicator color={variant === "primary" || variant === "danger" ? "#fff" : "#0a0a0a"} /> : null}
      <Text className={`${v.text} ${s.text}`}>{children}</Text>
    </Pressable>
  );
}
