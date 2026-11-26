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

import type { ReactNode } from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import type {
  PacketData,
  PacketPoolScheduleRow,
  PacketBracketScheduleRow,
} from "@/lib/tournaments/packet-data";
import {
  formatPacketGeneratedAt,
  formatPacketTime,
} from "@/lib/tournaments/packet-data";
import { BracketStructurePages } from "@/lib/tournaments/packet-bracket-pdf";

const INK = "#1E293B";
const MUTED = "#64748B";
const BORDER = "#E2E8F0";
const SURFACE = "#F8FAFC";
const SURFACE_ALT = "#F1F5F9";
const WHITE = "#FFFFFF";
const CONTINUATION_TOP = 32;

const S = StyleSheet.create({
  page: {
    paddingTop: 0,
    paddingBottom: 60,
    paddingHorizontal: 0,
    fontSize: 10,
    fontFamily: "Helvetica",
    lineHeight: 1.5,
    color: INK,
  },
  header: {
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 40,
    marginBottom: 24,
  },
  headerDate: {
    fontSize: 15,
    fontFamily: "Helvetica-Bold",
    color: WHITE,
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    color: WHITE,
    letterSpacing: -0.5,
    lineHeight: 1.15,
    marginBottom: 8,
  },
  headerSchool: {
    fontSize: 12,
    color: WHITE,
    opacity: 0.92,
    marginBottom: 14,
  },
  headerMetaStrip: {
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 40,
    marginHorizontal: -40,
    marginBottom: -24,
  },
  headerMeta: {
    fontSize: 9,
    color: WHITE,
    opacity: 0.88,
    marginBottom: 2,
  },
  headerMetaStrong: {
    fontFamily: "Helvetica-Bold",
    color: WHITE,
    opacity: 1,
  },
  body: {
    paddingHorizontal: 40,
  },
  locationBlock: {
    marginBottom: 22,
  },
  locationLabel: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 5,
  },
  locationName: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  locationAddress: {
    fontSize: 10,
    color: MUTED,
  },
  section: {
    marginBottom: 22,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: INK,
    marginBottom: 10,
    paddingBottom: 5,
    borderBottomWidth: 1.5,
  },
  subsectionTitle: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    color: INK,
    marginBottom: 8,
    marginTop: 4,
  },
  paragraph: {
    marginBottom: 4,
    color: INK,
  },
  notes: {
    fontSize: 9.5,
    whiteSpace: "pre-wrap",
    color: INK,
    lineHeight: 1.55,
  },
  bulletList: {
    gap: 4,
  },
  bullet: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 3,
  },
  bulletDot: {
    width: 10,
    fontSize: 10,
  },
  bulletText: {
    flex: 1,
    fontSize: 9.5,
  },
  teamGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  teamCol: {
    width: "50%",
    paddingRight: 8,
  },
  teamRow: {
    fontSize: 9.5,
    marginBottom: 4,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: BORDER,
  },
  table: {
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 12,
  },
  tableSubheader: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 8,
    fontFamily: "Helvetica-Bold",
    fontSize: 8.5,
    color: INK,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
    backgroundColor: SURFACE_ALT,
  },
  tableHeader: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontFamily: "Helvetica-Bold",
    fontSize: 8.5,
    color: WHITE,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 8,
    fontSize: 9,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
  },
  tableRowAlt: {
    backgroundColor: SURFACE_ALT,
  },
  colSeed: { width: "12%" },
  colTeam: { width: "88%" },
  colTime: { width: "14%" },
  colCourt: { width: "12%" },
  colRound: { width: "16%" },
  colMatch: { width: "58%" },
  emptyState: {
    fontSize: 9.5,
    color: MUTED,
    fontStyle: "italic",
    padding: 10,
    backgroundColor: SURFACE,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: BORDER,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    fontSize: 7.5,
    color: MUTED,
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
    paddingTop: 8,
  },
  footerBrand: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
  },
});

