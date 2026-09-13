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

import type { users, tournaments } from "@/lib/db/schema";
import type { InferSelectModel } from "drizzle-orm";
import type { TournamentTabId } from "./constants";

type User = typeof users.$inferSelect;
type Tournament = InferSelectModel<typeof tournaments>;

type TournamentActivePanelProps = {
  activeTab: TournamentTabId;
  tournament: Tournament;
  user: User;
  canEditSetup: boolean;
  canManageStaff?: boolean;
  preparationLockedReason: string | null;
  myTeamIds: string[];
  captainTeamIds: Set<string>;
  isOrganizer: boolean;
  showPacketTab: boolean;
  showWaiverTab: boolean;
  showPaymentTab: boolean;
  showChatTab: boolean;
  showTeamsTab: boolean;
  showPendingTab: boolean;
  showPoolPlayTab: boolean;
  showBracketTab: boolean;
  showMatchesTab: boolean;
  divisionId: string | null;
  focusPoolId: string | null;
};

/** Loads only the active tab panel module per request (code-split server components). */
export async function TournamentActivePanel({
  activeTab,
  tournament,
  user,
  canEditSetup,
  canManageStaff = false,
  preparationLockedReason,
  myTeamIds,
  captainTeamIds,
  isOrganizer,
  showPacketTab,
  showWaiverTab,
  showPaymentTab,
  showChatTab,
  showTeamsTab,
  showPendingTab,
  showPoolPlayTab,
  showBracketTab,
  showMatchesTab,
  divisionId,
  focusPoolId,
}: TournamentActivePanelProps) {
  switch (activeTab) {
    case "setup": {
      const { TournamentSetupPanel } = await import("./panels/setup-panel");
      return (
        <TournamentSetupPanel
          tournamentId={tournament.id}
          canEditSetup={canEditSetup}
          canManageStaff={canManageStaff}
        />
      );
    }
    case "packet":
      if (!showPacketTab) return null;
      {
        const { TournamentPacketTabPanel } = await import(
          "./panels/packet-panel"
        );
        return (
          <TournamentPacketTabPanel
            tournamentId={tournament.id}
            slug={tournament.slug}
            packetNotes={tournament.packetNotes}
            packetAccentColor={tournament.packetAccentColor ?? null}
            canEdit={canEditSetup}
            lockedReason={preparationLockedReason}
          />
        );
      }
    case "waiver":
      if (!showWaiverTab) return null;
      {
        const { TournamentWaiverTabPanel } = await import(
          "./panels/waiver-panel"
        );
        return (
          <TournamentWaiverTabPanel
            tournament={tournament}
            userId={user.id}
            myTeamIds={myTeamIds}
            captainTeamIds={captainTeamIds}
            isOrganizer={isOrganizer}
            canEditOrganizerSettings={canEditSetup}
            lockedReason={preparationLockedReason}
          />
        );
      }
    case "payment":
      if (!showPaymentTab) return null;
      {
        const { TournamentPaymentTabPanel } = await import(
          "./panels/payment-panel"
        );
        return (
          <TournamentPaymentTabPanel
            tournament={tournament}
            myTeamIds={myTeamIds}
            captainTeamIds={captainTeamIds}
            isOrganizer={isOrganizer}
            canEditOrganizerSettings={canEditSetup}
            lockedReason={preparationLockedReason}
          />
        );
      }
    case "email":
      if (!isOrganizer) return null;
      {
        const { TournamentMessagesTabPanel } = await import(
          "./panels/messages-panel"
        );
        return (
          <TournamentMessagesTabPanel
            tournamentId={tournament.id}
            tournamentName={tournament.name}
            tournamentDate={tournament.date}
            location={tournament.location}
            gender={tournament.gender}
            region={tournament.region}
            status={tournament.status}
            waiverEnabled={tournament.waiverEnabled}
            canEdit={canEditSetup}
            lockedReason={preparationLockedReason}
          />
        );
      }
    case "chat":
      if (!showChatTab) return null;
      {
        const { TournamentChatTabPanel } = await import("./panels/chat-panel");
        return (
          <TournamentChatTabPanel
            tournamentId={tournament.id}
            tournamentStatus={tournament.status}
            organizerId={tournament.organizerId}
          />
        );
      }
    case "teams":
      if (!showTeamsTab) return null;
      {
        const { TournamentRegistrationsPanel } = await import(
          "./panels/registrations-panel"
        );
        return (
          <TournamentRegistrationsPanel
            tournament={tournament}
            user={user}
            listKind="teams"
          />
        );
      }
    case "pending":
      if (!showPendingTab) return null;
      {
        const { TournamentRegistrationsPanel } = await import(
          "./panels/registrations-panel"
        );
        return (
          <TournamentRegistrationsPanel
            tournament={tournament}
            user={user}
            listKind="pending"
          />
        );
      }
    case "pool-play":
      if (!showPoolPlayTab) return null;
      {
        const { TournamentPoolPlayPanel } = await import(
          "./panels/pool-play-panel"
        );
        return (
          <TournamentPoolPlayPanel
            tournament={tournament}
            user={user}
            initialDivisionId={divisionId}
            focusPoolId={focusPoolId}
          />
        );
      }
    case "bracket":
      if (!showBracketTab) return null;
      {
        const { TournamentBracketPanel } = await import(
          "./panels/bracket-panel"
        );
        return (
          <TournamentBracketPanel tournament={tournament} user={user} />
        );
      }
    case "matches":
      if (!showMatchesTab) return null;
      {
        const { TournamentMatchesPanel } = await import(
          "./panels/matches-panel"
        );
        return (
          <TournamentMatchesPanel tournament={tournament} user={user} />
        );
      }
    default:
      return null;
  }
}
