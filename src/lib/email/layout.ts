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

/**
 * Shared shell for every Resend email. Mirrors the Supabase auth templates in
 * `supabase/templates/` so all brackt mail looks like one product. Email
 * clients ignore <style> blocks inconsistently, so everything is inline and
 * table-based.
 */

export const EMAIL_BRAND_COLOR = "#C93D2E";

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const TEXT_COLOR = "#1a1a1a";
const MUTED_COLOR = "#666666";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Escaped paragraphs for user-written text; blank lines split paragraphs. */
export function emailParagraphsHtml(text: string): string {
  return text
    .trim()
    .split(/\n{2,}/)
    .map(
      (paragraph) =>
        `<p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: ${TEXT_COLOR};">${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`
    )
    .join("");
}

export function emailButtonHtml(url: string, label: string): string {
  return `<p style="margin: 8px 0 24px;"><a href="${escapeHtml(url)}" style="display: inline-block; background: ${EMAIL_BRAND_COLOR}; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; padding: 12px 22px; border-radius: 8px;">${escapeHtml(label)}</a></p>`;
}

export function emailFinePrintHtml(html: string): string {
  return `<p style="margin: 0 0 16px; font-size: 12px; line-height: 1.6; color: ${MUTED_COLOR};">${html}</p>`;
}

export function emailLinkHtml(url: string, label: string): string {
  return `<a href="${escapeHtml(url)}" style="color: ${EMAIL_BRAND_COLOR};">${escapeHtml(label)}</a>`;
}

export function renderBrandedEmail(input: {
  /** Inbox preview line; hidden in the message itself. */
  preheader?: string;
  /** Small context line above the title, e.g. a date and location. */
  eyebrow?: string;
  title: string;
  /** Pre-escaped HTML for the main column. */
  contentHtml: string;
  /** Plain text explaining why the recipient got this email. */
  footer: string;
}): string {
  const preheader = input.preheader
    ? `<div style="display: none; max-height: 0; overflow: hidden; opacity: 0; color: transparent;">${escapeHtml(input.preheader)}</div>`
    : "";
  const eyebrow = input.eyebrow
    ? `<p style="margin: 0 0 8px; font-size: 12px; line-height: 1.5; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: ${MUTED_COLOR};">${escapeHtml(input.eyebrow)}</p>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>${escapeHtml(input.title)}</title>
  </head>
  <body style="margin: 0; padding: 0; background: #f6f5f2;">
    ${preheader}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f6f5f2; padding: 32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background: #ffffff; border: 1px solid #e7e5e0; border-radius: 12px;">
            <tr>
              <td style="padding: 32px 32px 8px; font-family: ${FONT_STACK}; color: ${TEXT_COLOR};">
                <p style="margin: 0 0 28px; font-size: 16px; font-weight: 800; letter-spacing: -0.01em; color: ${EMAIL_BRAND_COLOR};">brackt</p>
                ${eyebrow}
                <h1 style="margin: 0 0 20px; font-size: 24px; line-height: 1.25; font-weight: 700; color: ${TEXT_COLOR};">${escapeHtml(input.title)}</h1>
                ${input.contentHtml}
              </td>
            </tr>
            <tr>
              <td style="padding: 16px 32px 28px; border-top: 1px solid #efede8; font-family: ${FONT_STACK}; font-size: 12px; line-height: 1.6; color: ${MUTED_COLOR};">
                ${escapeHtml(input.footer)}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
