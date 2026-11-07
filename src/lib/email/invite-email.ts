/*
 * brackt - Collegiate club volleyball tournament hub
 * Copyright (C) 2026 Andrew Chang
 */

import {
  appBaseUrl,
  getResendClient,
  tournamentEmailFromAddress,
} from "@/lib/email/resend";
import {
  emailButtonHtml,
  emailFinePrintHtml,
  emailLinkHtml,
  emailParagraphsHtml,
  renderBrandedEmail,
} from "@/lib/email/layout";

export async function sendMemberInviteEmail(input: {
  to: string;
  token: string;
  inviterName: string;
  targetName: string;
  targetKind: "school" | "team";
}): Promise<void> {
  const inviteUrl = `${appBaseUrl()}/invite/${input.token}`;
  const signupUrl = `${appBaseUrl()}/signup?email=${encodeURIComponent(input.to)}&invite=${encodeURIComponent(input.token)}`;
  const targetLabel = input.targetKind === "school" ? "school" : "team";

  const subject = `${input.inviterName} invited you to join ${input.targetName} on brackt`;
  const body = `Hi,

${input.inviterName} invited you to join ${input.targetName} on brackt.

If you already have an account, open this link while signed in:
${inviteUrl}

If you're new to brackt, create an account first:
${signupUrl}

This invite expires in 14 days.`;

  const html = renderBrandedEmail({
    preheader: `${input.inviterName} invited you to join ${input.targetName} on brackt.`,
    title: `Join ${input.targetName} on brackt`,
    contentHtml: [
      emailParagraphsHtml(
        `${input.inviterName} invited you to join ${input.targetName}. Accept while signed in to brackt and you'll be added to the ${targetLabel}.`
      ),
      emailButtonHtml(inviteUrl, "Accept invite"),
      `<p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6;">New to brackt? ${emailLinkHtml(signupUrl, "Create an account")} with this email first, and the invite will be waiting.</p>`,
      emailFinePrintHtml(
        `This invite expires in 14 days. Button not working? Open ${emailLinkHtml(inviteUrl, inviteUrl)}`
      ),
    ].join(""),
    footer: `You received this because someone invited your email to a ${targetLabel} on brackt. If you weren't expecting it, you can ignore this email.`,
  });

  await getResendClient().emails.send({
    from: tournamentEmailFromAddress(),
    to: input.to,
    subject,
    html,
    text: body,
  });
}
