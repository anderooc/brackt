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

import type {
  TeamDetailContract,
  TeamMemberContract,
  TeamRosterCandidateContract,
} from "@/lib/api/contracts/team";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  Alert,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import {
  addTeamMember,
  deleteTeam,
  fetchTeam,
  removeTeamMember,
  updateTeamMemberJersey,
  updateTeamMemberPosition,
} from "~/api/endpoints";
import { useSession } from "~/auth/session";
import { FormField } from "~/components/create-form";
import {
  GENDER_LABELS,
  REGION_LABELS,
  SCHOOL_ROLE_LABELS,
  TEAM_ROLE_LABELS,
  VOLLEYBALL_POSITION_LABELS,
} from "~/lib/format";
import { VolleyballPositionChips } from "~/roster/volleyball-position-chips";
import { useThemeColors } from "~/theme/colors";
import { LoadingScreen, ErrorScreen } from "~/tournament/screen-state";
import { messageFor, usePublicLoader } from "~/tournament/use-public-loader";
import {
  AppText,
  Badge,
  Banner,
  Button,
  EmptyState,
  haptics,
  HIT_TARGET,
  Icon,
  ListGroup,
  ListRow,
  radius,
  ScreenScroll,
  Section,
  space,
  StatusBadge,
  type,
} from "~/ui";

type Notice = { tone: "success" | "error"; message: string };

