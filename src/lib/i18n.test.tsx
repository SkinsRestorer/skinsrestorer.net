import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ModelSelector } from "@/components/model-selector";
import { SkinIssueAlerts } from "@/components/editor/skin-issue-alerts";
import {
  docFileInfo,
  isLocale,
  localizeHref,
  localizePath,
  locales,
  splitLocalePath,
} from "./i18n";
import { LocaleProvider } from "./i18n-react";
import {
  catalogs,
  translate,
  createTranslator,
  MessageError,
  isMessageKey,
  type MessageKey,
} from "./messages";
import { getPageHead } from "./seo";

const noop = () => {};

test("locale URLs preserve English permalinks and handoff, texture and section references", () => {
  assert.equal(
    localizePath("/upload?handoff=abc#result", "ru"),
    "/ru/upload?handoff=abc#result",
  );
  assert.equal(
    localizePath("/ru/editor?texture=abc", "pt-BR"),
    "/pt-BR/editor?texture=abc",
  );
  assert.equal(
    localizePath("/pt-BR/docs/installation#before-you-start", "en"),
    "/docs/installation#before-you-start",
  );
  assert.equal(localizePath("/", "es"), "/es");
  assert.deepEqual(splitLocalePath("/pt-BR/docs/installation/"), {
    locale: "pt-BR",
    path: "/docs/installation",
  });
  assert.equal(isLocale("pt"), false);
  assert.equal(isLocale("pt-BR"), true);
  assert.equal(localizeHref("/api/search", "es"), "/api/search");
  assert.equal(localizeHref("/privacy-policy", "ru"), "/privacy-policy");
  assert.equal(
    localizeHref("https://example.com/docs", "ru"),
    "https://example.com/docs",
  );
  assert.equal(
    localizeHref("//example.com/editor", "es"),
    "//example.com/editor",
  );
});

test("Fumadocs filenames map locale suffixes and index files to stable slugs", () => {
  assert.deepEqual(docFileInfo("installation/index.ru.mdx"), {
    locale: "ru",
    path: "/docs/installation",
    slugs: ["installation"],
  });
  assert.deepEqual(docFileInfo("features/skin-editor.pt-BR.mdx"), {
    locale: "pt-BR",
    path: "/docs/features/skin-editor",
    slugs: ["features", "skin-editor"],
  });
  assert.deepEqual(docFileInfo("index.mdx"), {
    locale: "en",
    path: "/docs",
    slugs: [],
  });
});

test("every tool translation is self-canonical with reciprocal hreflang and an English x-default", () => {
  for (const locale of locales) {
    const head = getPageHead("/studio?texture=private#workspace", {
      locale,
      titleKey: "studio.title",
    });
    const canonical = head.links.filter((link) => link.rel === "canonical");
    assert.deepEqual(canonical, [
      {
        rel: "canonical",
        href: `https://skinsrestorer.net${localizePath("/studio", locale)}`,
      },
    ]);
    assert.equal(
      head.links.filter((link) => link.rel === "alternate").length,
      5,
    );
    assert.ok(
      head.links.some(
        (link) =>
          "hrefLang" in link &&
          link.hrefLang === "x-default" &&
          link.href === "https://skinsrestorer.net/studio",
      ),
    );
    for (const other of locales)
      assert.ok(
        head.links.some(
          (link) =>
            "hrefLang" in link &&
            link.hrefLang === other &&
            link.href ===
              `https://skinsrestorer.net${localizePath("/studio", other)}`,
        ),
      );
    assert.ok(
      head.meta.some(
        (tag) =>
          "title" in tag &&
          tag.title === `${translate(locale, "studio.title")} - SR`,
      ),
    );
    assert.ok(
      head.meta.some(
        (tag) =>
          "property" in tag &&
          tag.property === "og:url" &&
          tag.content === canonical[0].href,
      ),
    );
  }
});

test("untranslated docs use the English canonical and never claim a missing translation", () => {
  const head = getPageHead("/ru/docs/development", {
    locale: "ru",
    contentLocale: "en",
    alternatives: ["en"],
    title: "Development",
  });
  assert.equal(
    head.links[0].href,
    "https://skinsrestorer.net/docs/development",
  );
  assert.ok(
    !head.links.some((link) => "hrefLang" in link && link.hrefLang === "ru"),
  );
  assert.ok(
    head.meta.some(
      (tag) =>
        "property" in tag &&
        tag.property === "og:locale" &&
        tag.content === "en_US",
    ),
  );
});

