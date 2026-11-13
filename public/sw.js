self.addEventListener("push", (event) => {
  let payload = { title: "MasAlto Clima", body: "Hay un aviso nuevo." };
  try { payload = { ...payload, ...event.data.json() }; } catch { /* texto plano */ }
  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: "/masalto-logo-negativo.png",
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow("/"));
});
