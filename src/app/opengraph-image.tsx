/*
 * brackt - Collegiate club volleyball tournament hub
 * Copyright (C) 2026 Andrew Chang
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "brackt — collegiate club volleyball tournament hub";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Serves the Center Court social preview exported from Figma. */
export default async function OpenGraphImage() {
  const art = await readFile(join(process.cwd(), "public/brand/social-preview.png"));
  return new Response(new Uint8Array(art), {
    headers: { "Content-Type": contentType },
  });
}