function Section({
  title,
  accent,
  children,
}: {
  title: string;
  accent: string;
  children: ReactNode;
}) {
  return (
    <View style={S.section}>
      <Text style={[S.sectionTitle, { borderBottomColor: accent }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function Bullet({ accent, children }: { accent: string; children: ReactNode }) {
  return (
    <View style={S.bullet}>
      <Text style={[S.bulletDot, { color: accent }]}>•</Text>
      <Text style={S.bulletText}>{children}</Text>
    </View>
  );
}

function LocationSection({ data }: { data: PacketData }) {
  return (
    <View style={S.locationBlock}>
      <Text style={S.locationLabel}>Venue</Text>
      <Text style={S.locationName}>{data.location}</Text>
      {data.address ? (
        <Text style={S.locationAddress}>{data.address}</Text>
      ) : null}
    </View>
  );
}

function RegisteredTeams({ teams }: { teams: PacketData["registeredTeams"] }) {
  const midpoint = Math.ceil(teams.length / 2);
  const columns = [teams.slice(0, midpoint), teams.slice(midpoint)];

  return (
    <View style={S.teamGrid}>
      {columns.map((col, colIndex) => (
        <View key={colIndex} style={S.teamCol}>
          {col.map((team) => (
            <Text key={team.name} style={S.teamRow}>
              {team.name}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function SeedingTableHeader({ accent }: { accent: string }) {
  return (
    <View style={[S.tableHeader, { backgroundColor: accent }]}>
      <Text style={S.colSeed}>Seed</Text>
      <Text style={S.colTeam}>Team</Text>
    </View>
  );
}

function PoolSeedingsSection({ data }: { data: PacketData }) {
  if (data.poolSeedings.length === 0) return null;

  const accent = data.accentColor;

  return (
    <Section title="Pool seedings" accent={accent}>
      {data.poolSeedings.map((pool) => (
        <View key={pool.poolName} style={{ marginBottom: 14 }}>
          <Text style={S.subsectionTitle}>{pool.poolName}</Text>
          <View style={S.table}>
            <SeedingTableHeader accent={accent} />
            {pool.teams.map((team, i) => (
              <View
                key={`${pool.poolName}-${team.seed}`}
                style={[S.tableRow, i % 2 === 1 ? S.tableRowAlt : {}]}
              >
                <Text style={S.colSeed}>{team.seed}</Text>
                <Text style={S.colTeam}>{team.teamName}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </Section>
  );
}

type TimeSlotGroup = {
  timeLabel: string | null;
  rows: PacketPoolScheduleRow[];
  showTimePerRow: boolean;
};

function groupPoolScheduleByTime(
  rows: PacketPoolScheduleRow[],
  timeZone: string
): TimeSlotGroup[] {
  const slotMap = new Map<string, PacketPoolScheduleRow[]>();
  for (const row of rows) {
    const key = formatPacketTime(row.scheduledTime, timeZone);
    const bucket = slotMap.get(key) ?? [];
    bucket.push(row);
    slotMap.set(key, bucket);
  }

  return Array.from(slotMap.entries()).map(([timeLabel, slotRows]) => {
    const times = new Set(
      slotRows.map((r) => formatPacketTime(r.scheduledTime, timeZone))
    );
    return {
      timeLabel: times.size === 1 ? timeLabel : null,
      rows: slotRows,
      showTimePerRow: times.size !== 1,
    };
  });
}

type IndexedPoolScheduleGroup = TimeSlotGroup & {
  indexedRows: { row: PacketPoolScheduleRow; index: number }[];
};

function attachGlobalRowIndices(
  groups: TimeSlotGroup[]
): IndexedPoolScheduleGroup[] {
  return groups.reduce<IndexedPoolScheduleGroup[]>((acc, group) => {
    const offset =
      acc.length === 0 ? 0 : acc[acc.length - 1].indexedRows.at(-1)!.index + 1;
    acc.push({
      ...group,
      indexedRows: group.rows.map((row, i) => ({ row, index: offset + i })),
    });
    return acc;
  }, []);
}

function PoolScheduleTable({
  rows,
  accent,
  timeZone,
}: {
  rows: PacketPoolScheduleRow[];
  accent: string;
  timeZone: string;
}) {
  const groups = attachGlobalRowIndices(
    groupPoolScheduleByTime(rows, timeZone)
  );

  return (
    <View style={S.table}>
      <View style={[S.tableHeader, { backgroundColor: accent }]}>
        <Text style={S.colTime}>Time</Text>
        <Text style={S.colCourt}>Court</Text>
        <Text style={S.colRound}>Round</Text>
        <Text style={S.colMatch}>Matchup</Text>
      </View>
      {groups.map((group, gi) => (
        <View key={gi}>
          {group.timeLabel ? (
            <View style={S.tableSubheader}>
              <Text style={S.colTime}>{group.timeLabel}</Text>
              <Text style={S.colCourt}>Court</Text>
              <Text style={S.colRound}>Round</Text>
              <Text style={S.colMatch}>Matchup</Text>
            </View>
          ) : null}
          {group.indexedRows.map(({ row, index }) => (
            <View
              key={`${row.poolName}-${row.matchupLabel}-${row.scheduledTime.toISOString()}`}
              style={[S.tableRow, index % 2 === 1 ? S.tableRowAlt : {}]}
            >
              <Text style={S.colTime}>
                {group.showTimePerRow
                  ? formatPacketTime(row.scheduledTime, timeZone)
                  : ""}
              </Text>
              <Text style={S.colCourt}>{row.courtName ?? "—"}</Text>
              <Text style={S.colRound}>
                {row.roundNumber > 0 ? `Round ${row.roundNumber}` : "—"}
              </Text>
              <Text style={S.colMatch}>{row.matchupLabel}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function BracketScheduleTable({
  rows,
  accent,
  timeZone,
}: {
  rows: PacketBracketScheduleRow[];
  accent: string;
  timeZone: string;
}) {
  return (
    <View style={S.table}>
      <View style={[S.tableHeader, { backgroundColor: accent }]}>
        <Text style={S.colTime}>Time</Text>
        <Text style={S.colCourt}>Court</Text>
        <Text style={S.colRound}>Round</Text>
        <Text style={S.colMatch}>Matchup</Text>
      </View>
      {rows.map((row, i) => (
        <View
          key={`${row.teamAName}-${row.teamBName}-${row.scheduledTime.toISOString()}`}
          style={[S.tableRow, i % 2 === 1 ? S.tableRowAlt : {}]}
        >
          <Text style={S.colTime}>
            {formatPacketTime(row.scheduledTime, timeZone)}
          </Text>
          <Text style={S.colCourt}>{row.courtName ?? "—"}</Text>
          <Text style={S.colRound}>{row.roundLabel}</Text>
          <Text style={S.colMatch}>
            {row.teamAName} vs {row.teamBName}
          </Text>
        </View>
      ))}
    </View>
  );
}

function ScheduleSection({ data }: { data: PacketData }) {
  const accent = data.accentColor;
  const hasPool = data.poolSchedule.length > 0;
  const hasBracket = data.bracketSchedule.length > 0;

  if (!hasPool && !hasBracket) {
    return (
      <Section title="Match schedule" accent={accent}>
        <Text style={S.emptyState}>
          Schedule will be published on brac-t.com — check the live event page
          for updates.
        </Text>
      </Section>
    );
  }

  const poolNames = [...new Set(data.poolSchedule.map((r) => r.poolName))];

  return (
    <Section title="Match schedule" accent={accent}>
      {hasPool ? (
        <View style={{ marginBottom: hasBracket ? 16 : 0 }}>
          <Text style={S.subsectionTitle}>Pool play</Text>
          {poolNames.map((poolName) => {
            const rows = data.poolSchedule.filter((r) => r.poolName === poolName);
            return (
              <View key={poolName} style={{ marginBottom: 12 }}>
                <Text
                  style={{
                    fontSize: 9,
                    fontFamily: "Helvetica-Bold",
                    color: MUTED,
                    marginBottom: 6,
                  }}
                >
                  {poolName}
                </Text>
                <PoolScheduleTable
                  rows={rows}
                  accent={accent}
                  timeZone={data.timeZone}
                />
              </View>
            );
          })}
        </View>
      ) : null}
      {hasBracket ? (
        <View>
          <Text style={S.subsectionTitle}>Bracket play</Text>
          <BracketScheduleTable
            rows={data.bracketSchedule}
            accent={accent}
            timeZone={data.timeZone}
          />
        </View>
      ) : null}
    </Section>
  );
}

export function TournamentPacketDocument({ data }: { data: PacketData }) {
  const accent = data.accentColor;

  return (
    <Document title={`${data.name} — Tournament Packet`} author="brackt">
      <Page size="LETTER" style={S.page} wrap>
        <View
          fixed
          render={({ pageNumber }) =>
            pageNumber > 1 ? (
              <View style={{ height: CONTINUATION_TOP, width: "100%" }} />
            ) : null
          }
        />

        <View style={[S.header, { backgroundColor: accent }]}>
          <Text style={S.headerDate}>{data.dateDisplay}</Text>
          <Text style={S.headerTitle}>{data.name}</Text>
          {data.hostSchoolName ? (
            <Text style={S.headerSchool}>{data.hostSchoolName}</Text>
          ) : null}
          <View style={[S.headerMetaStrip, { backgroundColor: INK, opacity: 0.22 }]}>
            <Text style={S.headerMeta}>
              <Text style={S.headerMetaStrong}>Organizer: </Text>
              {data.organizerName}
            </Text>
            <Text style={S.headerMeta}>
              <Text style={S.headerMetaStrong}>Live event: </Text>
              {data.liveUrl}
            </Text>
          </View>
        </View>

        <View style={S.body}>
          <LocationSection data={data} />

          {data.description ? (
            <Section title="Event overview" accent={accent}>
              <Text style={S.notes}>{data.description}</Text>
            </Section>
          ) : null}

          {data.registeredTeams.length > 0 ? (
            <Section
              title={`Registered teams (${data.registeredTeams.length})`}
              accent={accent}
            >
              <RegisteredTeams teams={data.registeredTeams} />
            </Section>
          ) : null}

          {data.packetNotes ? (
            <Section title="Logistics & day-of information" accent={accent}>
              <Text style={S.notes}>{data.packetNotes}</Text>
            </Section>
          ) : null}

          {data.paymentInstructions ? (
            <Section title="Entry fees & payment" accent={accent}>
              <Text style={S.notes}>{data.paymentInstructions}</Text>
            </Section>
          ) : null}

          <Section title="Competition rules — pool play" accent={accent}>
            <View style={S.bulletList}>
              <Bullet accent={accent}>Format: {data.playFormatLabel}</Bullet>
              <Bullet accent={accent}>
                Match format: {data.poolRules.matchFormatLabel}
              </Bullet>
              <Bullet accent={accent}>
                Pool sets start at {data.poolRules.setStartingScore}–
                {data.poolRules.setStartingScore}, play to{" "}
                {data.poolRules.setTargetScore}
                {data.poolRules.matchFormat === "two_with_tiebreak"
                  ? ` (tiebreak to ${data.poolRules.tiebreakTargetScore})`
                  : ""}
              </Bullet>
              <Bullet accent={accent}>
                Warmup: {data.poolRules.warmupFormatLabel}
              </Bullet>
            </View>
            {data.poolRules.tiebreakCriteria.length > 0 ? (
              <Text style={[S.paragraph, { marginTop: 8, fontSize: 9.5 }]}>
                Pool standings tiebreaks (in order):{" "}
                {data.poolRules.tiebreakCriteria.join(" → ")}
              </Text>
            ) : null}
          </Section>

          {data.bracketRules ? (
            <Section title="Competition rules — bracket play" accent={accent}>
              <Text style={S.paragraph}>{data.bracketRules.summary}</Text>
              <View style={[S.bulletList, { marginTop: 8 }]}>
                <Bullet accent={accent}>
                  Match format: {data.poolRules.matchFormatLabel} (same as pool
                  play)
                </Bullet>
                <Bullet accent={accent}>
                  Warmup: {data.poolRules.warmupFormatLabel}
                </Bullet>
              </View>
            </Section>
          ) : null}

          <PoolSeedingsSection data={data} />
          <ScheduleSection data={data} />
        </View>

        <View style={[S.footer, { borderTopColor: BORDER }]} fixed>
          <View>
            <Text style={[S.footerBrand, { color: accent }]}>brac-t.com</Text>
            <Text>
              Generated {formatPacketGeneratedAt(data.generatedAt, data.timeZone)} · Rules and
              schedule reflect settings at generation time.
            </Text>
          </View>
          <Text>{data.liveUrl}</Text>
        </View>
      </Page>

      <BracketStructurePages
        brackets={data.bracketStructures}
        accent={accent}
        tournamentName={data.name}
      />
    </Document>
  );
}
