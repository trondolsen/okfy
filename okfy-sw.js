// okfy service worker
//
// Keeps the single-file app shell available offline so an installed okfy can
// be launched without a network. It deliberately does NOT cache or intercept
// bundle content: bundle Markdown, other files and images are untrusted data,
// and the tool already bounds how they are fetched, so they always go to the
// network and are never stored here. A single-file copy of okfy.html that does
// not ship this file simply registers nothing and behaves exactly as before.

"use strict";

// Bump the version to force a refresh of the cached shell.
var CACHE = "okfy-shell-v14";

// The shell is everything the page itself needs to start. Bundle files are not
// part of it and are never added.
var SHELL = [
  "./okfy.html",
  "./favicons/site.webmanifest",
  "./favicons/android-chrome-192x192.png",
  "./favicons/android-chrome-512x512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      // Cache each file on its own, so one missing file does not fail the whole
      // install (a deployment may omit an optional icon).
      return Promise.allSettled(SHELL.map(function (url) { return cache.add(url); }));
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        return key === CACHE ? undefined : caches.delete(key);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function (event) {
  var request = event.request;
  // Only navigations are handled, and only as a fallback. Every other request
  // (including all bundle reads) passes straight through to the network.
  if (request.mode !== "navigate") return;
  event.respondWith(
    fetch(request).catch(function () {
      return caches.open(CACHE).then(function (cache) {
        return cache.match("./okfy.html").then(function (cached) {
          return cached || Response.error();
        });
      });
    })
  );
});
