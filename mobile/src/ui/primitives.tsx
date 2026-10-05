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

import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps, ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useThemeColors, withAlpha, type ThemeColors } from "~/theme/colors";
import { haptics } from "~/ui/haptics";
import { HIT_TARGET, radius, space, type, type TypeVariant } from "~/ui/tokens";

export type IconName = ComponentProps<typeof Ionicons>["name"];

export type TextTone =
  | "default"
  | "muted"
  | "primary"
  | "secondary"
  | "destructive"
  | "success"
  | "warning"
  | "inverse";

function toneColor(colors: ThemeColors, tone: TextTone): string {
  switch (tone) {
    case "muted":
      return colors.mutedForeground;
    case "primary":
      return colors.primary;
    case "secondary":
      return colors.secondary;
    case "destructive":
      return colors.destructive;
    case "success":
      return colors.success;
    case "warning":
      return colors.warning;
    case "inverse":
      return colors.primaryForeground;
    default:
      return colors.foreground;
  }
}

export function AppText({
  variant = "body",
  tone = "default",
  weight,
  style,
  ...rest
}: TextProps & {
  variant?: TypeVariant;
  tone?: TextTone;
  weight?: TextStyle["fontWeight"];
}) {
  const colors = useThemeColors();
  return (
    <Text
      {...rest}
      style={[
        type[variant],
        { color: toneColor(colors, tone) },
        weight ? { fontWeight: weight } : null,
        style,
      ]}
    />
  );
}

