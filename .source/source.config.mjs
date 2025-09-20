// source.config.ts
import { defineConfig, defineDocs } from "fumadocs-mdx/config";
var docs = defineDocs({
  dir: "content/docs"
});
var source_config_default = defineConfig({
  lastModifiedTime: "git"
});
export {
  source_config_default as default,
  docs
};
