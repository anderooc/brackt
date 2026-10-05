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
import { AccessibilityInfo, Animated, StyleSheet, Text, View } from "react-native";
import {
  DASHBOARD_RELATION_LABELS,
  isTournamentArchived,
  MATCH_STATUS_LABELS,
  REGISTRATION_STATUS_LABELS,
  SCHOOL_VERIFICATION_LABELS,
  TOURNAMENT_STATUS_LABELS,
} from "~/lib/format";
import { useThemeColors, withAlpha } from "~/theme/colors";
import { radius, space, type } from "~/ui/tokens";

/*
 * Mirrors src/components/ui/status-badge.tsx on the web so a status reads the
 * same on both surfaces. Tone is always paired with a label, never color alone.
 */

export type BadgeTone =
  | "neutral"
  | "archived"
  | "success"
  | "warning"
  | "info"
  | "live"
  | "destructive";

export type StatusKind =
  | "tournament"
  | "registration"
  | "match"
  | "verification"
  | "dashboard_relation";

function tournamentTone(status: string, archived: boolean): BadgeTone {
  if (archived) return "archived";
  switch (status) {
    case "registration_open":
      return "success";
    case "registration_closed":
      return "warning";
    case "in_progress":
      return "live";
    case "completed":
      return "info";
    default:
      return "neutral";
  }
}

function registrationTone(status: string): BadgeTone {
  switch (status) {
    case "confirmed":
      return "info";
    case "checked_in":
      return "success";
    case "pending":
    case "waitlisted":
      return "warning";
    default:
      return "neutral";
  }
}

function matchTone(status: string): BadgeTone {
  switch (status) {
    case "in_progress":
      return "live";
    case "completed":
      return "info";
    case "paused":
      return "warning";
    default:
      return "neutral";
  }
}

function verificationTone(status: string): BadgeTone {
  switch (status) {
    case "verified":
      return "success";
    case "rejected":
      return "destructive";
    default:
      return "warning";
  }
}

function relationTone(status: string): BadgeTone {
  switch (status) {
    case "pending":
      return "warning";
    case "signed_up":
      return "success";
    case "hosting":
      return "info";
    default:
      return "archived";
  }
}

export function statusTone(
  kind: StatusKind,
  status: string,
  date?: string
): { tone: BadgeTone; label: string } {
  switch (kind) {
    case "tournament": {
      const archived = date ? isTournamentArchived(date) : false;
      return {
        tone: tournamentTone(status, archived),
        label: archived
          ? "Archived"
          : (TOURNAMENT_STATUS_LABELS[status] ?? status),
      };
    }
    case "registration":
      return {
        tone: registrationTone(status),
        label:
          status === "waitlisted"
            ? "Waitlisted"
            : (REGISTRATION_STATUS_LABELS[status] ?? status),
      };
    case "match":
      return {
        tone: matchTone(status),
        label: MATCH_STATUS_LABELS[status] ?? status,
      };
    case "verification":
      return {
        tone: verificationTone(status),
        label: SCHOOL_VERIFICATION_LABELS[status] ?? status,
      };
    case "dashboard_relation":
      return {
        tone: relationTone(status),
        label: DASHBOARD_RELATION_LABELS[status] ?? status,
      };
  }
}

export function Badge({ label, tone = "neutral" }: { label: string; tone?: BadgeTone }) {
  const colors = useThemeColors();
  const toneColor: Record<BadgeTone, string> = {
    neutral: colors.mutedForeground,
    archived: colors.mutedForeground,
    success: colors.success,
    warning: colors.warning,
    info: colors.info,
    live: colors.live,
    destructive: colors.destructive,
  };
  const fg = toneColor[tone];
  const muted = tone === "neutral" || tone === "archived";

  return (
    <View
      style={[
        styles.badge,
        {
          borderColor: muted ? colors.border : withAlpha(fg, 0.3),
          borderStyle: tone === "archived" ? "dashed" : "solid",
          backgroundColor: muted ? withAlpha(colors.muted, 0.7) : withAlpha(fg, 0.1),
        },
      ]}
    >
      {tone === "live" ? <LiveDot color={fg} /> : null}
      <Text style={[type.caption, { color: fg, fontWeight: "600" }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function StatusBadge({
  kind,
  status,
  date,
}: {
  kind: StatusKind;
  status: string;
  date?: string;
}) {
  const { tone, label } = statusTone(kind, status, date);
  return <Badge label={label} tone={tone} />;
}

function LiveDot({ color }: { color: string }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce || cancelled) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0.35,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
    });
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [opacity]);

  return (
    <Animated.View
      style={[styles.liveDot, { backgroundColor: color, opacity }]}
    />
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: space.xs + 1,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
});
