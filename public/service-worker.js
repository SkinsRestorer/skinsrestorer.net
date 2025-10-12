self.addEventListener("install", (_e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (_e) => {
  self.registration
    .unregister()
    .then(() => self.clients.matchAll())
    .then((clients) => {
      clients.forEach((client) => client.navigate(client.url));
    });
});
