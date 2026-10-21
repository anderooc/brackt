/*
 * brackt - Collegiate club volleyball tournament hub
 * Copyright (C) 2026 Andrew Chang
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import Link from "next/link";
import { PublicSiteFooter } from "@/components/layout/public-site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { getCurrentAuthProfile } from "@/lib/auth";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata(
  "Terms",
  "The rules and responsibilities for using brackt.",
  { canonical: "/terms" }
);

export default async function TermsPage() {
  const user = await getCurrentAuthProfile();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader user={user} />
      <main id="main-content" tabIndex={-1} className="flex-1">
        <article className="container mx-auto max-w-3xl px-4 py-14 sm:py-20">
          <header className="border-b pb-8">
            <h1 className="text-balance text-4xl font-bold tracking-tight">
              Terms of use
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Effective October 21, 2026
            </p>
            <p className="mt-5 max-w-2xl text-pretty leading-relaxed text-foreground/90">
              These terms set expectations for using brackt to organize,
              join, and follow collegiate club volleyball tournaments.
            </p>
          </header>

          <div className="mt-10 space-y-9 text-pretty leading-relaxed text-foreground/90">
            <section className="space-y-3">
              <h2 className="text-2xl font-semibold tracking-tight">
                Accounts and acceptable use
              </h2>
              <p>
                Provide accurate account information, keep your credentials
                secure, and use the service lawfully. Do not attempt to access
                another user&apos;s account, disrupt the service, scrape protected
                data, send spam, upload malicious material, or post abusive or
                misleading content.
              </p>
              <p>
                There is no tolerance for objectionable content or abusive
                users. You can report chat messages and block other users from
                the app. Reports are reviewed, and content or accounts that
                violate these terms are removed. See{" "}
                <Link className="underline" href="/support#report">
                  reporting abuse
                </Link>
                .
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-semibold tracking-tight">
                Organizer responsibilities
              </h2>
              <p>
                Tournament organizers control event details, eligibility,
                registration decisions, schedules, scores, communications,
                waiver settings, and payment instructions. Organizers are
                responsible for the accuracy of that information, obtaining any
                required participant consent, and complying with rules and laws
                that apply to their event.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-semibold tracking-tight">
                Payments and waivers
              </h2>
              <p>
                brackt records payment status but does not process or hold
                funds. Payment disputes remain between organizers and teams.
                Digital acknowledgments and uploaded waiver documents are tools
                for organizers; brackt does not determine whether a waiver is
                legally sufficient or enforceable.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-semibold tracking-tight">
                Content and event records
              </h2>
              <p>
                You retain responsibility for content you submit and grant
                brackt permission to store, process, display, and send it as
                needed to operate the service. Public event information may be
                visible without an account. If an account is deleted, historical
                schedules and results may remain with the organizer identity
                anonymized.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-semibold tracking-tight">
                Availability and enforcement
              </h2>
              <p>
                The service is provided as available and can experience errors,
                delays, or interruptions. Verify safety-critical and game-day
                information through the organizer when necessary. Access may be
                limited or removed for security, abuse, legal compliance, or
                material violations of these terms.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-semibold tracking-tight">
                Changes
              </h2>
              <p>
                These terms may change as brackt evolves. The effective date
                above will be updated when material changes are published.
                Continued use after an update means you accept the revised terms.
              </p>
              <p>
                Read the <Link className="underline" href="/privacy">privacy notice</Link>{" "}
                for details about data handling and account deletion.
              </p>
            </section>
          </div>
        </article>
      </main>
      <PublicSiteFooter />
    </div>
  );
}
