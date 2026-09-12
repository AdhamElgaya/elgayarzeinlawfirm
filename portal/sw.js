const CACHE_NAME = "gz-portal-v13";
const OFFLINE_URL = "/portal/offline.html";
const PRECACHE_URLS = [
  OFFLINE_URL,
  "/portal/manifest.json",
  "/portal/login.html",
  "/portal/home.html",
  "/portal/portal.css?v=72",
  "/portal/portal.js?v=22",
  "/styles.css",
  "/i18n-boot.js",
  "/i18n.js",
  "/assets/sign_trans.png?v=2",
  "/assets/sign.png",
  "/assets/gztholothfont.png",
  "/assets/favicon.svg",
];

function isApiRequest(url) {
  return url.pathname.startsWith("/api/");
}

function isCacheableAsset(url) {
  if (url.origin !== self.location.origin) {
    return url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  }
  if (isApiRequest(url)) return false;
  return (
    url.pathname.startsWith("/portal/") ||
    url.pathname.startsWith("/assets/") ||
    url.pathname === "/styles.css" ||
    url.pathname.startsWith("/i18n")
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(PRECACHE_URLS.map((url) => cache.add(url).catch(() => undefined)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (isApiRequest(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && url.origin === self.location.origin) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match(OFFLINE_URL)))
    );
    return;
  }

  if (!isCacheableAsset(url)) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const networked = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networked;
    })
  );
});

self.addEventListener("push", (event) => {
  let payload = {
    title: "تذكير بمهمة",
    body: "اضغط لعرض تفاصيل المهمة",
    url: "/portal/tasks.html",
  };

  try {
    if (event.data) {
      payload = { ...payload, ...event.data.json() };
    }
  } catch {
    /* ignore malformed payload */
  }

  const title = payload.title || "تذكير بمهمة";
  const body = payload.body || "اضغط لعرض تفاصيل المهمة";
  const targetUrl = payload.url || "/portal/tasks.html";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/assets/sign_trans.png?v=2",
      badge: "/assets/sign_trans.png?v=2",
      tag: payload.taskId ? `task-${payload.taskId}` : "portal-task",
      data: {
        url: targetUrl,
        taskId: payload.taskId || null,
      },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/portal/tasks.html";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes("/portal/")) {
          client.postMessage({ type: "portal-open-url", url: targetUrl });
          if ("focus" in client) {
            return client.focus();
          }
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(new URL(targetUrl, self.location.origin).href);
      }
    })
  );
});
