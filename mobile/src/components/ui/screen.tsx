import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface Props {
  children: React.ReactNode;
  scroll?: boolean;
  className?: string;
  contentClassName?: string;
}

/**
 * Screen wrapper that handles SafeArea + optional scroll.
 * Default background = brand soft (matches web `--color-soft`).
 */
export function Screen({ children, scroll, className = "", contentClassName = "" }: Props) {
  const Container = scroll ? ScrollView : View;
  return (
    <SafeAreaView className={`flex-1 bg-soft ${className}`} edges={["top"]}>
      <Container
        className={`flex-1 ${contentClassName}`}
        contentContainerClassName={scroll ? "pb-24" : undefined}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </Container>
    </SafeAreaView>
  );
}
