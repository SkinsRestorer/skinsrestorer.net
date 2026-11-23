import assert from "node:assert/strict";
import { test } from "node:test";
import { findTreePages, type SerializedDocsTree } from "./docs-tree";

// Serialized trees hold names as HTML, as `serializePageTree` renders them.
const tree: SerializedDocsTree = {
  $fumadocs_loader: "page-tree",
  data: {
    name: "Documentación",
    children: [
      {
        type: "folder",
        name: "Instalación",
        index: {
          type: "page",
          name: "Instalar SkinsRestorer",
          url: "/es/docs/installation",
        },
        children: [
          {
            type: "page",
            name: "Requisitos &amp; compatibilidad",
            url: "/es/docs/installation/requirements",
          },
        ],
      },
      // A meta file shortcut has no locale prefix.
      {
        type: "page",
        name: "Comandos y permisos",
        url: "/docs/reference/commands-permissions",
      },
    ],
  },
};

// No DOM is registered: the search dialog also renders on the server.
test("finds page titles as text with localized URLs, in the requested order", () => {
  assert.deepEqual(
    findTreePages(tree, "es", [
      "/docs/reference/commands-permissions",
      "/docs/missing",
      "/docs/installation",
      "/docs/installation/requirements",
    ]),
    [
      {
        title: "Comandos y permisos",
        url: "/es/docs/reference/commands-permissions",
      },
      { title: "Instalar SkinsRestorer", url: "/es/docs/installation" },
      {
        title: "Requisitos & compatibilidad",
        url: "/es/docs/installation/requirements",
      },
    ],
  );
});
