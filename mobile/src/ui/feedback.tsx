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

import { useEffect, useRef } from "react";
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  StyleSheet,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useThemeColors, withAlpha } from "~/theme/colors";
import { AppText, Button, Icon, type IconName } from "~/ui/primitives";
import { useScrollReveal } from "~/ui/screen";
import { radius, space } from "~/ui/tokens";

export type BannerTone = "error" | "success" | "info" | "warning";

/** Inline message for action results and recoverable errors. */
export function Banner({
  tone = "error",
  title,
  message,
  action,
  onDismiss,
}: {
  tone?: BannerTone;
  title?: string;
  message: string;
  action?: { label: string; onPress: () => void };
  onDismiss?: () => void;
}) {
  const colors = useThemeColors();
  const scrollReveal = useScrollReveal();
  const bannerRef = useRef<View>(null);

  useEffect(() => {
    if (tone !== "error" || !scrollReveal) return;
    const frame = requestAnimationFrame(() => {
      if (bannerRef.current) scrollReveal.reveal(bannerRef.current);
    });
    return () => cancelAnimationFrame(frame);
  }, [message, tone, scrollReveal]);

  const fg =
    tone === "error"
      ? colors.destructive
      : tone === "success"
        ? colors.success
        : tone === "warning"
          ? colors.warning
          : colors.info;
  const icon: IconName =
    tone === "error"
      ? "alert-circle"
      : tone === "success"
        ? "checkmark-circle"
        : tone === "warning"
          ? "warning"
          : "information-circle";

  return (
    <View
      ref={bannerRef}
      accessibilityRole={tone === "error" ? "alert" : "summary"}
      accessibilityLiveRegion="polite"
      style={[
        styles.banner,
        { backgroundColor: withAlpha(fg, 0.08), borderColor: withAlpha(fg, 0.3) },
      ]}
    >
      <Icon name={icon} size={18} color={fg} />
      <View style={styles.bannerText}>
        {title ? (
          <AppText variant="subhead" weight="600" style={{ color: fg }}>
            {title}
          </AppText>
        ) : null}
        <AppText variant="subhead">{message}</AppText>
        {action ? (
          <Pressable
            accessibilityRole="button"
            onPress={action.onPress}
            hitSlop={8}
            style={({ pressed }) => [styles.bannerAction, { opacity: pressed ? 0.6 : 1 }]}
          >
            <AppText variant="subhead" weight="600" style={{ color: fg }}>
              {action.label}
            </AppText>
          </Pressable>
        ) : null}
      </View>
      {onDismiss ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          onPress={onDismiss}
          hitSlop={10}
        >
          <Icon name="close" size={18} tone="muted" />
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  action,
  compact = false,
}: {
  icon?: IconName;
  title: string;
  message?: string;
  action?: { label: string; onPress: () => void; icon?: IconName };
  compact?: boolean;
}) {
  const colors = useThemeColors();
  return (
    <View style={[styles.empty, compact && styles.emptyCompact]}>
      {icon ? (
        <View
          style={[
            styles.emptyIcon,
            compact && styles.emptyIconCompact,
            { backgroundColor: colors.muted },
          ]}
        >
          <Icon name={icon} size={compact ? 20 : 26} tone="muted" />
        </View>
      ) : null}
      <AppText
        variant={compact ? "callout" : "headline"}
        weight="600"
        style={styles.center}
      >
        {title}
      </AppText>
      {message ? (
        <AppText variant="subhead" tone="muted" style={[styles.center, styles.emptyBody]}>
          {message}
        </AppText>
      ) : null}
      {action ? (
        <Button
          label={action.label}
          icon={action.icon}
          variant="outline"
          size="sm"
          onPress={action.onPress}
          style={styles.emptyAction}
        />
      ) : null}
    </View>
  );
}

function usePulse() {
  const opacity = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce || cancelled) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.55, duration: 650, useNativeDriver: true }),
        ])
      );
      loop.start();
    });
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [opacity]);
  return opacity;
}

export function Skeleton({
  width = "100%",
  height = 14,
  rounded = radius.sm,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  rounded?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useThemeColors();
  const opacity = usePulse();
  return (
    <Animated.View
      style={[
        { width, height, borderRadius: rounded, backgroundColor: colors.muted, opacity },
        style,
      ]}
    />
  );
}

/** Placeholder shaped like a list of rows, used while a screen's first load is in flight. */
export function SkeletonList({ rows = 5, header = true }: { rows?: number; header?: boolean }) {
  const colors = useThemeColors();
  return (
    <View
      style={styles.skeletonScreen}
      accessibilityLabel="Loading"
      accessibilityRole="progressbar"
    >
      {header ? (
        <View style={styles.skeletonHeader}>
          <Skeleton width="45%" height={12} />
          <Skeleton width="75%" height={24} />
        </View>
      ) : null}
      <View
        style={[
          styles.skeletonGroup,
          { borderColor: colors.border, backgroundColor: colors.card },
        ]}
      >
        {Array.from({ length: rows }, (_, index) => (
          <View key={index} style={styles.skeletonRow}>
            <Skeleton width={32} height={32} rounded={radius.sm} />
            <View style={styles.skeletonRowText}>
              <Skeleton width={index % 2 === 0 ? "70%" : "55%"} height={14} />
              <Skeleton width={index % 2 === 0 ? "40%" : "50%"} height={11} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm + 2,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
  },
  bannerText: { flex: 1, gap: space.xxs },
  bannerAction: { marginTop: space.xs, alignSelf: "flex-start" },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: space.xxxl,
    paddingHorizontal: space.xxl,
    gap: space.sm,
  },
  emptyCompact: { paddingVertical: space.xl, paddingHorizontal: space.lg },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.xs,
  },
  emptyIconCompact: { width: 40, height: 40 },
  emptyBody: { maxWidth: 320 },
  emptyAction: { alignSelf: "center", marginTop: space.sm },
  center: { textAlign: "center" },
  skeletonScreen: { padding: space.lg, gap: space.xl },
  skeletonHeader: { gap: space.sm },
  skeletonGroup: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: radius.lg,
    paddingVertical: space.xs,
  },
  skeletonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  skeletonRowText: { flex: 1, gap: space.sm },
});
