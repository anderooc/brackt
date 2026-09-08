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

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { cn } from "@/lib/utils";

interface QrCodeProps {
  value: string;
  size?: number;
  margin?: number;
  darkColor?: string;
  lightColor?: string;
  className?: string;
  ariaLabel?: string;
}

export function QrCode({
  value,
  size = 200,
  margin = 1,
  darkColor = "#000000",
  lightColor = "#ffffff",
  className,
  ariaLabel = "QR Code to scan link",
}: QrCodeProps) {
  const [svgContent, setSvgContent] = useState<string>("");

  useEffect(() => {
    let active = true;

    QRCode.toString(value, {
      type: "svg",
      width: size,
      margin,
      color: {
        dark: darkColor,
        light: lightColor,
      },
      errorCorrectionLevel: "M",
    })
      .then((svg) => {
        if (active) {
          setSvgContent(svg);
        }
      })
      .catch((err) => {
        console.error("Failed to render QR Code:", err);
      });

    return () => {
      active = false;
    };
  }, [value, size, margin, darkColor, lightColor]);

  if (!svgContent) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg bg-muted/40 animate-pulse",
          className
        )}
        style={{ width: size, height: size }}
        aria-label={ariaLabel}
      >
        <span className="text-xs text-muted-foreground">Generating QR...</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-lg overflow-hidden bg-white p-2 shadow-sm border border-border/40",
        className
      )}
      role="img"
      aria-label={ariaLabel}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
}
