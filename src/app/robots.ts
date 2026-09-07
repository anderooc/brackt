/*
 * brackt - Collegiate club volleyball tournament hub
 * Copyright (C) 2026 Andrew Chang
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { MetadataRoute } from "next";
import { appBaseUrl } from "@/lib/metadata";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = appBaseUrl();

  return {
    rules: {
      userAgent: "*",
      allow: [
        "/",
        "/about",
        "/explore",
        "/login",
        "/privacy",
        "/signup",
        "/terms",
        "/offline",
      ],
      disallow: [
        "/admin",
        "/dashboard",
        "/profile",
        "/schedule",
        "/schools",
        "/teams",
        "/tournaments",
      ],
    },
    sitemap: new URL("/sitemap.xml", baseUrl).toString(),
    host: baseUrl.origin,
  };
}