test("translation catalogs keep every message and interpolation parameter in each locale", () => {
  const keys = Object.keys(catalogs.en).sort();
  for (const catalog of Object.values(catalogs)) {
    assert.deepEqual(Object.keys(catalog).sort(), keys);
    for (const [message, value] of Object.entries(catalog)) {
      assert.ok(value.trim(), message);
      const placeholders = (text: string) =>
        [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
      assert.deepEqual(
        placeholders(value),
        placeholders(catalogs.en[message as MessageKey]),
        message,
      );
    }
  }
  assert.equal(
    translate("es", "common.editName", { name: "{private skin}" }),
    "Editar {private skin}",
  );
  assert.equal(
    createTranslator("ru").error(new Error("Unrecognized service error")),
    "Unrecognized service error",
  );
});

test("translated model controls retain identities and accessible arm-width labels", () => {
  const html = renderToStaticMarkup(
    <LocaleProvider locale="es">
      <ModelSelector value="slim" onValueChange={noop} />
    </LocaleProvider>,
  );
  assert.ok(
    html.includes("Clásica, 4 píxeles") ||
      html.includes("Clásica, brazos de 4 píxeles"),
  );
  assert.ok(html.includes("Delgada"));
  const slim = [...html.matchAll(/<button\b[^>]*>/g)].find((match) =>
    match[0].includes('aria-label="Delgada,'),
  );
  assert.ok(slim?.[0].includes('aria-pressed="true"'));
});

test("a clean localized editor renders no issue alert or empty space", () => {
  const html = renderToStaticMarkup(
    <LocaleProvider locale="ru">
      <SkinIssueAlerts
        issues={[]}
        highlighted={null}
        onHighlight={noop}
        onRepair={noop}
        onVariant={noop}
      />
    </LocaleProvider>,
  );
  assert.equal(html, "");
});

test("the translator uses stable keys and never interprets external text as keys", () => {
  const t = createTranslator("es");
  assert.equal(t("common.cancel"), "Cancelar");
  assert.equal(t.message("common.cancel"), "common.cancel");
  assert.equal(t.error(new Error("common.cancel")), "common.cancel");
  assert.equal(isMessageKey("Cancel"), false);
  assert.equal(isMessageKey("common.cancel"), true);
  assert.throws(() => {
    // @ts-expect-error English text is not a translation key.
    t("Cancel");
  }, /Unknown translation key/);
  const cause = new MessageError("errors.imageDimensions", {
    width: 20,
    height: 10,
  });
  assert.ok(cause.message.startsWith("This image is 20×10."));
  assert.ok(t.error(cause).startsWith("Esta imagen mide 20×10."));
  assert.equal(
    t("common.editName", { name: "common.cancel {name}" }),
    "Editar common.cancel {name}",
  );
});

test("raw documentation metadata never resolves as a UI key", () => {
  const head = getPageHead("/docs/example", {
    locale: "es",
    title: "common.cancel",
    description: "studio.title",
  });
  assert.ok(
    head.meta.some(
      (tag) => "title" in tag && tag.title === "common.cancel - SR",
    ),
  );
  assert.ok(
    head.meta.some(
      (tag) =>
        "name" in tag &&
        tag.name === "description" &&
        tag.content === "studio.title",
    ),
  );
});

test("failure messages keep their keys through Effect and async generation state", async () => {
  const { Effect } = await import("effect");
  const { HttpError, runHttpEffect } = await import("./effect-http");
  const { messageFields } = await import("./messages");
  const { StudioGeneration } = await import("./studio-generation");
  const failure = new HttpError({
    reason: "response",
    ...messageFields("errors.serviceReturnedInvalidResponse"),
  });
  await assert.rejects(runHttpEffect(Effect.fail(failure)), (cause) => {
    assert.equal(
      createTranslator("es").error(cause),
      catalogs.es["errors.serviceReturnedInvalidResponse"],
    );
    return true;
  });
  const generation = new StudioGeneration(() => Promise.reject(failure));
  const file = new File(["png"], "common.cancel.png");
  await generation.generate(
    {
      file,
      variant: "slim",
      method: "axolotl",
      purpose: "skin-url",
      name: "",
      capeUuid: "",
    },
    { file, variant: "slim" },
  );
  const state = generation.getSnapshot();
  assert.equal(state.status, "failed");
  if (state.status === "failed")
    assert.equal(
      createTranslator("pt-BR").message(state.message),
      catalogs["pt-BR"]["errors.serviceReturnedInvalidResponse"],
    );
});

test("skin issue details interpolate counts and localize the selected model", async () => {
  const { checkSkin } = await import("./skin-check");
  const { createTemplate, pixelOffset } = await import("./skin-document");
  const { pixels, variant } = createTemplate("classic");
  pixels[pixelOffset(0, 0) + 3] = 255;
  const html = renderToStaticMarkup(
    <LocaleProvider locale="es">
      <SkinIssueAlerts
        issues={checkSkin(pixels, variant)}
        highlighted={null}
        onHighlight={noop}
        onRepair={noop}
        onVariant={noop}
      />
    </LocaleProvider>,
  );
  assert.ok(html.includes("Clásica"));
  assert.ok(!html.includes("editor."));
});

test("blocked painting returns a localizable status without leaking a key", async () => {
  const { startTool } = await import("@/components/editor/editor-types");
  const { SkinEditorStore } = await import("./skin-editor-store");
  const { allPartsVisible, defaultBrush } = await import("./skin-paint");
  let status: import("./messages").Message = "";
  const result = startTool(
    {
      store: new SkinEditorStore(),
      tool: "eraser",
      settings: {
        ...defaultBrush,
        layer: "base",
        color: [0, 0, 0, 255],
        visibility: allPartsVisible(),
      },
      interaction: "paint",
      onPick: noop,
      onPainted: noop,
      onStatus: (value) => {
        status = value;
      },
    },
    8,
    8,
  );
  assert.equal(result, "blocked");
  assert.equal(
    createTranslator("es").message(status),
    catalogs.es["editor.javaEditionAlwaysShowsBaseLayerOpaque"],
  );
});