export function Icon({
  name,
  size = 20,
  color,
  tone = "default",
}: {
  name: IconName;
  size?: number;
  color?: string;
  tone?: TextTone;
}) {
  const colors = useThemeColors();
  return (
    <Ionicons
      name={name}
      size={size}
      color={color ?? toneColor(colors, tone)}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive"
  | "destructiveOutline";

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  loading = false,
  disabled = false,
  fullWidth = false,
  haptic = true,
  accessibilityLabel,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: "md" | "sm";
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  haptic?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useThemeColors();
  const inactive = disabled || loading;

  const palette: Record<
    ButtonVariant,
    { bg: string; fg: string; border: string; pressed: string }
  > = {
    primary: {
      bg: colors.primary,
      fg: colors.primaryForeground,
      border: colors.primary,
      pressed: withAlpha(colors.primary, 0.85),
    },
    secondary: {
      bg: colors.muted,
      fg: colors.foreground,
      border: colors.muted,
      pressed: withAlpha(colors.mutedForeground, 0.18),
    },
    outline: {
      bg: "transparent",
      fg: colors.foreground,
      border: colors.border,
      pressed: colors.muted,
    },
    ghost: {
      bg: "transparent",
      fg: colors.primary,
      border: "transparent",
      pressed: withAlpha(colors.primary, 0.08),
    },
    destructive: {
      bg: colors.destructive,
      fg: "#ffffff",
      border: colors.destructive,
      pressed: withAlpha(colors.destructive, 0.85),
    },
    destructiveOutline: {
      bg: "transparent",
      fg: colors.destructive,
      border: withAlpha(colors.destructive, 0.4),
      pressed: withAlpha(colors.destructive, 0.08),
    },
  };
  const tone = palette[variant];
  const height = size === "md" ? 48 : 36;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      hitSlop={size === "sm" ? 4 : 0}
      onPress={() => {
        if (haptic) haptics.tap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        {
          minHeight: height,
          paddingHorizontal: size === "md" ? space.xl : space.md,
          backgroundColor: pressed ? tone.pressed : tone.bg,
          borderColor: tone.border,
          opacity: disabled && !loading ? 0.45 : 1,
          alignSelf: fullWidth ? "stretch" : "flex-start",
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={tone.fg} size="small" />
      ) : (
        <>
          {icon ? <Icon name={icon} size={size === "md" ? 18 : 16} color={tone.fg} /> : null}
          <Text
            style={[
              size === "md" ? type.headline : type.subhead,
              { color: tone.fg, fontWeight: "600" },
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

/** Small square icon button for headers and toolbars. */
export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  tone = "primary",
  badge,
}: {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  tone?: TextTone;
  badge?: number;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.iconButton,
        { backgroundColor: pressed ? colors.muted : "transparent" },
      ]}
    >
      <Icon name={icon} size={22} tone={tone} />
      {badge != null && badge > 0 ? (
        <View style={[styles.iconBadge, { backgroundColor: colors.primary }]}>
          <Text style={[styles.iconBadgeLabel, { color: colors.primaryForeground }]}>
            {badge > 9 ? "9+" : badge}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function Card({
  children,
  style,
  padded = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  const colors = useThemeColors();
  return (
    <View
      style={[
        styles.card,
        padded && styles.cardPadded,
        { backgroundColor: colors.card, borderColor: colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Section({
  title,
  description,
  action,
  children,
  style,
}: {
  title?: string;
  description?: string;
  action?: { label: string; onPress: () => void };
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.section, style]}>
      {title || action ? (
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderText}>
            {title ? (
              <AppText variant="headline" accessibilityRole="header">
                {title}
              </AppText>
            ) : null}
            {description ? (
              <AppText variant="footnote" tone="muted">
                {description}
              </AppText>
            ) : null}
          </View>
          {action ? (
            <Pressable
              accessibilityRole="button"
              onPress={action.onPress}
              hitSlop={12}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <AppText variant="subhead" tone="primary" weight="600">
                {action.label}
              </AppText>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** Bordered container whose children are separated by hairlines. */
export function ListGroup({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useThemeColors();
  const items = (Array.isArray(children) ? children.flat() : [children]).filter(
    Boolean
  );
  return (
    <View
      style={[
        styles.group,
        { backgroundColor: colors.card, borderColor: colors.border },
        style,
      ]}
    >
      {items.map((child, index) => (
        <View key={index}>
          {index > 0 ? (
            <View
              style={[styles.separator, { backgroundColor: colors.border }]}
            />
          ) : null}
          {child}
        </View>
      ))}
    </View>
  );
}

export function ListRow({
  title,
  subtitle,
  meta,
  icon,
  iconTone = "primary",
  trailing,
  chevron,
  onPress,
  destructive,
  disabled,
  accessibilityLabel,
  accessibilityHint,
  numberOfLines = 2,
}: {
  title: string;
  subtitle?: string | null;
  meta?: ReactNode;
  icon?: IconName;
  iconTone?: TextTone;
  trailing?: ReactNode;
  chevron?: boolean;
  onPress?: () => void;
  destructive?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  numberOfLines?: number;
}) {
  const colors = useThemeColors();
  const showChevron = chevron ?? Boolean(onPress);
  const body = (
    <>
      {icon ? (
        <View
          style={[
            styles.rowIcon,
            {
              backgroundColor: withAlpha(
                destructive ? colors.destructive : toneColor(colors, iconTone),
                0.1
              ),
            },
          ]}
        >
          <Icon
            name={icon}
            size={18}
            tone={destructive ? "destructive" : iconTone}
          />
        </View>
      ) : null}
      <View style={styles.rowText}>
        <AppText
          variant="callout"
          weight="600"
          tone={destructive ? "destructive" : "default"}
          numberOfLines={numberOfLines}
        >
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="footnote" tone="muted" numberOfLines={numberOfLines}>
            {subtitle}
          </AppText>
        ) : null}
        {meta}
      </View>
      {trailing}
      {showChevron ? (
        <Icon name="chevron-forward" size={18} color={colors.mutedForeground} />
      ) : null}
    </>
  );

  if (!onPress) {
    return <View style={styles.row}>{body}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ?? [title, subtitle].filter(Boolean).join(". ")
      }
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? colors.muted : "transparent" },
        disabled && { opacity: 0.5 },
      ]}
    >
      {body}
    </Pressable>
  );
}

export function Chip({
  label,
  selected = false,
  onPress,
  disabled,
  icon,
  count,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  icon?: IconName;
  count?: number;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={count != null ? `${label}, ${count}` : label}
      disabled={disabled || !onPress}
      hitSlop={4}
      onPress={() => {
        haptics.selection();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.chip,
        {
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: selected
            ? withAlpha(colors.primary, pressed ? 0.18 : 0.1)
            : pressed
              ? colors.muted
              : colors.card,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      {icon ? (
        <Icon name={icon} size={14} tone={selected ? "primary" : "muted"} />
      ) : null}
      <Text
        style={[
          type.subhead,
          {
            color: selected ? colors.primary : colors.foreground,
            fontWeight: "500",
          },
        ]}
      >
        {label}
      </Text>
      {count != null ? (
        <Text
          style={[
            type.caption,
            { color: selected ? colors.primary : colors.mutedForeground },
          ]}
        >
          {count}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <View style={styles.chipRow}>{children}</View>;
}

/** Pill-track segmented control for switching views within one screen. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: readonly { id: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
}) {
  const colors = useThemeColors();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[styles.segmented, { backgroundColor: colors.muted }]}
    >
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={
              option.count != null
                ? `${option.label}, ${option.count}`
                : option.label
            }
            onPress={() => {
              if (!selected) haptics.selection();
              onChange(option.id);
            }}
            style={[
              styles.segment,
              selected && [
                styles.segmentSelected,
                { backgroundColor: colors.card, shadowColor: colors.foreground },
              ],
            ]}
          >
            <Text
              numberOfLines={1}
              style={[
                type.subhead,
                {
                  color: selected ? colors.foreground : colors.mutedForeground,
                  fontWeight: selected ? "600" : "500",
                },
              ]}
            >
              {option.label}
              {option.count != null && option.count > 0 ? (
                <Text style={{ color: colors.mutedForeground, fontWeight: "500" }}>
                  {` ${option.count}`}
                </Text>
              ) : null}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Raw pressable with the standard pressed-state dim, for custom tappable layouts. */
export function Tappable({
  style,
  children,
  onPress,
  ...rest
}: Omit<PressableProps, "style" | "children"> & {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      {...rest}
      onPress={onPress}
      style={({ pressed }) => [
        style,
        pressed && { backgroundColor: colors.muted },
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBadge: {
    position: "absolute",
    top: 4,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: radius.full,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBadgeLabel: { fontSize: 10, fontWeight: "700" },
  card: { borderWidth: StyleSheet.hairlineWidth * 2, borderRadius: radius.lg },
  cardPadded: { padding: space.lg, gap: space.sm },
  section: { gap: space.md },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: space.md,
  },
  sectionHeaderText: { flex: 1, gap: space.xxs },
  group: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: space.lg },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: HIT_TARGET + 12,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1, minWidth: 0, gap: space.xxs },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    minHeight: 36,
    paddingHorizontal: space.md,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  segmented: {
    flexDirection: "row",
    borderRadius: radius.md,
    padding: 3,
    gap: 2,
  },
  segment: {
    flex: 1,
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm + 1,
    paddingHorizontal: space.sm,
  },
  segmentSelected: {
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
});
