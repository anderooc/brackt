"use client";

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
import { useState, useTransition, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BackLink } from "@/components/layout/back-link";
import { DatePickerField } from "@/components/date-picker";
import { TeamAttributesBadges } from "@/components/team-attributes-badges";
import { AddressMapPreview } from "@/components/address-map-preview";
import { todayISO } from "@/lib/tournament-status";
import {
  PLAY_FORMAT_OPTIONS,
  formatPlayFormatLabel,
  playFormatDescription,
  type PlayFormat,
} from "@/lib/labels/play-format";
import type { HostingSchoolOption } from "@/lib/schools/hosting";
import type { TeamGender, TeamRegion } from "@/types";
import { createTournament } from "../actions";

const FORMAT_SELECT_CONTENT_CLASS =
  "min-w-(--anchor-width) w-max max-w-[min(20rem,calc(100vw-2rem))]";

export function NewTournamentForm({
  hostSchool,
}: {
  hostSchool: HostingSchoolOption | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [date, setDate] = useState(todayISO);
  const [location, setLocation] = useState("");
  const [address, setAddress] = useState("");
  const [playFormat, setPlayFormat] = useState<PlayFormat>("pool_to_bracket");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        const result = await createTournament(formData);
        if (result?.error) {
          setError(result.error);
        }
      } catch {
        // Successful create triggers Next.js redirect (throws) — ignore.
      }
    });
  }

  if (!hostSchool) {
    return (
      <div className="space-y-6">
        <BackLink href="/tournaments">All tournaments</BackLink>
        <Card className="relative mx-auto max-w-lg overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 text-foreground/[0.05] bg-court-lines [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]"
          />
          <CardHeader className="relative">
            <CardTitle as="h1" className="text-xl font-semibold tracking-tight">
              Join or create a school first
            </CardTitle>
            <CardDescription className="text-pretty">
              Tournaments are hosted by a school. You need to be a school
              president or officer, then return here to host an event.
            </CardDescription>
          </CardHeader>
          <CardContent className="relative flex flex-wrap gap-2">
            <Button render={<Link href="/schools/new" />}>Create school</Button>
            <Button variant="outline" render={<Link href="/schools" />}>
              Browse schools
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <BackLink href="/tournaments">All tournaments</BackLink>

      <div className="mx-auto max-w-lg">
        <Card className="shadow-sm shadow-primary/5">
          <CardHeader>
            <CardTitle as="h1" className="text-xl font-semibold tracking-tight">
              Create tournament
            </CardTitle>
            <CardDescription className="text-pretty">
              You&apos;ll be set as the organizer. Gender and region are
              inherited from your hosting school.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4" aria-busy={isPending}>
              <div className="space-y-2">
                <Label>Hosting school</Label>
                <div className="rounded-md border border-border/80 bg-muted/30 px-3 py-2">
                  <p className="text-sm font-medium">{hostSchool.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {hostSchool.university}
                  </p>
                  <TeamAttributesBadges
                    gender={hostSchool.gender as TeamGender}
                    region={hostSchool.region as TeamRegion}
                    className="mt-2"
                  />
                </div>
                <input type="hidden" name="hostSchoolId" value={hostSchool.id} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Tournament name</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="Spring Invitational 2026"
                  required
                  disabled={isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">
                  Description{" "}
                  <span className="text-xs text-muted-foreground">
                    (optional)
                  </span>
                </Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Start time, fees, format, and other details for teams..."
                  rows={3}
                  disabled={isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="play-format">Tournament format</Label>
                <Select
                  value={playFormat}
                  onValueChange={(value) =>
                    setPlayFormat((value as PlayFormat) ?? "pool_to_bracket")
                  }
                  disabled={isPending}
                >
                  <SelectTrigger
                    id="play-format"
                    className="w-full"
                    title={playFormatDescription(playFormat)}
                  >
                    <SelectValue>
                      {(v) => formatPlayFormatLabel(v ?? "pool_to_bracket")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent
                    side="bottom"
                    alignItemWithTrigger={false}
                    className={FORMAT_SELECT_CONTENT_CLASS}
                  >
                    {PLAY_FORMAT_OPTIONS.map((format) => (
                      <SelectItem
                        key={format.value}
                        value={format.value}
                        multiline
                        title={format.description}
                      >
                        <span className="flex min-w-0 flex-col items-start gap-0.5 text-left">
                          <span className="leading-snug">{format.label}</span>
                          <span className="text-xs font-normal leading-snug text-muted-foreground">
                            {format.description}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" name="playFormat" value={playFormat} />
                <p className="text-xs text-muted-foreground">
                  Every pool in this tournament uses the same format.
                </p>
              </div>
              <DatePickerField
                id="date"
                label="Date"
                name="date"
                value={date}
                onChange={setDate}
                required
                placement="top"
                rangeFromDates={[date]}
                disabled={isPending}
              />
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  name="location"
                  placeholder="University Gym"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  disabled={isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">
                  Address{" "}
                  <span className="text-xs text-muted-foreground">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="address"
                  name="address"
                  placeholder="123 Main St, City, ST 12345"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  disabled={isPending}
                />
                <AddressMapPreview
                  address={address}
                  location={location}
                  height={160}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending && <Loader2 className="size-4 animate-spin" />}
                {isPending ? "Creating..." : "Create tournament"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
