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
  SchoolDetailContract,
  SchoolMemberContract,
} from "@/lib/api/contracts/school";
import {
  Redirect,
  useLocalSearchParams,
  useNavigation,
  useRouter,
} from "expo-router";
import { useCallback, useLayoutEffect, useState } from "react";
import { Alert, Linking, StyleSheet, View } from "react-native";
import {
  addSchoolMember,
  cancelSchoolJoin,
  fetchSchool,
  leaveSchool,
  removeSchoolMember,
  requestSchoolJoin,
  resolveSchoolJoinRequest,
  submitSchoolVerification,
  transferSchoolPresidency,
  updateSchoolMemberJersey,
  updateSchoolMemberPosition,
  updateSchoolMemberRole,
} from "~/api/endpoints";
import { useSession } from "~/auth/session";
import { FormField, FormTextInput } from "~/components/create-form";
import {
  GENDER_LABELS,
  REGION_LABELS,
  SCHOOL_ROLE_LABELS,
  SCHOOL_VERIFICATION_LABELS,
  VOLLEYBALL_POSITION_LABELS,
} from "~/lib/format";
import { VolleyballPositionChips } from "~/roster/volleyball-position-chips";
import { useThemeColors } from "~/theme/colors";
import { ErrorScreen, LoadingScreen } from "~/tournament/screen-state";
import { messageFor, usePublicLoader } from "~/tournament/use-public-loader";
import {
  AppText,
  Badge,
  Banner,
  Button,
  Card,
  Chip,
  ChipRow,
  EmptyState,
  HeaderButton,
  Icon,
  ListGroup,
  ListRow,
  ScreenScroll,
  Section,
  SegmentedControl,
  haptics,
  space,
  statusTone,
} from "~/ui";

type TabId = "roster" | "teams";