export default function TeamDetailScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { session, isLoading: sessionLoading } = useSession();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [addEmail, setAddEmail] = useState("");
  const [addJersey, setAddJersey] = useState("");
  const [candidateSearch, setCandidateSearch] = useState("");
  const [candidateJerseys, setCandidateJerseys] = useState<
    Record<string, string>
  >({});
  const [jerseyDrafts, setJerseyDrafts] = useState<Record<string, string>>({});
  const [deleteConfirmName, setDeleteConfirmName] = useState("");

  const load = useCallback(
    (signal?: AbortSignal) => fetchTeam(slug ?? "", signal),
    [slug]
  );
  const { data, error, isRefreshing, refresh, reload } = usePublicLoader(
    load,
    "Could not load this team."
  );

  if (sessionLoading) return <LoadingScreen />;
  if (!session) return <Redirect href="/sign-in" />;
  if (!slug) {
    return (
      <View style={[styles.fill, { backgroundColor: colors.background }]}>
        <EmptyState
          icon="link-outline"
          title="Team unavailable"
          message="This team link is missing or incomplete."
          action={{
            label: "Back to teams",
            icon: "chevron-back",
            onPress: () => router.replace("/teams"),
          }}
        />
      </View>
    );
  }
  if (data === null && error === null) return <LoadingScreen />;
  if (!data) {
    return (
      <ErrorScreen
        title="Team unavailable"
        message={error ?? "Could not load this team."}
        onRetry={() => void reload()}
      />
    );
  }

  const team = data;
  const teamSlug = slug;

  async function runAction(
    key: string,
    action: () => Promise<void>,
    success?: string
  ): Promise<boolean> {
    setBusyKey(key);
    setNotice(null);
    try {
      await action();
      haptics.success();
      if (success) setNotice({ tone: "success", message: success });
      await refresh();
      return true;
    } catch (cause) {
      haptics.error();
      setNotice({ tone: "error", message: messageFor(cause, "Something went wrong.") });
      return false;
    } finally {
      setBusyKey(null);
    }
  }

  function confirmRemove(member: TeamMemberContract) {
    Alert.alert(
      member.isViewer ? "Leave team?" : "Remove player?",
      member.isViewer
        ? "You’ll be removed from this roster."
        : `Remove ${member.fullName} from this team?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: member.isViewer ? "Leave" : "Remove",
          style: "destructive",
          onPress: () =>
            void runAction(
              `remove:${member.membershipId}`,
              () => removeTeamMember(teamSlug, member.membershipId).then(() => undefined),
              member.isViewer ? "You left the team." : `Removed ${member.fullName}.`
            ),
        },
      ]
    );
  }

  function confirmDelete() {
    Alert.alert(
      "Delete team?",
      `This permanently removes ${team.name} and its roster. This can’t be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete team",
          style: "destructive",
          onPress: () =>
            void (async () => {
              setBusyKey("delete");
              setNotice(null);
              try {
                await deleteTeam(teamSlug, deleteConfirmName);
                haptics.success();
                router.replace("/teams");
              } catch (cause) {
                haptics.error();
                setNotice({
                  tone: "error",
                  message: messageFor(cause, "Could not delete this team."),
                });
                setBusyKey(null);
              }
            })(),
        },
      ]
    );
  }

  function jerseyValue(membershipId: string, current: number | null) {
    if (membershipId in jerseyDrafts) return jerseyDrafts[membershipId]!;
    return current == null ? "" : String(current);
  }

  function clearDraft(
    setter: typeof setJerseyDrafts,
    key: string
  ) {
    setter((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  const candidateQuery = candidateSearch.trim().toLowerCase();
  const filteredCandidates = team.rosterCandidates.filter((candidate) => {
    if (!candidateQuery) return true;
    const haystack = [
      candidate.fullName,
      candidate.email,
      candidate.schoolRole
        ? SCHOOL_ROLE_LABELS[candidate.schoolRole] ?? candidate.schoolRole
        : "",
      candidate.volleyballPosition
        ? VOLLEYBALL_POSITION_LABELS[candidate.volleyballPosition] ??
          candidate.volleyballPosition
        : "",
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(candidateQuery);
  });

  return (
    <ScreenScroll refreshing={isRefreshing} onRefresh={() => void refresh()}>
      <Hero
        team={team}
        onSchoolPress={(schoolSlug) => router.push(`/schools/${schoolSlug}`)}
      />

      {error ? (
        <Banner
          title="Couldn’t refresh"
          message={error}
          action={{ label: "Try again", onPress: () => void refresh() }}
        />
      ) : null}
      {notice ? (
        <Banner
          tone={notice.tone}
          message={notice.message}
          onDismiss={() => setNotice(null)}
        />
      ) : null}

      <Section
        title="Roster"
        description={
          team.members.length === 1 ? "1 player" : `${team.members.length} players`
        }
      >
        {team.members.length === 0 ? (
          <EmptyState
            compact
            icon="person-add-outline"
            title="No players yet"
            message={
              team.viewer.canManage
                ? "Add players below to build your roster."
                : "Players will appear here once they’re added."
            }
          />
        ) : (
          <ListGroup>
            {team.members.map((member) => (
              <MemberRow
                key={member.membershipId}
                member={member}
                jersey={jerseyValue(member.membershipId, member.jerseyNumber)}
                busyKey={busyKey}
                onJerseyChange={(value) =>
                  setJerseyDrafts((prev) => ({ ...prev, [member.membershipId]: value.replace(/\D/g, "") }))
                }
                onSaveJersey={() => {
                  const raw = jerseyValue(member.membershipId, member.jerseyNumber).trim();
                  void runAction(
                    `jersey:${member.membershipId}`,
                    async () => {
                      await updateTeamMemberJersey(
                        teamSlug,
                        member.membershipId,
                        raw === "" ? null : Number.parseInt(raw, 10)
                      );
                      clearDraft(setJerseyDrafts, member.membershipId);
                    },
                    `Saved jersey for ${member.fullName}.`
                  );
                }}
                onPositionChange={(position) =>
                  void runAction(`position:${member.membershipId}`, async () => {
                    await updateTeamMemberPosition(
                      teamSlug,
                      member.membershipId,
                      position
                    );
                  })
                }
                onRemove={() => confirmRemove(member)}
              />
            ))}
          </ListGroup>
        )}
      </Section>

      {team.viewer.canManage ? (
        <Section
          title="Add player"
          description={
            team.school
              ? `From the ${team.school.name} roster`
              : "Invite by the email they signed up with"
          }
        >
          {team.school ? (
            team.rosterCandidates.length === 0 ? (
              <EmptyState
                compact
                icon="checkmark-done-outline"
                title="Everyone’s on this team"
                message="Add people to the school roster first, then add them here."
                action={{
                  label: "Open school",
                  icon: "school-outline",
                  onPress: () => router.push(`/schools/${team.school!.slug}`),
                }}
              />
            ) : (
              <>
                <SearchInput
                  value={candidateSearch}
                  onChangeText={setCandidateSearch}
                  placeholder="Search by name, email, or position"
                />
                {filteredCandidates.length === 0 ? (
                  <EmptyState
                    compact
                    icon="search-outline"
                    title="No matches"
                    message="No school roster members match that search."
                  />
                ) : (
                  <ListGroup>
                    {filteredCandidates.map((candidate) => (
                      <CandidateRow
                        key={candidate.userId}
                        candidate={candidate}
                        jersey={candidateJerseys[candidate.userId] ?? ""}
                        busy={busyKey === `add:${candidate.userId}`}
                        onJerseyChange={(value) =>
                          setCandidateJerseys((prev) => ({
                            ...prev,
                            [candidate.userId]: value,
                          }))
                        }
                        onAdd={() => {
                          const raw = candidateJerseys[candidate.userId]?.trim() ?? "";
                          void runAction(
                            `add:${candidate.userId}`,
                            async () => {
                              await addTeamMember(teamSlug, {
                                userId: candidate.userId,
                                jerseyNumber: raw === "" ? null : raw,
                              });
                              clearDraft(setCandidateJerseys, candidate.userId);
                            },
                            `Added ${candidate.fullName} to the roster.`
                          );
                        }}
                      />
                    ))}
                  </ListGroup>
                )}
              </>
            )
          ) : (
            <View style={styles.form}>
              <FormField label="Player email" colors={colors}>
                <InlineInput
                  value={addEmail}
                  onChangeText={setAddEmail}
                  placeholder="name@school.edu"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                  keyboardType="email-address"
                  returnKeyType="next"
                  accessibilityLabel="Player email"
                />
              </FormField>
              <FormField label="Jersey number" hint="Optional" colors={colors}>
                <InlineInput
                  value={addJersey}
                  onChangeText={setAddJersey}
                  placeholder="12"
                  keyboardType="number-pad"
                  maxLength={2}
                  accessibilityLabel="Jersey number"
                  style={styles.jerseyField}
                />
              </FormField>
              <Button
                label="Add player"
                icon="person-add-outline"
                fullWidth
                loading={busyKey === "add:email"}
                disabled={!addEmail.trim() || busyKey === "add:email"}
                onPress={() => {
                  const email = addEmail.trim();
                  const raw = addJersey.trim();
                  void runAction(
                    "add:email",
                    async () => {
                      await addTeamMember(teamSlug, {
                        email,
                        jerseyNumber: raw === "" ? null : raw,
                      });
                      setAddEmail("");
                      setAddJersey("");
                    },
                    `Added ${email} to the roster.`
                  );
                }}
              />
            </View>
          )}
        </Section>
      ) : null}

      {team.viewer.canManage ? (
        <Section
          title="Delete team"
          description="Type the team name exactly to confirm. This can’t be undone."
        >
          <InlineInput
            value={deleteConfirmName}
            onChangeText={setDeleteConfirmName}
            placeholder={team.name}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            accessibilityLabel="Type the team name to confirm"
          />
          <Button
            label="Delete team"
            icon="trash-outline"
            variant="destructiveOutline"
            fullWidth
            loading={busyKey === "delete"}
            disabled={deleteConfirmName.trim() !== team.name.trim()}
            onPress={confirmDelete}
          />
        </Section>
      ) : null}
    </ScreenScroll>
  );
}

function Hero({
  team,
  onSchoolPress,
}: {
  team: TeamDetailContract;
  onSchoolPress: (slug: string) => void;
}) {
  const meta = [
    GENDER_LABELS[team.gender] ?? team.gender,
    REGION_LABELS[team.region] ?? team.region,
    team.season,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <View style={styles.hero}>
      <View style={styles.heroText}>
        <AppText variant="title" accessibilityRole="header">
          {team.name}
        </AppText>
        <AppText variant="subhead" tone="muted">
          {team.university}
        </AppText>
        <AppText variant="subhead" tone="muted">
          {meta}
        </AppText>
      </View>
      <View style={styles.badges}>
        {team.isStandalone ? (
          <StatusBadge kind="verification" status={team.verificationStatus} />
        ) : null}
        {team.viewer.isMember ? (
          <Badge
            tone="info"
            label={
              team.viewer.role
                ? `You · ${TEAM_ROLE_LABELS[team.viewer.role] ?? team.viewer.role}`
                : "You’re on this roster"
            }
          />
        ) : null}
      </View>
      {team.school ? (
        <ListGroup>
          <ListRow
            icon="school-outline"
            title={team.school.name}
            subtitle="School"
            onPress={() => onSchoolPress(team.school!.slug)}
            trailing={
              <StatusBadge kind="verification" status={team.school.verificationStatus} />
            }
          />
        </ListGroup>
      ) : null}
    </View>
  );
}

function MemberRow({
  member,
  jersey,
  busyKey,
  onJerseyChange,
  onSaveJersey,
  onPositionChange,
  onRemove,
}: {
  member: TeamMemberContract;
  jersey: string;
  busyKey: string | null;
  onJerseyChange: (value: string) => void;
  onSaveJersey: () => void;
  onPositionChange: (position: string | null) => void;
  onRemove: () => void;
}) {
  const positionLabel = member.volleyballPosition
    ? VOLLEYBALL_POSITION_LABELS[member.volleyballPosition] ?? member.volleyballPosition
    : null;
  const savedJersey = member.jerseyNumber == null ? "" : String(member.jerseyNumber);
  const jerseyDirty = jersey.trim() !== savedJersey;
  const jerseyBusy = busyKey === `jersey:${member.membershipId}`;
  const positionBusy = busyKey === `position:${member.membershipId}`;
  const removeBusy = busyKey === `remove:${member.membershipId}`;

  return (
    <View style={styles.memberRow}>
      <View style={styles.memberTop}>
        <JerseyBadge number={member.jerseyNumber} />
        <View style={styles.memberText}>
          <AppText variant="callout" weight="600" numberOfLines={2}>
            {member.fullName}
            {member.isViewer ? (
              <AppText variant="callout" tone="muted">
                {" "}(you)
              </AppText>
            ) : null}
          </AppText>
          <View style={styles.badges}>
            <Badge label={TEAM_ROLE_LABELS[member.role] ?? member.role} />
            {!member.canEditPosition && positionLabel ? (
              <Badge label={positionLabel} tone="info" />
            ) : null}
          </View>
        </View>
        {member.canRemove ? (
          <Button
            label={member.isViewer ? "Leave" : "Remove"}
            variant="destructiveOutline"
            size="sm"
            accessibilityLabel={
              member.isViewer ? "Leave team" : `Remove ${member.fullName}`
            }
            loading={removeBusy}
            onPress={onRemove}
          />
        ) : null}
      </View>

      {member.canEditPosition ? (
        <View style={styles.editBlock}>
          <AppText variant="footnote" tone="muted" weight="600">
            Position
          </AppText>
          <VolleyballPositionChips
            value={member.volleyballPosition}
            onChange={onPositionChange}
            disabled={positionBusy}
          />
        </View>
      ) : null}

      {member.canEditJersey ? (
        <View style={styles.jerseyRow}>
          <AppText variant="footnote" tone="muted" weight="600">
            Jersey
          </AppText>
          <InlineInput
            value={jersey}
            onChangeText={onJerseyChange}
            placeholder="#"
            keyboardType="number-pad"
            maxLength={2}
            accessibilityLabel={`Jersey number for ${member.fullName}`}
            style={styles.jerseyField}
          />
          {jerseyDirty || jerseyBusy ? (
            <Button
              label="Save"
              variant="outline"
              size="sm"
              accessibilityLabel={`Save jersey number for ${member.fullName}`}
              loading={jerseyBusy}
              onPress={onSaveJersey}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function CandidateRow({
  candidate,
  jersey,
  busy,
  onJerseyChange,
  onAdd,
}: {
  candidate: TeamRosterCandidateContract;
  jersey: string;
  busy: boolean;
  onJerseyChange: (value: string) => void;
  onAdd: () => void;
}) {
  const role = candidate.schoolRole
    ? SCHOOL_ROLE_LABELS[candidate.schoolRole] ?? candidate.schoolRole
    : null;
  const position = candidate.volleyballPosition
    ? VOLLEYBALL_POSITION_LABELS[candidate.volleyballPosition] ??
      candidate.volleyballPosition
    : null;

  return (
    <View style={styles.memberRow}>
      <View style={styles.memberTop}>
        <View style={styles.memberText}>
          <AppText variant="callout" weight="600" numberOfLines={1}>
            {candidate.fullName}
          </AppText>
          <AppText variant="footnote" tone="muted" numberOfLines={1}>
            {candidate.email}
          </AppText>
          {role || position ? (
            <View style={styles.badges}>
              {role ? <Badge label={role} /> : null}
              {position ? <Badge label={position} tone="info" /> : null}
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.jerseyRow}>
        <InlineInput
          value={jersey}
          onChangeText={onJerseyChange}
          placeholder={
            candidate.jerseyNumber != null ? `#${candidate.jerseyNumber}` : "Jersey #"
          }
          keyboardType="number-pad"
          maxLength={2}
          accessibilityLabel={`Jersey number for ${candidate.fullName}`}
          style={styles.candidateJersey}
        />
        <Button
          label="Add"
          icon="add"
          variant="outline"
          size="sm"
          accessibilityLabel={`Add ${candidate.fullName}`}
          loading={busy}
          onPress={onAdd}
        />
      </View>
    </View>
  );
}

function JerseyBadge({ number }: { number: number | null }) {
  const colors = useThemeColors();
  return (
    <View
      style={[styles.jerseyBadge, { backgroundColor: colors.muted }]}
      accessibilityLabel={number != null ? `Jersey ${number}` : "No jersey number"}
    >
      {number != null ? (
        <AppText variant="subhead" weight="700">
          {number}
        </AppText>
      ) : (
        <Icon name="person-outline" size={16} tone="muted" />
      )}
    </View>
  );
}

function SearchInput(props: Omit<TextInputProps, "style">) {
  const colors = useThemeColors();
  return (
    <View
      style={[
        styles.search,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Icon name="search" size={18} tone="muted" />
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
        placeholderTextColor={colors.mutedForeground}
        accessibilityLabel={props.placeholder}
        {...props}
        style={[styles.searchInput, { color: colors.foreground }]}
      />
    </View>
  );
}

function InlineInput({
  style,
  ...props
}: TextInputProps) {
  const colors = useThemeColors();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor={colors.mutedForeground}
      {...props}
      onFocus={(event) => {
        setFocused(true);
        props.onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        props.onBlur?.(event);
      }}
      style={[
        styles.input,
        {
          color: colors.foreground,
          backgroundColor: colors.card,
          borderColor: focused ? colors.primary : colors.border,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: "center" },
  hero: { gap: space.md },
  heroText: { gap: space.xs },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  form: { gap: space.lg },
  memberRow: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    gap: space.md,
  },
  memberTop: { flexDirection: "row", alignItems: "center", gap: space.md },
  memberText: { flex: 1, minWidth: 0, gap: space.xs },
  editBlock: { gap: space.sm },
  jerseyRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  jerseyBadge: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    ...type.body,
    minHeight: HIT_TARGET,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  jerseyField: { width: 72, textAlign: "center" },
  candidateJersey: { flex: 1 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: HIT_TARGET,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
  },
  searchInput: {
    ...type.body,
    flex: 1,
    minHeight: HIT_TARGET,
    paddingVertical: 0,
  },
});
