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

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `brackt-static-${CACHE_VERSION}`;
const PAGES_CACHE = `brackt-pages-${CACHE_VERSION}`;
const API_CACHE = `brackt-api-${CACHE_VERSION}`;
const OFFLINE_CACHE = `brackt-offline-${CACHE_VERSION}`;

const CURRENT_CACHES = [
  STATIC_CACHE,
  PAGES_CACHE,
  API_CACHE,
  OFFLINE_CACHE,
];

// Core assets required for offline shell
const PRECACHE_ASSETS = [
  '/offline',
  '/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/manifest.webmanifest',
];

// Maximum cached items per cache bucket to prevent unbounded growth
const MAX_PAGES_ITEMS = 30;
const MAX_API_ITEMS = 50;

/**
 * Trim cache to maxItems
 */
async function trimCache(cacheName, maxItems) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxItems) {
      await cache.delete(keys[0]);
      trimCache(cacheName, maxItems);
    }
  } catch {
    // Ignore errors during cache trimming
  }
}

// Install Event: Pre-cache offline shell and activate immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(OFFLINE_CACHE)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate Event: Clear outdated caches and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames.map((cacheName) => {
            if (!CURRENT_CACHES.includes(cacheName)) {
              return caches.delete(cacheName);
            }
            return null;
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch Event: Implement Stale-While-Revalidate and Network-First gym fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests and http/https schemes
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // Bypass auth, telemetry, and external third-party API calls
  if (
    url.pathname.startsWith('/auth') ||
    url.pathname.startsWith('/api/v1/auth') ||
    url.hostname.includes('supabase.co')
  ) {
    return;
  }

  // 1. Navigation requests (HTML pages)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            const copy = response.clone();
            caches.open(PAGES_CACHE).then((cache) => {
              cache.put(request, copy);
              trimCache(PAGES_CACHE, MAX_PAGES_ITEMS);
            });
          }
          return response;
        })
        .catch(async () => {
          // Check if the page is already cached
          const cachedPage = await caches.match(request);
          if (cachedPage) {
            return cachedPage;
          }

          // Otherwise serve the pre-cached offline fallback
          const offlinePage = await caches.match('/offline');
          if (offlinePage) {
            return offlinePage;
          }

          return new Response(
            '<!DOCTYPE html><html><head><title>Offline</title></head><body><h1>Offline</h1><p>Check your gym connection.</p></body></html>',
            {
              headers: { 'Content-Type': 'text/html' },
              status: 503,
            }
          );
        })
    );
    return;
  }

  // 2. Next.js Static Chunks, Images, Fonts, and PWA Icons (Stale-While-Revalidate)
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/icon.svg' ||
    url.pathname === '/favicon.ico' ||
    url.pathname === '/manifest.webmanifest'
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse.status === 200) {
              const copy = networkResponse.clone();
              caches.open(STATIC_CACHE).then((cache) => {
                cache.put(request, copy);
              });
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // 3. Read-only Tournament & Schedule APIs (Network-First with Cache Fallback)
  if (
    url.pathname.startsWith('/api/v1/tournaments') ||
    url.pathname.startsWith('/api/v1/explore') ||
    url.pathname.startsWith('/api/v1/schedule')
  ) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(API_CACHE).then((cache) => {
              cache.put(request, copy);
              trimCache(API_CACHE, MAX_API_ITEMS);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            // Add custom header to indicate offline cached payload
            const headers = new Headers(cachedResponse.headers);
            headers.set('X-Brackt-Offline', 'true');
            return new Response(cachedResponse.body, {
              status: cachedResponse.status,
              statusText: cachedResponse.statusText,
              headers,
            });
          }
          return new Response(
            JSON.stringify({
              error: 'Offline: Cannot reach server and no cached copy is available.',
              offline: true,
            }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        })
    );
    return;
  }

  // 4. Fallback default
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});

// Message listener for skip waiting or cache purge
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data && event.data.type === 'CLEAR_OFFLINE_CACHE') {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
    );
  }
});

// Web Push: show notification from push payload
self.addEventListener('push', (event) => {
  let payload = {
    title: 'brackt',
    body: '',
    data: {},
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      payload = {
        title: typeof parsed.title === 'string' && parsed.title ? parsed.title : 'brackt',
        body: typeof parsed.body === 'string' ? parsed.body : '',
        data:
          parsed.data && typeof parsed.data === 'object' && !Array.isArray(parsed.data)
            ? parsed.data
            : {},
      };
    }
  } catch {
    // Keep defaults when payload is missing or invalid.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body || undefined,
      data: payload.data,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
    })
  );
});

// Open the linked page (or notifications inbox) when the user taps a push
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const rawHref =
    event.notification.data && typeof event.notification.data.href === 'string'
      ? event.notification.data.href
      : '/notifications';
  const targetUrl = new URL(
    rawHref.startsWith('/') ? rawHref : '/notifications',
    self.location.origin
  ).href;

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.startsWith(self.location.origin) && 'focus' in client) {
            return client.focus().then((focused) => {
              if (focused && 'navigate' in focused) {
                return focused.navigate(targetUrl);
              }
              return focused;
            });
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
        return null;
      })
  );
});
