import { createRouter } from "@tanstack/react-router";
import { splitLocalePath } from "./lib/i18n";
import { loadMessages } from "./lib/messages";
import { watchNavigationsForStaleChunks } from "./lib/stale-chunks";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const router = createRouter({
    routeTree,
    defaultPreload: "intent",
    scrollRestoration: true,
    // Hydration skips route beforeLoad, so load the page's catalog here.
    // If it cannot load, the page still hydrates, with English text.
    hydrate: () =>
      loadMessages(splitLocalePath(window.location.pathname).locale).catch(
        () => undefined,
      ),
  });
  watchNavigationsForStaleChunks(router);
  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}

declare module "@tanstack/react-start" {
  interface Register {
    ssr: true;
    router: ReturnType<typeof getRouter>;
  }
}
