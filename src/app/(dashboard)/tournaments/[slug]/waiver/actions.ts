"use server";

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

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { eq, max } from "drizzle-orm";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  tournamentWaivers,
  tournaments,
  waiverCompletions,
} from "@/lib/db/schema";
import { WAIVER_MAX_BYTES } from "@/lib/supabase/admin";
import { waiverSettingsFromTournament } from "@/lib/tournaments/waiver-access";
import {
  captainAttestWaiverPlayerForUser,
  clearWaiverCompletionForUser,
  hostWaivePlayerWaiverForUser,
  loadRegisteredTeamMembership,
} from "@/lib/tournaments/waiver-player-status";
import { getLatestTournamentWaiver } from "@/lib/tournaments/waiver-compliance";
import {
  tournamentWaiverStoragePath,
  uploadTournamentWaiverPdf,
} from "@/lib/tournaments/waiver-storage";
import { isPdfBytes } from "@/lib/security/pdf";
import {
  canEditTournamentSetup,
  resolveIsTournamentOrganizer,
  tournamentPreparationLockedReason,
} from "@/lib/tournaments/permissions";

const waiverSettingsSchema = z
  .object({
    enabled: z.boolean(),
    allowDownloadPrint: z.boolean(),
    allowThirdParty: z.boolean(),
    allowDigitalAck: z.boolean(),
    thirdPartyUrl: z.string().trim().max(2000),
    requiredBeforeCheckIn: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (!value.enabled) return;
    if (
      !value.allowDownloadPrint &&
      !value.allowThirdParty &&
      !value.allowDigitalAck
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Select at least one way teams can complete the waiver.",
        path: ["enabled"],
      });
    }
    if (value.allowThirdParty && !value.thirdPartyUrl) {
      ctx.addIssue({
        code: "custom",
        message: "Add a third-party signing link or disable that option.",
        path: ["thirdPartyUrl"],
      });
    }
    if (value.thirdPartyUrl) {
      try {
        const url = new URL(value.thirdPartyUrl);
        if (url.protocol !== "https:") {
          throw new Error("invalid");
        }
      } catch {
        ctx.addIssue({
          code: "custom",
          message: "Third-party link must be a valid HTTPS URL.",
          path: ["thirdPartyUrl"],
        });
      }
    }
  });

async function loadOrganizerTournament(tournamentId: string) {
  const user = await requireUser();
  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);

  if (!tournament || !await resolveIsTournamentOrganizer(tournament, user)) {
    return { error: "Only the organizer can manage tournament waivers." as const };
  }

  return { user, tournament };
}

export async function updateTournamentWaiverSettings(
  tournamentId: string,
  input: z.infer<typeof waiverSettingsSchema>
) {
  const loaded = await loadOrganizerTournament(tournamentId);
  if ("error" in loaded) return loaded;
  const { tournament } = loaded;

  if (!await canEditTournamentSetup(tournament, loaded.user)) {
    return {
      error:
        tournamentPreparationLockedReason(tournament) ??
        "Waiver settings cannot be changed in the current tournament stage.",
    };
  }

  const parsed = waiverSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid waiver settings." };
  }

  if (parsed.data.enabled) {
    const waiver = await getLatestTournamentWaiver(tournamentId);
    if (!waiver) {
      return { error: "Upload a waiver PDF before requiring teams to sign." };
    }
  }

  const thirdPartyUrl = parsed.data.allowThirdParty
    ? parsed.data.thirdPartyUrl || null
    : null;

  await db
    .update(tournaments)
    .set({
      waiverEnabled: parsed.data.enabled,
      waiverAllowDownloadPrint: parsed.data.allowDownloadPrint,
      waiverAllowThirdParty: parsed.data.allowThirdParty,
      waiverAllowDigitalAck: parsed.data.allowDigitalAck,
      waiverThirdPartyUrl: thirdPartyUrl,
      waiverRequiredBeforeCheckIn: parsed.data.requiredBeforeCheckIn,
      updatedAt: new Date(),
    })
    .where(eq(tournaments.id, tournamentId));

  revalidatePath("/tournaments/[slug]", "page");
  return { success: true as const };
}

