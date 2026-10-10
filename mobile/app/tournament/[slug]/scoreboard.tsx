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

import type { TournamentMatchContract } from "@/lib/api/contracts/tournament";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useKeepAwake } from "expo-keep-awake";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WEB_BASE_URL } from "~/api/config";
import { fetchTournament, fetchTournamentMatches } from "~/api/endpoints";
import { formatMatchTime, formatSetLine } from "~/lib/format";
import { usePolling } from "~/lib/use-polling";
import { radius, space } from "~/ui";

const POLL_MS = 8_000;
const ROTATE_MS = 14_000;

// The board is always dark so it reads well on a gym wall or table stand,
// regardless of the device's appearance setting.
const board = {
  background: "#09090b",
  surface: "#18181b",
  border: "#27272a",
  text: "#fafafa",
  muted: "#a1a1aa",
  dim: "#71717a",
  live: "#ef4444",
  accent: "#cf1743",
  warning: "#f59e0b",
};

type Filter = "all" | "in_progress" | "upcoming" | "completed";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "in_progress", label: "Live" },
  { id: "upcoming", label: "Up next" },
  { id: "completed", label: "Final" },
];

const STATUS_ORDER: Record<string, number> = {
  in_progress: 0,
  upcoming: 1,
  completed: 2,
};

