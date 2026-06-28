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
      icon: "/assets/favicon.png",
      badge: "/assets/favicon.png",
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
