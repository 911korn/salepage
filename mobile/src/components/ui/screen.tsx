import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface Props {
  children: React.ReactNode;
  scroll?: boolean;
  className?: string;
  contentClassName?: string;
  /**
   * Add SafeAreaView's top inset to the screen body.
   *
   * Default `false` — most Stack screens render a header that already
   * sits inside the safe area, so adding another top inset double-pads
   * the content and leaves an obviously empty band below the header
   * (911korn 2026-05-27 screenshot of /seller flagged this exactly).
   *
   * Pass `safeTop` on screens with `headerShown: false` (e.g. tabs,
   * stories/[slug], live/[id]) so they don't render under the status bar.
   */
  safeTop?: boolean;
}

/**
 * Screen wrapper that handles SafeArea + optional scroll.
 * Default background = brand soft (matches web `--color-soft`).
 */
export function Screen({
  children,
  scroll,
  className = "",
  contentClassName = "",
  safeTop = false,
}: Props) {
  const Container = scroll ? ScrollView : View;
  return (
    <SafeAreaView
      className={`flex-1 bg-soft ${className}`}
      edges={safeTop ? ["top"] : []}
    >
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