export default function ScoreboardScreen() {
  useKeepAwake();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { slug } = useLocalSearchParams<{ slug: string }>();

  const [name, setName] = useState("");
  const [matches, setMatches] = useState<TournamentMatchContract[] | null>(null);
  const [stale, setStale] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [court, setCourt] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [clock, setClock] = useState(() => new Date());

  const wide = width >= 700;
  const pageSize = wide ? 4 : 3;

  const refresh = useCallback(async () => {
    try {
      const result = await fetchTournamentMatches(slug ?? "");
      setMatches(result.matches);
      setStale(false);
    } catch {
      setStale(true);
    }
  }, [slug]);

  useEffect(() => {
    void refresh();
    void fetchTournament(slug ?? "")
      .then((tournament) => setName(tournament.name))
      .catch(() => {});
  }, [slug, refresh]);

  usePolling(refresh, POLL_MS, true);

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);

  const courts = useMemo(() => {
    const set = new Set<string>();
    for (const match of matches ?? []) if (match.courtName) set.add(match.courtName);
    return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [matches]);

  const ordered = useMemo(
    () =>
      (matches ?? [])
        .filter((match) => (court ? match.courtName === court : true))
        .filter((match) => (filter === "all" ? true : match.status === filter))
        .sort((a, b) => {
          const byStatus = (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3);
          if (byStatus !== 0) return byStatus;
          const aTime = a.scheduledTime ?? "";
          const bTime = b.scheduledTime ?? "";
          return a.status === "completed"
            ? bTime.localeCompare(aTime)
            : aTime.localeCompare(bTime);
        }),
    [matches, court, filter]
  );

  const pages = Math.max(1, Math.ceil(ordered.length / pageSize));
  const currentPage = Math.min(page, pages - 1);
  const visible = ordered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const liveCount = (matches ?? []).filter((m) => m.status === "in_progress").length;

  useEffect(() => setPage(0), [filter, court]);

  useEffect(() => {
    if (pages <= 1) return;
    const id = setInterval(() => setPage((p) => (p + 1) % pages), ROTATE_MS);
    return () => clearInterval(id);
  }, [pages]);

  function share() {
    const url = `${WEB_BASE_URL}/explore/tournaments/${slug}/scores`;
    void Share.share({
      message: name ? `Live scores for ${name}: ${url}` : url,
      url,
    });
  }

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.sm },
      ]}
    >
      <StatusBar style="light" />
      <View style={styles.header}>
        <BoardButton icon="close" label="Close scoreboard" onPress={() => router.back()} />
        <View style={styles.titleBlock}>
          <View style={styles.liveRow}>
            <View style={[styles.dot, liveCount === 0 && styles.dotIdle]} />
            <Text style={styles.eyebrow}>
              {liveCount > 0 ? `Live · ${liveCount} on court` : "Court board"}
            </Text>
          </View>
          <Text style={styles.title} numberOfLines={1}>
            {name || " "}
          </Text>
        </View>
        <Text style={styles.clock}>
          {clock.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
        </Text>
        <BoardButton icon="share-outline" label="Share scores link" onPress={share} />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
        style={styles.filterScroll}
      >
        {FILTERS.map((option) => (
          <BoardChip
            key={option.id}
            label={option.label}
            selected={filter === option.id}
            onPress={() => setFilter(option.id)}
          />
        ))}
        {courts.length > 1 ? <View style={styles.divider} /> : null}
        {courts.length > 1
          ? [null, ...courts].map((value) => (
              <BoardChip
                key={value ?? "all-courts"}
                label={value ?? "All courts"}
                selected={court === value}
                onPress={() => setCourt(value)}
              />
            ))
          : null}
      </ScrollView>

      {stale ? (
        <View style={styles.stale}>
          <Ionicons name="cloud-offline-outline" size={14} color={board.warning} />
          <Text style={styles.staleText}>Connection lost. Showing the last scores.</Text>
        </View>
      ) : null}

      <View style={[styles.grid, wide && styles.gridWide]}>
        {matches === null ? (
          <Text style={styles.empty}>Loading scores…</Text>
        ) : visible.length === 0 ? (
          <View style={styles.emptyBlock}>
            <Ionicons name="trophy-outline" size={36} color={board.dim} />
            <Text style={styles.emptyTitle}>No matches here yet</Text>
            <Text style={styles.empty}>
              Matches appear once courts and times are assigned.
            </Text>
          </View>
        ) : (
          visible.map((match) => (
            <View key={match.slug} style={[styles.cardSlot, wide && styles.cardSlotWide]}>
              <MatchCard match={match} />
            </View>
          ))
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {ordered.length === 0
            ? " "
            : `Page ${currentPage + 1} of ${pages} · ${ordered.length} matches`}
        </Text>
        {pages > 1 ? (
          <View style={styles.dots}>
            {Array.from({ length: pages }, (_, index) => (
              <Pressable
                key={index}
                onPress={() => setPage(index)}
                accessibilityRole="button"
                accessibilityLabel={`Page ${index + 1}`}
                hitSlop={8}
                style={[styles.pageDot, index === currentPage && styles.pageDotActive]}
              />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function MatchCard({ match }: { match: TournamentMatchContract }) {
  const live = match.status === "in_progress";
  const final = match.status === "completed";
  const setLine = formatSetLine(match.sets);
  const meta = [
    match.courtName,
    match.scheduledTime ? formatMatchTime(match.scheduledTime) : null,
    match.divisionName,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <View style={[styles.card, live && styles.cardLive, final && styles.cardFinal]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.status, live && styles.statusLive]}>
          {live ? "Live" : final ? "Final" : "Up next"}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      <TeamLine
        name={match.teamA?.name ?? "TBD"}
        won={!!match.winnerSlug && match.winnerSlug === match.teamA?.slug}
        dim={final && match.winnerSlug !== match.teamA?.slug}
      />
      <TeamLine
        name={match.teamB?.name ?? "TBD"}
        won={!!match.winnerSlug && match.winnerSlug === match.teamB?.slug}
        dim={final && match.winnerSlug !== match.teamB?.slug}
      />
      {setLine ? <Text style={styles.sets}>{setLine}</Text> : null}
    </View>
  );
}

function TeamLine({ name, won, dim }: { name: string; won: boolean; dim: boolean }) {
  return (
    <View style={styles.teamLine}>
      <Text style={[styles.team, dim && styles.teamDim]} numberOfLines={1}>
        {name}
      </Text>
      {won ? <Text style={styles.win}>Win</Text> : null}
    </View>
  );
}

function BoardButton({
  icon,
  label,
  onPress,
}: {
  icon: "close" | "share-outline";
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [styles.boardButton, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={20} color={board.text} />
    </Pressable>
  );
}

function BoardChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: board.background, paddingHorizontal: space.lg },
  header: { flexDirection: "row", alignItems: "center", gap: space.md },
  titleBlock: { flex: 1, minWidth: 0 },
  liveRow: { flexDirection: "row", alignItems: "center", gap: space.xs },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: board.live },
  dotIdle: { backgroundColor: board.dim },
  eyebrow: {
    color: board.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  title: { color: board.text, fontSize: 22, fontWeight: "800", letterSpacing: -0.3 },
  clock: { color: board.muted, fontSize: 15, fontVariant: ["tabular-nums"] },
  boardButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: board.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: board.border,
  },
  pressed: { opacity: 0.6 },
  filterScroll: { flexGrow: 0, marginTop: space.md },
  filters: { gap: space.sm, alignItems: "center", paddingRight: space.lg },
  divider: { width: 1, height: 20, backgroundColor: board.border },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
    borderRadius: radius.full,
    backgroundColor: board.surface,
  },
  chipSelected: { backgroundColor: board.text },
  chipText: { color: board.muted, fontSize: 14, fontWeight: "600" },
  chipTextSelected: { color: board.background },
  stale: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    marginTop: space.sm,
  },
  staleText: { color: board.warning, fontSize: 13 },
  grid: { flex: 1, gap: space.md, marginTop: space.lg, justifyContent: "flex-start" },
  gridWide: { flexDirection: "row", flexWrap: "wrap", alignContent: "flex-start" },
  cardSlot: { width: "100%" },
  cardSlotWide: { width: "48.5%" },
  card: {
    backgroundColor: board.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: board.border,
    padding: space.lg,
    gap: space.sm,
  },
  cardLive: { borderColor: board.accent, backgroundColor: "#1f0d12" },
  cardFinal: { opacity: 0.85 },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: space.sm,
    marginBottom: space.xs,
  },
  status: {
    color: board.muted,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  statusLive: { color: board.live },
  meta: { color: board.dim, fontSize: 13, flexShrink: 1 },
  teamLine: { flexDirection: "row", alignItems: "center", gap: space.sm },
  team: { flex: 1, color: board.text, fontSize: 24, fontWeight: "800", letterSpacing: -0.4 },
  teamDim: { color: board.dim },
  win: {
    color: board.accent,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  sets: {
    color: board.text,
    fontSize: 16,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    marginTop: space.xs,
  },
  emptyBlock: { alignItems: "center", gap: space.sm, marginTop: space.xxxl },
  emptyTitle: { color: board.text, fontSize: 18, fontWeight: "700" },
  empty: { color: board.muted, fontSize: 14, textAlign: "center" },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: space.sm,
  },
  footerText: { color: board.dim, fontSize: 12 },
  dots: { flexDirection: "row", gap: space.sm },
  pageDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: board.border },
  pageDotActive: { width: 24, backgroundColor: board.accent },
});
