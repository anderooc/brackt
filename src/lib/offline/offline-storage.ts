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

/**
 * Storage key constants for tournament & schedule offline caching.
 */
export const OFFLINE_STORAGE_PREFIX = "brackt_offline_";
export const TOURNAMENT_SNAPSHOT_PREFIX = `${OFFLINE_STORAGE_PREFIX}tournament_`;
export const SCHEDULE_SNAPSHOT_PREFIX = `${OFFLINE_STORAGE_PREFIX}schedule_`;
export const RECENT_TOURNAMENTS_KEY = `${OFFLINE_STORAGE_PREFIX}recent_tournaments`;

export interface OfflineSnapshotMeta {
  savedAtIso: string;
  expiresAtIso?: string;
  source: "cache" | "live";
}

export interface StoredOfflineSnapshot<T> {
  data: T;
  meta: OfflineSnapshotMeta;
}

export interface OfflineTournamentSummary {
  id: string;
  slug: string;
  name: string;
  location?: string | null;
  startDate?: string | null;
  savedAtIso: string;
}

/**
 * Safely access window.localStorage without throwing in SSR or restricted environments.
 */
function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Save an arbitrary typed snapshot into localStorage.
 */
export function saveOfflineSnapshot<T>(
  key: string,
  data: T,
  ttlMs = 1000 * 60 * 60 * 24 * 3 // 3 days default TTL
): boolean {
  const storage = getStorage();
  if (!storage) return false;

  try {
    const payload: StoredOfflineSnapshot<T> = {
      data,
      meta: {
        savedAtIso: new Date().toISOString(),
        expiresAtIso: new Date(Date.now() + ttlMs).toISOString(),
        source: "cache",
      },
    };
    storage.setItem(key, JSON.stringify(payload));
    return true;
  } catch (err) {
    // QuotaExceededError or disabled storage
    if (err instanceof DOMException && err.name === "QuotaExceededError") {
      pruneOldSnapshots();
    }
    return false;
  }
}

/**
 * Retrieve a typed snapshot from localStorage, returning null if expired or missing.
 */
export function getOfflineSnapshot<T>(
  key: string
): StoredOfflineSnapshot<T> | null {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(key);
    if (!raw) return null;

    const parsed: StoredOfflineSnapshot<T> = JSON.parse(raw);
    if (parsed.meta?.expiresAtIso) {
      const expires = new Date(parsed.meta.expiresAtIso).getTime();
      if (Date.now() > expires) {
        storage.removeItem(key);
        return null;
      }
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Delete a specific snapshot from localStorage.
 */
export function removeOfflineSnapshot(key: string): boolean {
  const storage = getStorage();
  if (!storage) return false;

  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Save a tournament payload and index it in the recent offline tournaments list.
 */
export function saveTournamentSnapshot<
  T extends Record<string, unknown>
>(
  slug: string,
  data: T
): boolean {
  const key = `${TOURNAMENT_SNAPSHOT_PREFIX}${slug}`;
  const success = saveOfflineSnapshot(key, data);
  if (!success) return false;

  // Update recent offline tournaments index
  try {
    const storage = getStorage();
    if (!storage) return success;

    const recentRaw = storage.getItem(RECENT_TOURNAMENTS_KEY);
    const recent: OfflineTournamentSummary[] = recentRaw ? JSON.parse(recentRaw) : [];

    const existingIndex = recent.findIndex((item) => item.slug === slug);
    const summary: OfflineTournamentSummary = {
      id: typeof data.id === "string" ? data.id : slug,
      slug,
      name: typeof data.name === "string" ? data.name : slug,
      location: typeof data.location === "string" ? data.location : null,
      startDate: typeof data.startDate === "string" ? data.startDate : null,
      savedAtIso: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      recent[existingIndex] = summary;
    } else {
      recent.unshift(summary);
    }

    // Keep up to 10 recent offline tournaments
    storage.setItem(RECENT_TOURNAMENTS_KEY, JSON.stringify(recent.slice(0, 10)));
  } catch {
    // Ignore index errors
  }

  return true;
}

/**
 * Retrieve tournament snapshot by slug.
 */
export function getTournamentSnapshot<T>(slug: string): StoredOfflineSnapshot<T> | null {
  return getOfflineSnapshot<T>(`${TOURNAMENT_SNAPSHOT_PREFIX}${slug}`);
}

/**
 * Get list of recently saved offline tournaments.
 */
export function listOfflineTournaments(): OfflineTournamentSummary[] {
  const storage = getStorage();
  if (!storage) return [];

  try {
    const raw = storage.getItem(RECENT_TOURNAMENTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Prune snapshots older than 3 days when storage quota is reached.
 */
export function pruneOldSnapshots(): number {
  const storage = getStorage();
  if (!storage) return 0;

  let prunedCount = 0;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && key.startsWith(OFFLINE_STORAGE_PREFIX)) {
        try {
          const raw = storage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed?.meta?.savedAtIso) {
              const ageMs = Date.now() - new Date(parsed.meta.savedAtIso).getTime();
              if (ageMs > 1000 * 60 * 60 * 24 * 3) {
                keysToRemove.push(key);
              }
            }
          }
        } catch {
          keysToRemove.push(key);
        }
      }
    }

    for (const key of keysToRemove) {
      storage.removeItem(key);
      prunedCount++;
    }
  } catch {
    // Ignore errors during prune
  }

  return prunedCount;
}

/**
 * Guard utility for mutations: check if the device is currently online.
 */
export function isDeviceOnline(): boolean {
  if (typeof window === "undefined") return true;
  return navigator.onLine;
}

/**
 * Guard utility for mutations: returns error message if offline.
 */
export function assertOnlineAction(actionLabel = "this action"): {
  allowed: boolean;
  error?: string;
} {
  if (!isDeviceOnline()) {
    return {
      allowed: false,
      error: `Cannot complete ${actionLabel} while offline. Please reconnect to the gym network and try again.`,
    };
  }
  return { allowed: true };
}