export default function SchoolDetailScreen() {
  const colors = useThemeColors();
  const navigation = useNavigation();
  const router = useRouter();
  const { session, isLoading: sessionLoading } = useSession();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [tab, setTab] = useState<TabId>("roster");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState<"member" | "officer">("member");
  const [addTitle, setAddTitle] = useState("");
  const [jerseyDrafts, setJerseyDrafts] = useState<Record<string, string>>({});

  const load = useCallback(
    (signal?: AbortSignal) => fetchSchool(slug ?? "", signal),
    [slug]
  );
  const { data, error, isRefreshing, refresh, reload, poll } = usePublicLoader(
    load,
    "Could not load this school."
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: data?.name ?? "School",
      headerRight: data?.viewer.canManageSchool
        ? () => (
            <HeaderButton
              label="Edit"
              accessibilityLabel="Edit school"
              onPress={() => router.push(`/schools/${slug}/edit`)}
            />
          )
        : undefined,
    });
  }, [data?.name, data?.viewer.canManageSchool, navigation, router, slug]);

  if (sessionLoading) return <LoadingScreen />;
  if (!session) return <Redirect href="/sign-in" />;
  if (!slug) {
    return (
      <ErrorScreen
        title="School unavailable"
        message="This link is missing the school. Go back and pick a school from the list."
      />
    );
  }
  if (data === null && error === null) return <LoadingScreen />;
  if (!data) {
    return (
      <ErrorScreen
        title="School unavailable"
        message={error ?? "Could not load this school."}
        onRetry={() => void reload()}
      />
    );
  }

  async function runAction(key: string, action: () => Promise<void>) {
    setBusyKey(key);
    setActionError(null);
    try {
      await action();
      await poll();
      haptics.success();
    } catch (cause) {
      setActionError(messageFor(cause, "Something went wrong."));
      haptics.error();
    } finally {
      setBusyKey(null);
    }
  }

  function confirmRemove(membershipId: string, name: string) {
    Alert.alert("Remove member", `Remove ${name} from this school?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () =>
          void runAction(`remove:${membershipId}`, async () => {
            await removeSchoolMember(slug!, membershipId);
          }),
      },
    ]);
  }

  function confirmTransferPresidency(member: SchoolMemberContract) {
    Alert.alert(
      "Transfer presidency",
      `Make ${member.fullName} the new president? You will become an officer.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Transfer",
          onPress: () =>
            void runAction(`president:${member.membershipId}`, async () => {
              await transferSchoolPresidency(slug!, member.membershipId);
            }),
        },
      ]
    );
  }

  function jerseyValue(membershipId: string, current: number | null) {
    return (
      jerseyDrafts[membershipId] ??
      (current == null ? "" : String(current))
    );
  }

  function confirmLeave() {
    Alert.alert("Leave school", "Leave this school roster?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: () =>
          void runAction("leave", async () => {
            await leaveSchool(slug!);
            router.replace("/schools");
          }),
      },
    ]);
  }

  const rosterOfficers = data.members
    .filter((member) => member.role === "president" || member.role === "officer")
    .sort((a, b) => {
      if (a.role === "president") return -1;
      if (b.role === "president") return 1;
      return a.fullName.localeCompare(b.fullName);
    });
  const rosterMembers = data.members
    .filter((member) => member.role === "member")
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
  const plainOfficerCount = rosterOfficers.filter(
    (member) => member.role === "officer"
  ).length;

  const busy = busyKey !== null;
  const verification = statusTone("verification", data.verificationStatus);

  function saveJersey(member: SchoolMemberContract) {
    void runAction(`jersey:${member.membershipId}`, async () => {
      const raw = jerseyValue(member.membershipId, member.jerseyNumber).trim();
      const jerseyNumber = raw === "" ? null : Number.parseInt(raw, 10);
      await updateSchoolMemberJersey(slug!, member.membershipId, jerseyNumber);
      setJerseyDrafts((prev) => {
        const next = { ...prev };
        delete next[member.membershipId];
        return next;
      });
    });
  }

  const rosterHandlers = {
    busyKey,
    jerseyValue,
    onJerseyDraftChange: (membershipId: string, value: string) =>
      setJerseyDrafts((prev) => ({ ...prev, [membershipId]: value.replace(/\D/g, "") })),
    onJerseySave: saveJersey,
    onPositionChange: (member: SchoolMemberContract, position: string | null) =>
      void runAction(`position:${member.membershipId}`, async () => {
        await updateSchoolMemberPosition(slug!, member.membershipId, position);
      }),
    onTransferPresidency: confirmTransferPresidency,
    onRemove: confirmRemove,
  };

  return (
    <ScreenScroll refreshing={isRefreshing} onRefresh={refresh} gap={space.xl}>
      <View style={styles.hero}>
        <AppText variant="title">{data.name}</AppText>
        <AppText variant="subhead" tone="muted">
          {[
            data.university,
            `${GENDER_LABELS[data.gender] ?? data.gender} · ${REGION_LABELS[data.region] ?? data.region}`,
            data.domainHint ? `@${data.domainHint}` : null,
          ]
            .filter(Boolean)
            .join("\n")}
        </AppText>
        <View style={styles.badgeRow}>
          <Badge
            label={
              SCHOOL_VERIFICATION_LABELS[data.verificationStatus] ??
              data.verificationStatus
            }
            tone={verification.tone}
          />
          {data.viewer.isMember ? (
            <Badge
              label={
                data.viewer.role
                  ? `You · ${SCHOOL_ROLE_LABELS[data.viewer.role] ?? data.viewer.role}`
                  : "You’re on this roster"
              }
              tone="info"
            />
          ) : null}
        </View>
        {data.description ? (
          <AppText variant="callout" style={styles.description}>
            {data.description}
          </AppText>
        ) : null}
        {data.websiteUrl ? (
          <Button
            label="Website"
            icon="open-outline"
            variant="ghost"
            size="sm"
            onPress={() => void Linking.openURL(data.websiteUrl!)}
            style={styles.websiteButton}
          />
        ) : null}
      </View>

      {actionError ? (
        <Banner
          tone="error"
          message={actionError}
          onDismiss={() => setActionError(null)}
        />
      ) : null}

      {data.viewer.canManageSchool && data.verificationStatus !== "verified" ? (
        <VerificationPanel
          school={data}
          busy={busyKey === "verify"}
          disabled={busy}
          onSubmit={() =>
            void runAction("verify", async () => {
              const result = await submitSchoolVerification(slug!);
              Alert.alert(
                "Submitted for verification",
                result.domainMatched
                  ? "An admin will review your school. Your officer emails matched the domain on file."
                  : "An admin will review your school."
              );
            })
          }
        />
      ) : null}

      {data.viewer.hasPendingJoinRequest ? (
        <Card>
          <View style={styles.inlineTitle}>
            <Icon name="time-outline" size={18} tone="warning" />
            <AppText variant="callout" weight="600">
              Join request pending
            </AppText>
          </View>
          <AppText variant="footnote" tone="muted">
            An officer needs to approve your request.
          </AppText>
          <Button
            label="Cancel request"
            variant="outline"
            size="sm"
            loading={busyKey === "cancel-join"}
            disabled={busy}
            onPress={() =>
              void runAction("cancel-join", async () => {
                await cancelSchoolJoin(slug!);
              })
            }
          />
        </Card>
      ) : null}

      {data.viewer.canRequestToJoin ? (
        <Button
          label="Request to join"
          icon="person-add-outline"
          fullWidth
          loading={busyKey === "join"}
          disabled={busy}
          onPress={() =>
            void runAction("join", async () => {
              await requestSchoolJoin(slug!);
            })
          }
        />
      ) : null}

      {!data.viewer.isMember &&
      !data.viewer.hasPendingJoinRequest &&
      data.viewer.joinBlockedReason ? (
        <Banner tone="info" message={data.viewer.joinBlockedReason} />
      ) : null}

      <SegmentedControl
        accessibilityLabel="School sections"
        options={[
          { id: "roster", label: "Roster", count: data.memberCount },
          { id: "teams", label: "Teams", count: data.teams.length },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "roster" ? (
        <>
          {data.viewer.canManageRoster && data.joinRequests.length > 0 ? (
            <Section
              title={`Join requests (${data.joinRequests.length})`}
              description="People with a matching school email. Approve to add them to the roster."
            >
              <ListGroup>
                {data.joinRequests.map((request) => (
                  <View key={request.id} style={styles.memberRow}>
                    <View style={styles.memberText}>
                      <AppText variant="callout" weight="600">
                        {request.fullName}
                      </AppText>
                      <AppText variant="footnote" tone="muted">
                        {request.email}
                      </AppText>
                    </View>
                    <View style={styles.rowActions}>
                      <Button
                        label="Decline"
                        variant="ghost"
                        size="sm"
                        loading={busyKey === `reject:${request.id}`}
                        disabled={busy}
                        onPress={() =>
                          void runAction(`reject:${request.id}`, async () => {
                            await resolveSchoolJoinRequest(slug!, request.id, "reject");
                          })
                        }
                      />
                      <Button
                        label="Approve"
                        size="sm"
                        loading={busyKey === `approve:${request.id}`}
                        disabled={busy}
                        onPress={() =>
                          void runAction(`approve:${request.id}`, async () => {
                            await resolveSchoolJoinRequest(slug!, request.id, "approve");
                          })
                        }
                      />
                    </View>
                  </View>
                ))}
              </ListGroup>
            </Section>
          ) : null}

          {data.members.length === 0 ? (
            <EmptyState
              compact
              icon="people-outline"
              title="No one on the roster yet"
              message={
                data.viewer.canManageRoster
                  ? "Add members by email below."
                  : "Members will appear here once officers add them."
              }
            />
          ) : (
            <>
              {data.viewer.canManageRoster && plainOfficerCount < 1 ? (
                <Banner
                  tone="info"
                  message="Add at least one officer before submitting for verification."
                />
              ) : null}
              <RosterSection
                title={`Officers (${rosterOfficers.length})`}
                emptyMessage="No officers yet."
                members={rosterOfficers}
                showPresidentLabel
                {...rosterHandlers}
                onMakeMember={(member) =>
                  void runAction(`role:${member.membershipId}`, async () => {
                    await updateSchoolMemberRole(slug!, member.membershipId, "member");
                  })
                }
              />
              <RosterSection
                title={`Members (${rosterMembers.length})`}
                emptyMessage="No members yet."
                members={rosterMembers}
                {...rosterHandlers}
                onMakeOfficer={(member) =>
                  void runAction(`role:${member.membershipId}`, async () => {
                    await updateSchoolMemberRole(slug!, member.membershipId, "officer");
                  })
                }
              />
            </>
          )}

          {data.viewer.canManageRoster ? (
            <Section title="Add a member">
              <Card>
                <FormField label="Email" colors={colors}>
                  <FormTextInput
                    value={addEmail}
                    onChangeText={setAddEmail}
                    placeholder="name@school.edu"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    returnKeyType="done"
                    colors={colors}
                  />
                </FormField>
                <FormField label="Role" colors={colors}>
                  <ChipRow>
                    {(["member", "officer"] as const).map((role) => (
                      <Chip
                        key={role}
                        label={SCHOOL_ROLE_LABELS[role] ?? role}
                        selected={addRole === role}
                        onPress={() => setAddRole(role)}
                      />
                    ))}
                  </ChipRow>
                </FormField>
                {addRole === "officer" ? (
                  <FormField label="Title" hint="Optional, e.g. VP or Treasurer" colors={colors}>
                    <FormTextInput
                      value={addTitle}
                      onChangeText={setAddTitle}
                      placeholder="Officer title"
                      maxLength={60}
                      autoCapitalize="words"
                      colors={colors}
                    />
                  </FormField>
                ) : null}
                <Button
                  label="Add to roster"
                  icon="person-add-outline"
                  fullWidth
                  loading={busyKey === "add"}
                  disabled={busy || !addEmail.trim()}
                  onPress={() =>
                    void runAction("add", async () => {
                      await addSchoolMember(slug!, {
                        email: addEmail.trim(),
                        role: addRole,
                        title:
                          addRole === "officer" && addTitle.trim()
                            ? addTitle.trim()
                            : null,
                      });
                      setAddEmail("");
                      setAddRole("member");
                      setAddTitle("");
                    })
                  }
                />
              </Card>
            </Section>
          ) : null}
        </>
      ) : (
        <Section
          action={
            data.viewer.canManageRoster
              ? {
                  label: "New team",
                  onPress: () =>
                    router.push({
                      pathname: "/teams/new",
                      params: { schoolSlug: data.slug },
                    }),
                }
              : undefined
          }
        >
          {data.teams.length === 0 ? (
            <EmptyState
              compact
              icon="people-outline"
              title="No teams yet"
              message="Teams linked to this school will show up here."
            />
          ) : (
            <ListGroup>
              {data.teams.map((team) => (
                <ListRow
                  key={team.slug}
                  icon="people-outline"
                  title={team.name}
                  subtitle={`${GENDER_LABELS[team.gender] ?? team.gender} ${REGION_LABELS[team.region] ?? team.region} · ${team.memberCount} member${team.memberCount === 1 ? "" : "s"}`}
                  onPress={() => router.push(`/teams/${team.slug}`)}
                />
              ))}
            </ListGroup>
          )}
        </Section>
      )}

      {data.viewer.canLeave ? (
        <Button
          label="Leave school"
          variant="destructiveOutline"
          fullWidth
          loading={busyKey === "leave"}
          disabled={busy}
          onPress={confirmLeave}
        />
      ) : null}
    </ScreenScroll>
  );
}

