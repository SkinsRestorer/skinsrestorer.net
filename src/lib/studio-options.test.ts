import assert from "node:assert/strict";
import { test } from "node:test";
import {
  defaultStudioOptions,
  NO_CAPE_VALUE,
  normalizeStudioOptions,
  studioOptionErrors,
  uploadRoute,
  type StudioOptions,
} from "./studio-options";

const options = (change: Partial<StudioOptions> = {}): StudioOptions => ({
  ...defaultStudioOptions,
  ...change,
});

test("the custom name is optional and checked only for custom skins", () => {
  const context = { purpose: "createcustom", capeStatus: "granted" } as const;
  assert.deepEqual(studioOptionErrors(options(), context), {});
  assert.deepEqual(
    studioOptionErrors(options({ customName: "  lobby_2 " }), context),
    {},
  );
  assert.deepEqual(
    studioOptionErrors(options({ customName: "Lobby skin" }), context),
    { customName: "studio.useLowercaseLettersNumbersUnderscores" },
  );
  // /skin url ignores the name, so it cannot block the form.
  assert.deepEqual(
    studioOptionErrors(options({ customName: "Lobby skin" }), {
      ...context,
      purpose: "skin-url",
    }),
    {},
  );
});

test("a cape with the Official method needs a checked key", () => {
  const chosen = options({ method: "mineskin", capeUuid: "cape-1" });
  for (const capeStatus of ["idle", "loading", "denied"] as const)
    assert.deepEqual(
      studioOptionErrors(chosen, { purpose: "skin-url", capeStatus }),
      { capeUuid: "studio.enterVerifyApiKeyBeforeSelectingCape" },
    );
  assert.deepEqual(
    studioOptionErrors(chosen, { purpose: "skin-url", capeStatus: "granted" }),
    {},
  );
  // Axolotl applies capes without a key.
  assert.deepEqual(
    studioOptionErrors(options({ capeUuid: "cape-1" }), {
      purpose: "skin-url",
      capeStatus: "idle",
    }),
    {},
  );
  assert.deepEqual(
    studioOptionErrors(options({ method: "mineskin" }), {
      purpose: "skin-url",
      capeStatus: "idle",
    }),
    {},
  );
});

test("submitted values are trimmed without changing the form values", () => {
  const value = options({
    customName: "  lobby ",
    apiKey: "  key  ",
    capeUuid: NO_CAPE_VALUE,
  });
  assert.deepEqual(normalizeStudioOptions(value, "createcustom"), {
    purpose: "createcustom",
    method: "axolotl",
    capeUuid: NO_CAPE_VALUE,
    name: "lobby",
    apiKey: "key",
  });
  // The fixed purpose decides: a name typed earlier is not sent with /skin url.
  assert.equal(normalizeStudioOptions(value, "skin-url").name, "");
  assert.equal(value.customName, "  lobby ");
});

test("only Official uploads send the API key", () => {
  const route = (change: Partial<StudioOptions>) =>
    uploadRoute(
      normalizeStudioOptions(
        options({ apiKey: " key ", ...change }),
        "skin-url",
      ),
    );
  assert.deepEqual(route({ method: "mineskin" }), {
    capeUuid: undefined,
    apiKey: "key",
    useCapeProxy: false,
  });
  // A key typed for Official stays out of Axolotl uploads, with or without a cape.
  assert.deepEqual(route({ method: "axolotl" }), {
    capeUuid: undefined,
    apiKey: undefined,
    useCapeProxy: false,
  });
  assert.deepEqual(route({ method: "axolotl", capeUuid: "cape-id" }), {
    capeUuid: "cape-id",
    apiKey: undefined,
    useCapeProxy: true,
  });
  assert.equal(route({ method: "mineskin", apiKey: "  " }).apiKey, undefined);
});
