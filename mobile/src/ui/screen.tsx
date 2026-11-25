/*
 * brackt - Collegiate club volleyball tournament hub
 * Copyright (C) 2026 Andrew Chang
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react";
import {
  Keyboard,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  type StyleProp,
  type View,
  type ViewStyle,
} from "react-native";
import { useThemeColors } from "~/theme/colors";
import { space } from "~/ui/tokens";

type ScrollReveal = { reveal: (node: View) => void };

export type ScreenScrollHandle = {
  scrollTo: (options: { y: number; animated?: boolean }) => void;
  /** Latest content offset Y — used to repair stuck overscroll after tab blur. */
  getOffsetY: () => number;
};

const ScrollRevealContext = createContext<ScrollReveal | null>(null);

/**
 * Scrolls the enclosing ScreenScroll so `node` is on screen. Used by error
 * banners, which can otherwise appear far from the control that failed.
 */
export function useScrollReveal(): ScrollReveal | null {
  return useContext(ScrollRevealContext);
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (!ref) return;
  if (typeof ref === "function") ref(value);
  else ref.current = value;
}

/**
 * Standard scrolling screen body: theme background, consistent padding and
 * section rhythm, pull-to-refresh, and keyboard insets for forms.
 */
export function ScreenScroll({
  children,
  refreshing,
  onRefresh,
  contentStyle,
  gap = space.xxl,
  contentInsetAdjustmentBehavior = "never",
  scrollRef: scrollRefProp,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
  gap?: number;
  /**
   * React Navigation already lays screens out below the header / safe area.
   * Default `never` avoids iOS double-inset bugs after tab switches (home hero
   * shoved down with nowhere to scroll). Opt into `automatic` only when the
   * screen truly owns the status-bar edge.
   */
  contentInsetAdjustmentBehavior?:
    | "automatic"
    | "scrollableAxes"
    | "never"
    | "always";
  scrollRef?: Ref<ScreenScrollHandle | null>;
}) {
  const colors = useThemeColors();
  const scrollRef = useRef<ScrollView>(null);
  const offsetY = useRef(0);

  useEffect(() => {
    const handle: ScreenScrollHandle = {
      scrollTo: (options) => scrollRef.current?.scrollTo(options),
      getOffsetY: () => offsetY.current,
    };
    assignRef(scrollRefProp, handle);
    return () => assignRef(scrollRefProp, null);
  }, [scrollRefProp]);

  const reveal = useCallback((node: View) => {
    const scroll = scrollRef.current;
    const host = scroll?.getNativeScrollRef();
    if (!scroll || !host) return;
    host.measureInWindow((_sx, scrollTop, _sw, scrollHeight) => {
      node.measureInWindow((_x, nodeTop, _w, nodeHeight) => {
        const relativeTop = nodeTop - scrollTop;
        if (relativeTop >= 0 && relativeTop + nodeHeight <= scrollHeight) return;
        scroll.scrollTo({
          y: Math.max(0, offsetY.current + relativeTop - space.lg),
          animated: true,
        });
      });
    });
  }, []);
  const revealContext = useMemo(() => ({ reveal }), [reveal]);

  // automaticallyAdjustKeyboardInsets is iOS-only, and the app is edge-to-edge
  // on Android so the window doesn't resize either.
  const [androidKeyboard, setAndroidKeyboard] = useState(0);
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const show = Keyboard.addListener("keyboardDidShow", (event) => {
      const keyboardTop = event.endCoordinates.screenY;
      setAndroidKeyboard(event.endCoordinates.height);
      requestAnimationFrame(() => {
        const input = TextInput.State.currentlyFocusedInput() as View | null;
        const scroll = scrollRef.current;
        if (!input || !scroll) return;
        input.measureInWindow((_x, top, _w, height) => {
          const overlap = top + height + space.lg - keyboardTop;
          if (overlap <= 0) return;
          scroll.scrollTo({ y: offsetY.current + overlap, animated: true });
        });
      });
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => setAndroidKeyboard(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return (
    <ScrollRevealContext.Provider value={revealContext}>
      <ScrollView
        ref={scrollRef}
        onScroll={(event) => {
          offsetY.current = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={32}
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={[
          styles.content,
          { gap },
          contentStyle,
          androidKeyboard > 0 && {
            paddingBottom: styles.content.paddingBottom + androidKeyboard,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        contentInsetAdjustmentBehavior={contentInsetAdjustmentBehavior}
        automaticallyAdjustsScrollIndicatorInsets={
          contentInsetAdjustmentBehavior !== "never"
        }
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing ?? false}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </ScrollRevealContext.Provider>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.xxxl + space.lg,
  },
});