function RosterSection({
  title,
  emptyMessage,
  members,
  busyKey,
  showPresidentLabel = false,
  jerseyValue,
  onJerseyDraftChange,
  onJerseySave,
  onPositionChange,
  onMakeOfficer,
  onMakeMember,
  onTransferPresidency,
  onRemove,
}: {
  title: string;
  emptyMessage: string;
  members: SchoolMemberContract[];
  busyKey: string | null;
  showPresidentLabel?: boolean;
  jerseyValue: (membershipId: string, current: number | null) => string;
  onJerseyDraftChange: (membershipId: string, value: string) => void;
  onJerseySave: (member: SchoolMemberContract) => void;
  onPositionChange: (member: SchoolMemberContract, position: string | null) => void;
  onMakeOfficer?: (member: SchoolMemberContract) => void;
  onMakeMember?: (member: SchoolMemberContract) => void;
  onTransferPresidency?: (member: SchoolMemberContract) => void;
  onRemove: (membershipId: string, name: string) => void;
}) {
  const colors = useThemeColors();
  const busy = busyKey !== null;

  return (
    <Section title={title}>
      {members.length === 0 ? (
        <AppText variant="subhead" tone="muted">
          {emptyMessage}
        </AppText>
      ) : (
        <ListGroup>
          {members.map((member) => {
            const id = member.membershipId;
            const meta = [
              member.title,
              !member.canEditPosition && member.volleyballPosition
                ? VOLLEYBALL_POSITION_LABELS[member.volleyballPosition] ??
                  member.volleyballPosition
                : null,
              !member.canEditJersey && member.jerseyNumber != null
                ? `#${member.jerseyNumber}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ");
            const canMakeOfficer = member.canChangeRole && onMakeOfficer;
            const canMakeMember = member.canChangeRole && onMakeMember;
            const hasActions =
              canMakeOfficer ||
              canMakeMember ||
              (member.canTransferPresidencyTo && onTransferPresidency) ||
              member.canRemove;

            return (
              <View key={id} style={styles.memberBlock}>
                <View style={styles.memberHeader}>
                  <View style={styles.memberText}>
                    <AppText variant="callout" weight="600">
                      {member.fullName}
                      {member.isViewer ? (
                        <AppText variant="callout" tone="muted">
                          {" "}
                          (you)
                        </AppText>
                      ) : null}
                    </AppText>
                    {meta ? (
                      <AppText variant="footnote" tone="muted">
                        {meta}
                      </AppText>
                    ) : null}
                  </View>
                  {showPresidentLabel && member.role === "president" ? (
                    <Badge label={SCHOOL_ROLE_LABELS.president ?? "President"} tone="info" />
                  ) : null}
                </View>

                {member.canEditPosition ? (
                  <VolleyballPositionChips
                    value={member.volleyballPosition}
                    onChange={(position) => onPositionChange(member, position)}
                    disabled={busy}
                  />
                ) : null}

                {member.canEditJersey ? (
                  <View style={styles.jerseyRow}>
                    <AppText variant="subhead" tone="muted">
                      Jersey
                    </AppText>
                    <FormTextInput
                      value={jerseyValue(id, member.jerseyNumber)}
                      onChangeText={(value) => onJerseyDraftChange(id, value)}
                      placeholder="#"
                      accessibilityLabel={`Jersey number for ${member.fullName}`}
                      keyboardType="number-pad"
                      maxLength={2}
                      returnKeyType="done"
                      onSubmitEditing={() => onJerseySave(member)}
                      colors={colors}
                      style={styles.jerseyInput}
                    />
                    <Button
                      label="Save"
                      variant="outline"
                      size="sm"
                      loading={busyKey === `jersey:${id}`}
                      disabled={
                        busy ||
                        jerseyValue(id, member.jerseyNumber) ===
                          (member.jerseyNumber == null ? "" : String(member.jerseyNumber))
                      }
                      onPress={() => onJerseySave(member)}
                    />
                  </View>
                ) : null}

                {hasActions ? (
                  <View style={styles.memberActions}>
                    {canMakeOfficer ? (
                      <Button
                        label="Make officer"
                        variant="outline"
                        size="sm"
                        loading={busyKey === `role:${id}`}
                        disabled={busy}
                        onPress={() => onMakeOfficer!(member)}
                      />
                    ) : canMakeMember ? (
                      <Button
                        label="Make member"
                        variant="outline"
                        size="sm"
                        loading={busyKey === `role:${id}`}
                        disabled={busy}
                        onPress={() => onMakeMember!(member)}
                      />
                    ) : null}
                    {member.canTransferPresidencyTo && onTransferPresidency ? (
                      <Button
                        label="Make president"
                        variant="outline"
                        size="sm"
                        loading={busyKey === `president:${id}`}
                        disabled={busy}
                        onPress={() => onTransferPresidency(member)}
                      />
                    ) : null}
                    {member.canRemove ? (
                      <Button
                        label="Remove"
                        variant="destructiveOutline"
                        size="sm"
                        loading={busyKey === `remove:${id}`}
                        disabled={busy}
                        onPress={() => onRemove(id, member.fullName)}
                      />
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })}
        </ListGroup>
      )}
    </Section>
  );
}

function VerificationPanel({
  school,
  busy,
  disabled,
  onSubmit,
}: {
  school: SchoolDetailContract;
  busy: boolean;
  disabled: boolean;
  onSubmit: () => void;
}) {
  const blockedReason = school.viewer.verificationBlockedReason;
  const canSubmit = school.viewer.canSubmitForVerification;

  return (
    <Card>
      <View style={styles.inlineTitle}>
        <Icon name="shield-checkmark-outline" size={18} tone="primary" />
        <AppText variant="headline">School verification</AppText>
      </View>
      <AppText variant="footnote" tone="muted">
        Verified schools get a badge on their page and can host tournaments.
      </AppText>
      {school.domainMatched ? (
        <AppText variant="footnote" tone="success" weight="600">
          Officer emails matched @{school.domainHint}
        </AppText>
      ) : school.viewer.emailDomainMatches && school.domainHint ? (
        <AppText variant="footnote" tone="muted">
          Your email matches @{school.domainHint}. Officer emails on file are
          checked when you submit.
        </AppText>
      ) : null}
      {blockedReason && !canSubmit ? (
        <AppText variant="footnote" tone="warning">
          {blockedReason}
        </AppText>
      ) : null}
      {canSubmit ? (
        <Button
          label={
            school.verificationStatus === "rejected"
              ? "Resubmit for verification"
              : "Submit for verification"
          }
          size="sm"
          loading={busy}
          disabled={disabled}
          onPress={onSubmit}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  hero: { gap: space.xs },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.xs },
  description: { marginTop: space.sm },
  websiteButton: { marginLeft: -space.md },
  inlineTitle: { flexDirection: "row", alignItems: "center", gap: space.sm },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  memberText: { flex: 1, minWidth: 0, gap: space.xxs },
  rowActions: { flexDirection: "row", gap: space.sm },
  memberBlock: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    gap: space.md,
  },
  memberHeader: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  jerseyRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  jerseyInput: { width: 64, minHeight: 40, textAlign: "center", fontWeight: "600" },
  memberActions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});
