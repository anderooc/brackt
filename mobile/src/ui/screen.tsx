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
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  type StyleProp,
  type View,
  type ViewStyle,
} from "react-native";
import { useThemeColors } from "~/theme/colors";
import { space } from "~/ui/tokens";

type ScrollReveal = { reveal: (node: View) => void };

const ScrollRevealContext = createContext<ScrollReveal | null>(null);

/**
 * Scrolls the enclosing ScreenScroll so `node` is on screen. Used by error
 * banners, which can otherwise appear far from the control that failed.
 */
export function useScrollReveal(): ScrollReveal | null {
  return useContext(ScrollRevealContext);
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
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
  gap?: number;
}) {
  const colors = useThemeColors();
  const scrollRef = useRef<ScrollView>(null);
  const offsetY = useRef(0);

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

  return (
    <ScrollRevealContext.Provider value={revealContext}>
      <ScrollView
        ref={scrollRef}
        onScroll={(event) => {
          offsetY.current = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={32}
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={[styles.content, { gap }, contentStyle]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        contentInsetAdjustmentBehavior="automatic"
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
