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

import Link from "next/link";
import { PublicSiteFooter } from "@/components/layout/public-site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { getCurrentAuthProfile } from "@/lib/auth";
import { pageMetadata } from "@/lib/metadata";

const SUPPORT_EMAIL = "support@brack-t.com";

export const metadata = pageMetadata(
  "Support",
  "Get help with brackt, report a problem, or delete your account.",
  { canonical: "/support" }
);

export default async function SupportPage() {
  const user = await getCurrentAuthProfile();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader user={user} />
      <main id="main-content" tabIndex={-1} className="flex-1">
        <article className="container mx-auto max-w-3xl px-4 py-14 sm:py-20">
          <header className="border-b pb-8">
            <h1 className="text-balance text-4xl font-bold tracking-tight">
              Support
            </h1>
            <p className="mt-5 max-w-2xl text-pretty leading-relaxed text-foreground/90">
              Questions about the brackt website or the iOS and Android apps?
              Email{" "}
              <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>
                {SUPPORT_EMAIL}
              </a>{" "}
              and include the tournament or team name if it&apos;s about a
              specific event.
            </p>
          </header>

          <div className="mt-10 space-y-9 text-pretty leading-relaxed text-foreground/90">
            <section className="space-y-3">
              <h2 className="text-2xl font-semibold tracking-tight">
                Questions about an event
              </h2>
              <p>
                Schedules, registration decisions, fees, and waivers are set by
                each tournament&apos;s host. For those, message the host in the
                tournament chat or contact them directly. We&apos;re happy to
                help if something in brackt itself isn&apos;t working.
              </p>
            </section>

            <section id="report" className="space-y-3">
              <h2 className="text-2xl font-semibold tracking-tight">
                Reporting abuse
              </h2>
              <p>
                Abusive, harassing, or objectionable content isn&apos;t
                allowed. In the app, press and hold a chat message to report it
                or to block the person who sent it. Blocking hides all of their
                chat messages from you, and you can undo it under Profile,
                then Blocked users. Every report is reviewed, and content or
                accounts that break the{" "}
                <Link className="underline" href="/terms">
                  terms of use
                </Link>{" "}
                are removed. You can also email {SUPPORT_EMAIL}.
              </p>
            </section>

            <section id="delete-account" className="space-y-3">
              <h2 className="text-2xl font-semibold tracking-tight">
                Deleting your account
              </h2>
              <p>
                In the app, go to Profile, then Delete account. On the website,
                sign in and open your{" "}
                <Link className="underline" href="/profile">
                  profile
                </Link>
                . Deleting your account removes your login, profile details,
                memberships, and chat messages. Schedules and results for
                tournaments you organized stay up with an anonymous organizer
                so other participants keep their event history.
              </p>
              <p>
                Can&apos;t sign in? Email {SUPPORT_EMAIL} from the address on
                your account and we&apos;ll delete it for you.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-semibold tracking-tight">
                Privacy
              </h2>
              <p>
                Read the{" "}
                <Link className="underline" href="/privacy">
                  privacy notice
                </Link>{" "}
                for what brackt collects and how it&apos;s used.
              </p>
            </section>
          </div>
        </article>
      </main>
      <PublicSiteFooter />
    </div>
  );
}
