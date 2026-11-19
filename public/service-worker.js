// @ts-check
// Retire the old service worker. It unregisters itself and reloads the
// pages it controlled, so they load from the network again.

const worker = self;
if (!(worker instanceof ServiceWorkerGlobalScope)) {
  throw new TypeError("service-worker.js must run as a service worker");
}

worker.addEventListener("install", () => {
  void worker.skipWaiting();
});

worker.addEventListener("activate", () => {
  worker.registration
    .unregister()
    .then(() => worker.clients.matchAll({ type: "window" }))
    .then((clients) => {
      for (const client of clients) {
        void client.navigate(client.url);
      }
    })
    .catch(reportError);
});
