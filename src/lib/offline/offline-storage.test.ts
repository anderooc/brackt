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

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  saveOfflineSnapshot,
  getOfflineSnapshot,
  removeOfflineSnapshot,
  saveTournamentSnapshot,
  getTournamentSnapshot,
  listOfflineTournaments,
  pruneOldSnapshots,
  assertOnlineAction,
  isDeviceOnline,
  OFFLINE_STORAGE_PREFIX,
} from "./offline-storage";

// In-memory mock storage for testing
class MockLocalStorage implements Storage {
  private store: Map<string, string> = new Map();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    const keys = Array.from(this.store.keys());
    return keys[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

describe("offline-storage", () => {
  let mockStorage: MockLocalStorage;
  const originalWindow = globalThis.window;
  const originalNavigatorDesc = Object.getOwnPropertyDescriptor(globalThis, "navigator");

  beforeEach(() => {
    mockStorage = new MockLocalStorage();
    // Setup window and localStorage mock
    globalThis.window = {
      localStorage: mockStorage,
    } as unknown as Window & typeof globalThis;

    Object.defineProperty(globalThis, "navigator", {
      value: { onLine: true },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    globalThis.window = originalWindow;
    if (originalNavigatorDesc) {
      Object.defineProperty(globalThis, "navigator", originalNavigatorDesc);
    }
  });

  it("saves and retrieves typed offline snapshot", () => {
    const key = "test_key";
    const data = { tournamentId: "t123", name: "Peach State Classic" };

    const saved = saveOfflineSnapshot(key, data);
    assert.equal(saved, true);

    const retrieved = getOfflineSnapshot<typeof data>(key);
    assert.ok(retrieved);
    assert.deepEqual(retrieved.data, data);
    assert.equal(retrieved.meta.source, "cache");
    assert.ok(retrieved.meta.savedAtIso);
  });

  it("returns null for non-existent key", () => {
    const result = getOfflineSnapshot("non_existent");
    assert.equal(result, null);
  });

  it("handles expired snapshots properly", () => {
    const key = "expired_key";
    const data = { test: 123 };

    // TTL = -1000ms (already expired)
    saveOfflineSnapshot(key, data, -1000);

    const retrieved = getOfflineSnapshot(key);
    assert.equal(retrieved, null);
    // Should have also cleaned up the storage entry
    assert.equal(mockStorage.getItem(key), null);
  });

  it("removes snapshot successfully", () => {
    const key = "to_remove";
    saveOfflineSnapshot(key, { value: 42 });
    assert.ok(getOfflineSnapshot(key));

    const removed = removeOfflineSnapshot(key);
    assert.equal(removed, true);
    assert.equal(getOfflineSnapshot(key), null);
  });

  it("saves tournament snapshot and updates recent tournaments index", () => {
    const slug = "emory-fall-classic-2026";
    const tournamentData = {
      id: "tourney_1",
      name: "Emory Fall Classic 2026",
      location: "Atlanta, GA",
      startDate: "2026-10-15",
      matches: [{ id: "m1", court: "Court 1" }],
    };

    const saved = saveTournamentSnapshot(slug, tournamentData);
    assert.equal(saved, true);

    const snapshot = getTournamentSnapshot<typeof tournamentData>(slug);
    assert.ok(snapshot);
    assert.equal(snapshot.data.name, "Emory Fall Classic 2026");

    const recent = listOfflineTournaments();
    assert.equal(recent.length, 1);
    assert.equal(recent[0].slug, slug);
    assert.equal(recent[0].name, "Emory Fall Classic 2026");
    assert.equal(recent[0].location, "Atlanta, GA");
  });

  it("updates existing tournament in recent index without duplicate entries", () => {
    const slug = "uga-invitational";
    saveTournamentSnapshot(slug, {
      id: "uga_1",
      name: "UGA Invitational (Draft)",
    });

    saveTournamentSnapshot(slug, {
      id: "uga_1",
      name: "UGA Invitational (Final)",
    });

    const recent = listOfflineTournaments();
    assert.equal(recent.length, 1);
    assert.equal(recent[0].name, "UGA Invitational (Final)");
  });

  it("prunes old snapshots older than 3 days", () => {
    // Save an expired snapshot from 4 days ago
    const oldKey = `${OFFLINE_STORAGE_PREFIX}old_data`;
    const oldPayload = {
      data: { old: true },
      meta: {
        savedAtIso: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString(),
        source: "cache",
      },
    };
    mockStorage.setItem(oldKey, JSON.stringify(oldPayload));

    // Save a fresh snapshot
    const freshKey = `${OFFLINE_STORAGE_PREFIX}fresh_data`;
    saveOfflineSnapshot(freshKey, { fresh: true });

    const prunedCount = pruneOldSnapshots();
    assert.equal(prunedCount, 1);
    assert.equal(mockStorage.getItem(oldKey), null);
    assert.ok(mockStorage.getItem(freshKey));
  });

  it("guards actions when device is offline vs online", () => {
    assert.equal(isDeviceOnline(), true);
    const onlineCheck = assertOnlineAction("score update");
    assert.equal(onlineCheck.allowed, true);
    assert.equal(onlineCheck.error, undefined);

    // Simulate going offline
    Object.defineProperty(globalThis, "navigator", {
      value: { onLine: false },
      configurable: true,
      writable: true,
    });
    assert.equal(isDeviceOnline(), false);

    const offlineCheck = assertOnlineAction("score update");
    assert.equal(offlineCheck.allowed, false);
    assert.match(offlineCheck.error!, /Cannot complete score update while offline/);
  });
});
