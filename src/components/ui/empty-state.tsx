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

import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  NoMatchesIllustration,
  NoResultsIllustration,
  NoTeamsIllustration,
  NoTournamentsIllustration,
} from "@/components/brand/illustrations";
import { cn } from "@/lib/utils";

const ILLUSTRATIONS = {
  teams: NoTeamsIllustration,
  tournaments: NoTournamentsIllustration,
  matches: NoMatchesIllustration,
  results: NoResultsIllustration,
} as const;

export type EmptyStateIllustration = keyof typeof ILLUSTRATIONS;

interface EmptyStateProps {
  icon?: LucideIcon;
  /** Brand artwork shown instead of the icon well. */
  illustration?: EmptyStateIllustration;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  variant?: "card" | "inline";
  /** Brand accent for the icon well. Defaults to primary. */
  accent?: "primary" | "secondary";
}

export function EmptyState({
  icon: Icon,
  illustration,
  title,
  description,
  action,
  className,
  variant = "card",
  accent = "primary",
}: EmptyStateProps) {
  const Art = illustration ? ILLUSTRATIONS[illustration] : null;
  const accentClasses =
    accent === "primary"
      ? "bg-primary/10 text-primary"
      : "bg-secondary text-secondary-foreground";

  const inner = (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden text-center",
        variant === "card" ? "px-6 py-12" : "py-8",
        Art && variant === "card" && "pt-8",
        className
      )}
    >
      {Art ? (
        <Art
          className={cn(
            "mb-3 h-auto",
            variant === "card" ? "w-44 sm:w-52" : "w-36"
          )}
        />
      ) : Icon ? (
        <span
          className={cn(
            "mb-4 flex h-10 w-10 items-center justify-center rounded-md ring-1 ring-inset ring-border/60",
            accentClasses
          )}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      ) : null}
      <p className="font-heading text-base font-semibold tracking-tight text-foreground">
        {title}
      </p>
      {description && (
        <p className="mt-1.5 max-w-sm text-pretty text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );

  if (variant === "inline") return inner;

  return (
    <Card>
      <CardContent className="p-0">{inner}</CardContent>
    </Card>
  );
}
