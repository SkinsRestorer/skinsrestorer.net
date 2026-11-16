import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "@/lib/i18n-react";
import type {
  LibraryState,
  useSkinLibrary,
} from "@/lib/hooks/use-skin-library";
import { message } from "@/lib/messages";
import type { SkinContent, StoredSkin } from "@/lib/skin-library";
import { StudioLibrary } from "./studio-library";

const noop = () => {};
const commands = {
  upload: noop,
  create: noop,
  openSkinFile: noop,
  openTexture: noop,
};

const render = (state: LibraryState) =>
  renderToStaticMarkup(
    <LocaleProvider locale="en">
      <StudioLibrary
        library={
          {
            client: undefined,
            state,
            migrated: undefined,
            actions: {},
          } as unknown as ReturnType<typeof useSkinLibrary>
        }
        commands={commands}
        onSelect={noop}
        onReverted={noop}
        layout="rail"
      />
    </LocaleProvider>,
  );

const content: SkinContent = {
  png: new Blob([], { type: "image/png" }),
  hash: "hash",
  pixelKey: "pixels:hash",
  key: "pixels:hash:classic",
  variant: "classic",
  width: 64,
  height: 64,
};

const skin = (id: string, name: string): StoredSkin => ({
  id,
  name,
  current: content,
  original: content,
  revision: 1,
  source: { kind: "file" },
  createdAt: 1,
  updatedAt: 1,
  lastUsedAt: 1,
});

test("an empty library explains where skins come from and offers ways to add one", () => {
  const html = render({
    status: "ready",
    listing: { skins: [], sessions: [], damaged: [] },
  });
  assert.match(html, /No skins yet\./);
  assert.match(html, /Upload a PNG or create a skin\./);
  assert.match(html, /<button[^>]*>.*Upload PNG<\/button>/);
  assert.match(html, /<button[^>]*>.*Create skin<\/button>/);
});

test("blocked storage shows its reason as visible text", () => {
  const html = render({
    status: "unavailable",
    message: message("library.browserDoesNotLetSiteKeepSkins"),
  });
  assert.match(html, /<p[^>]*>This browser does not let the site keep skins/);
  assert.doesNotMatch(html, /No skins yet/);
});

test("blocked storage shows a short status and its reason only once", () => {
  const html = render({
    status: "unavailable",
    message: message("library.browserDoesNotLetSiteKeepSkins"),
  });
  assert.match(html, /<output[^>]*title="Not saving"/);
  assert.equal(
    html.match(/This browser does not let the site keep skins/g)?.length,
    1,
  );
});

test("a library closed by another tab offers a page reload", () => {
  const html = render({
    status: "unavailable",
    message: message("library.anotherTabUpdatedSkinsReloadPage"),
    reload: true,
  });
  assert.match(html, /<button[^>]*>.*Reload page<\/button>/);
  const blocked = render({
    status: "unavailable",
    message: message("library.browserDoesNotLetSiteKeepSkins"),
  });
  assert.doesNotMatch(blocked, /Reload page/);
});

test("a long skin name is truncated with the full name on hover", () => {
  const name = `Harbor ${"x".repeat(70)}`;
  const html = render({
    status: "ready",
    listing: { skins: [skin("a", name)], sessions: [], damaged: [] },
  });
  assert.match(html, new RegExp(`<span title="${name}" class="truncate`));
  assert.doesNotMatch(html, /No skins yet/);
});
