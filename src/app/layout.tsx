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

import type { Metadata, Viewport } from "next";
import { Outfit, Plus_Jakarta_Sans } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { PwaProvider } from "@/components/pwa/pwa-provider";
import {
  APP_DEFAULT_DESCRIPTION,
  APP_NAME,
  appBaseUrl,
} from "@/lib/metadata";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-family-body",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const outfit = Outfit({
  variable: "--font-family-heading",
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "600", "700", "800"],
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#c92f45" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: appBaseUrl(),
  applicationName: APP_NAME,
  title: {
    default: `${APP_NAME} | Collegiate club volleyball tournaments`,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_DEFAULT_DESCRIPTION,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: APP_NAME,
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: `${APP_NAME} | Collegiate club volleyball tournaments`,
    description: APP_DEFAULT_DESCRIPTION,
    url: "/",
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${APP_NAME} | Collegiate club volleyball tournaments`,
    description: APP_DEFAULT_DESCRIPTION,
    images: ["/opengraph-image"],
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${plusJakarta.variable} ${outfit.variable} h-full`}
    >
      <body
        className={`${plusJakarta.className} flex min-h-full flex-col antialiased`}
      >
        <ThemeProvider>
          <PwaProvider>{children}</PwaProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