export async function uploadTournamentWaiver(
  tournamentId: string,
  formData: FormData
) {
  const loaded = await loadOrganizerTournament(tournamentId);
  if ("error" in loaded) return loaded;
  const { user, tournament } = loaded;

  if (!await canEditTournamentSetup(tournament, user)) {
    return {
      error:
        tournamentPreparationLockedReason(tournament) ??
        "Waiver files cannot be uploaded in the current tournament stage.",
    };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "Choose a PDF file to upload." };
  }

  if (file.type !== "application/pdf") {
    return { error: "Waiver must be a PDF file." };
  }

  if (file.size > WAIVER_MAX_BYTES) {
    return { error: "Waiver PDF must be 10 MB or smaller." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isPdfBytes(bytes)) {
    return { error: "Waiver must be a valid PDF file." };
  }

  const waiverId = randomUUID();
  const storagePath = tournamentWaiverStoragePath(tournamentId, waiverId);

  const [versionRow] = await db
    .select({ maxVersion: max(tournamentWaivers.version) })
    .from(tournamentWaivers)
    .where(eq(tournamentWaivers.tournamentId, tournamentId));

  const version = (versionRow?.maxVersion ?? 0) + 1;

  try {
    await uploadTournamentWaiverPdf(storagePath, bytes);
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not upload waiver PDF. Check storage configuration.",
    };
  }

  const [inserted] = await db
    .insert(tournamentWaivers)
    .values({
      id: waiverId,
      tournamentId,
      storagePath,
      fileName: file.name,
      version,
      uploadedByUserId: user.id,
    })
    .returning();

  revalidatePath("/tournaments/[slug]", "page");
  return {
    success: true as const,
    waiver: {
      id: inserted.id,
      fileName: inserted.fileName,
      version: inserted.version,
      uploadedAt: inserted.uploadedAt,
    },
  };
}

export async function captainAttestWaiverPlayer(
  tournamentId: string,
  teamId: string,
  playerUserId: string
) {
  const user = await requireUser();
  const result = await captainAttestWaiverPlayerForUser(
    user,
    tournamentId,
    teamId,
    playerUserId
  );
  if (result.success) revalidatePath("/tournaments/[slug]", "page");
  return result;
}

export async function acknowledgeWaiverDigitally(
  tournamentId: string,
  teamId: string,
  signedName: string
) {
  const user = await requireUser();
  const trimmed = signedName.trim();
  if (!trimmed || trimmed.length > 200) {
    return { error: "Enter your full legal name to acknowledge the waiver." };
  }

  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);

  if (!tournament?.waiverEnabled) {
    return { error: "This tournament does not require a waiver." };
  }

  const settings = waiverSettingsFromTournament(tournament);
  if (!settings.allowDigitalAck) {
    return {
      error: "The host does not allow digital acknowledgment for this waiver.",
    };
  }

  const membership = await loadRegisteredTeamMembership(
    tournamentId,
    teamId,
    user.id
  );
  if ("error" in membership) return membership;

  const waiver = await getLatestTournamentWaiver(tournamentId);
  if (!waiver) {
    return { error: "No waiver has been uploaded for this tournament yet." };
  }

  await db
    .insert(waiverCompletions)
    .values({
      waiverId: waiver.id,
      tournamentId,
      teamId,
      userId: user.id,
      method: "digital",
      signedName: trimmed,
    })
    .onConflictDoUpdate({
      target: [waiverCompletions.waiverId, waiverCompletions.userId],
      set: {
        teamId,
        method: "digital",
        signedName: trimmed,
        completedAt: new Date(),
        attestedByUserId: null,
        waivedByUserId: null,
      },
    });

  revalidatePath("/tournaments/[slug]", "page");
  return { success: true as const };
}

export async function hostWaivePlayerWaiver(
  tournamentId: string,
  teamId: string,
  playerUserId: string
) {
  const user = await requireUser();
  const result = await hostWaivePlayerWaiverForUser(
    user,
    tournamentId,
    teamId,
    playerUserId
  );
  if (result.success) revalidatePath("/tournaments/[slug]", "page");
  return result;
}

export async function clearWaiverCompletion(
  tournamentId: string,
  teamId: string,
  playerUserId: string
) {
  const user = await requireUser();
  const result = await clearWaiverCompletionForUser(
    user,
    tournamentId,
    teamId,
    playerUserId
  );
  if (result.success) revalidatePath("/tournaments/[slug]", "page");
  return result;
}
