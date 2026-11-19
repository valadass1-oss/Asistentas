/* Service worker: leidžia programėlę įdiegti ir atidaryti be interneto.
 * Strategija – pirmiausia tinklas (kad visada gautum naujausią versiją),
 * o nesant ryšio – išsaugota kopija. Pakeitus failų sąrašą, padidink VERSIJA. */
var VERSIJA = "asistentas-v2";
var FAILAI = [
  "./", "./index.html", "./parser.js", "./manifest.json", "./icon.svg",
  "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./apple-touch-icon.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSIJA).then(function (c) { return c.addAll(FAILAI); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== VERSIJA; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(VERSIJA).then(function (c) { c.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (hit) {
        return hit || (req.mode === "navigate" ? caches.match("./index.html") : undefined);
      });
    })
  );
});
