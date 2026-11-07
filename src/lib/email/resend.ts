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

import { Resend } from "resend";
import { resolveAppBaseUrl } from "@/lib/metadata";
import {
  emailButtonHtml,
  emailFinePrintHtml,
  emailParagraphsHtml,
  escapeHtml,
  renderBrandedEmail,
} from "@/lib/email/layout";

let resendClient: Resend | null = null;

export function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY is required to send tournament emails. Add it to your environment."
    );
  }

  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }

  return resendClient;
}

export function tournamentEmailFromAddress(): string {
  return (
    process.env.RESEND_FROM_EMAIL ?? "brackt <onboarding@resend.dev>"
  );
}

export function appBaseUrl(): string {
  return resolveAppBaseUrl();
}

export function tournamentPageUrl(slug: string, tab?: string): string {
  const base = `${appBaseUrl()}/tournaments/${slug}`;
  if (!tab || tab === "setup") return base;
  return `${base}?tab=${tab}`;
}

function captainFooterReason(tournamentName: string): string {
  return `You received this because you are listed as a team captain for ${tournamentName} on brackt.`;
}

export function formatCaptainTeamLabels(recipient: {
  teamNames: string[];
  teamUniversities: string[];
}): string {
  return recipient.teamNames
    .map((name, index) => {
      const university = recipient.teamUniversities[index];
      return university ? `${name} (${university})` : name;
    })
    .join(", ");
}

export function formatTournamentEmailSubject(
  tournamentName: string,
  subject: string
): string {
  const trimmed = subject.trim();
  const prefix = `[${tournamentName}]`;
  if (trimmed.toLowerCase().includes(tournamentName.trim().toLowerCase())) {
    return trimmed;
  }
  const combined = `${prefix} ${trimmed}`;
  if (combined.length <= 200) return combined;
  const available = 200 - prefix.length - 1;
  return `${prefix} ${trimmed.slice(0, Math.max(available, 0))}`.trimEnd();
}

export function buildTournamentEmailHeaderText(input: {
  tournamentName: string;
  dateDisplay: string;
  location: string;
  teamLabels: string;
}): string {
  return `${input.tournamentName}
${input.dateDisplay} · ${input.location}
For: ${input.teamLabels}`;
}

export function buildCaptainEmailHtml(input: {
  body: string;
  tournamentName: string;
  dateDisplay: string;
  location: string;
  teamLabels: string;
  ctaUrl?: string;
  ctaLabel?: string;
  footerReason?: string;
}): string {
  const cta =
    input.ctaUrl && input.ctaLabel
      ? emailButtonHtml(input.ctaUrl, input.ctaLabel)
      : "";

  return renderBrandedEmail({
    preheader: input.body.trim().split("\n")[0],
    eyebrow: `${input.dateDisplay} · ${input.location}`,
    title: input.tournamentName,
    contentHtml: `${emailFinePrintHtml(`<strong>For:</strong> ${escapeHtml(input.teamLabels)}`)}${emailParagraphsHtml(input.body)}${cta}`,
    footer: input.footerReason ?? captainFooterReason(input.tournamentName),
  });
}

export function buildCaptainEmailText(input: {
  body: string;
  tournamentName: string;
  dateDisplay: string;
  location: string;
  teamLabels: string;
  ctaUrl?: string;
  ctaLabel?: string;
  footerReason?: string;
}): string {
  const header = buildTournamentEmailHeaderText({
    tournamentName: input.tournamentName,
    dateDisplay: input.dateDisplay,
    location: input.location,
    teamLabels: input.teamLabels,
  });

  const cta =
    input.ctaUrl && input.ctaLabel
      ? `\n\n${input.ctaLabel}: ${input.ctaUrl}`
      : "";

  const footer = `\n\n---\n${
    input.footerReason ?? captainFooterReason(input.tournamentName)
  }`;

  return `${header}\n\n${input.body}${cta}${footer}`;
}
