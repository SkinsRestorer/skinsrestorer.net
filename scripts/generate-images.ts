import { Effect } from "effect";
import { generateStaticImages } from "./lib/static-images";

const result = await Effect.runPromise(
  generateStaticImages({
    publicDirectory: new URL("../public/", import.meta.url),
    metadataFile: new URL("../src/lib/image-metadata.json", import.meta.url),
    preserveSources: [
      "/skinsrestorer-skin.png",
      "/skinsrestorer-character.png",
    ],
  }),
);
console.log(
  `Generated ${result.variants} static image variants for ${result.images} images.`,
);
