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

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import manifest from "@/app/manifest";

describe("PWA Manifest & Service Worker", () => {
  it("generates a valid PWA web manifest", () => {
    const config = manifest();

    assert.equal(config.name, "brackt | Collegiate Club Volleyball");
    assert.equal(config.short_name, "brackt");
    assert.equal(config.display, "standalone");
    assert.equal(config.start_url, "/explore");
    assert.equal(config.scope, "/");
    assert.equal(config.theme_color, "#c92f45");
    assert.equal(config.background_color, "#09090b");

    // Must have icons including 192, 512, and maskable
    assert.ok(config.icons && config.icons.length >= 3);
    const has192 = config.icons.some((icon) => icon.sizes === "192x192");
    const has512 = config.icons.some((icon) => icon.sizes === "512x512");
    const hasMaskable = config.icons.some((icon) => icon.purpose === "maskable");

    assert.equal(has192, true, "Manifest should include 192x192 icon");
    assert.equal(has512, true, "Manifest should include 512x512 icon");
    assert.equal(hasMaskable, true, "Manifest should include maskable icon");

    // Must have shortcuts for quick access
    assert.ok(config.shortcuts && config.shortcuts.length >= 2);
  });

  it("verifies public/sw.js exists and implements offline caching strategies", () => {
    const swPath = path.join(process.cwd(), "public", "sw.js");
    assert.equal(fs.existsSync(swPath), true, "public/sw.js should exist");

    const content = fs.readFileSync(swPath, "utf-8");
    assert.match(content, /addEventListener\('install'/);
    assert.match(content, /addEventListener\('activate'/);
    assert.match(content, /addEventListener\('fetch'/);
    assert.match(content, /\/offline/);
    assert.match(content, /STATIC_CACHE/);
    assert.match(content, /PAGES_CACHE/);
    assert.match(content, /API_CACHE/);
    assert.match(content, /addEventListener\('push'/);
    assert.match(content, /addEventListener\('notificationclick'/);
  });

  it("verifies PWA icon files exist on disk", () => {
    const publicIcons = path.join(process.cwd(), "public", "icons");
    assert.ok(fs.existsSync(path.join(publicIcons, "icon-192.png")));
    assert.ok(fs.existsSync(path.join(publicIcons, "icon-512.png")));
    assert.ok(fs.existsSync(path.join(publicIcons, "icon-maskable-512.png")));
    assert.ok(fs.existsSync(path.join(publicIcons, "apple-touch-icon.png")));
  });
});
