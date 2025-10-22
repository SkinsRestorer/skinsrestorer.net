self.addEventListener("install", (_e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (_e) => {
  self.registration
    .unregister()
    .then(() => self.clients.matchAll())
    .then((clients) => {
      for (const client of clients) {
        void client.navigate(client.url);
      }
    });
});
