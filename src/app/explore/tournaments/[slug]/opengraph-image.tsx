/*
 * brackt - Collegiate club volleyball tournament hub
 * Copyright (C) 2026 Andrew Chang
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { bracktLogoSvgMarkup } from "@/components/brand/logo";
import {
  COVER_SCENE_ASPECT,
  coverSceneSvgMarkup,
} from "@/components/brand/cover-scene";
import { formatTournamentDateDisplay } from "@/lib/date-iso";
import { loadPublicTournamentShell } from "@/lib/tournament-public/load-shell";

export const alt = "Tournament on brackt";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#17243C";
const COURT = "#315CA8";
const NET = "#C92F45";
const MUTED = "#4A5B78";
const MIST = "#EFF4FB";

const STATUS_PILLS: Record<string, { label: string; color: string } | undefined> = {
  registration_open: { label: "Registration open", color: COURT },
  in_progress: { label: "Live now", color: NET },
  completed: { label: "Final results", color: COURT },
};

function nameFontSize(name: string) {
  if (name.length <= 18) return 76;
  if (name.length <= 30) return 64;
  if (name.length <= 48) return 54;
  return 44;
}

const asset = (path: string) => readFile(join(process.cwd(), path));

const dataUrl = (mime: string, bytes: Buffer | string) =>
  `url("data:${mime};base64,${Buffer.from(bytes).toString("base64")}")`;

/** Share card for a tournament: details beside the court-and-net cover scene. */
export default async function TournamentOpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let shell: Awaited<ReturnType<typeof loadPublicTournamentShell>>;
  try {
    shell = await loadPublicTournamentShell(slug);
  } catch {
    const fallback = await asset("public/brand/social-preview.png");
    return new Response(new Uint8Array(fallback), {
      headers: { "Content-Type": contentType },
    });
  }

  const [semibold, extrabold] = await Promise.all([
    asset("src/assets/fonts/archivo-latin-600-normal.woff"),
    asset("src/assets/fonts/archivo-latin-800-normal.woff"),
  ]);
  const sceneHeight = 560;
  const sceneWidth = Math.round(sceneHeight * COVER_SCENE_ASPECT);

  const { name, date, location, status } = shell.listItem;
  const pill = STATUS_PILLS[status];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          fontFamily: "Archivo",
          backgroundColor: MIST,
          backgroundImage:
            "radial-gradient(ellipse 70% 80% at 0% 0%, rgba(49, 92, 168, 0.16), transparent 70%)",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: 28,
            top: (630 - sceneHeight) / 2,
            width: sceneWidth,
            height: sceneHeight,
            backgroundImage: dataUrl("image/svg+xml", coverSceneSvgMarkup()),
            backgroundSize: `${sceneWidth}px ${sceneHeight}px`,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 72,
            top: 64,
            bottom: 84,
            width: 500,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              width: 193,
              height: 40,
              backgroundImage: dataUrl("image/svg+xml", bracktLogoSvgMarkup()),
              backgroundSize: "193px 40px",
            }}
          />

          <div style={{ display: "flex", flexDirection: "column" }}>
            {pill ? (
              <div style={{ display: "flex", marginBottom: 22 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 16px",
                    borderRadius: 999,
                    background: "white",
                    color: pill.color,
                    fontSize: 22,
                    fontWeight: 800,
                  }}
                >
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      background: pill.color,
                    }}
                  />
                  {pill.label}
                </div>
              </div>
            ) : null}
            <div
              style={{
                color: COURT,
                fontSize: 26,
                fontWeight: 800,
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              {formatTournamentDateDisplay(date)}
            </div>
            <div
              style={{
                marginTop: 14,
                color: INK,
                fontSize: nameFontSize(name),
                fontWeight: 800,
                lineHeight: 1.04,
                letterSpacing: -1.5,
              }}
            >
              {name}
            </div>
            <div
              style={{
                marginTop: 20,
                color: MUTED,
                fontSize: 28,
                fontWeight: 600,
              }}
            >
              {location}
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Archivo", data: semibold, weight: 600, style: "normal" },
        { name: "Archivo", data: extrabold, weight: 800, style: "normal" },
      ],
    }
  );
}
