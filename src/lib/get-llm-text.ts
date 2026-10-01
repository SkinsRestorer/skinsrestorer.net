import type { InferPageType } from "fumadocs-core/source";
import { source } from "@/lib/source";

export async function getLLMText(page: InferPageType<typeof source>) {
  const processed = await page.data.getText("processed");

  return `# ${page.data.title}
URL: ${page.url}
SkinsRestorer: ${page.data.version}
Applies to: ${page.data.appliesTo}
Reviewed: ${page.data.reviewed}

${page.data.description}

${processed}`;
}

export async function getFullLLMText() {
  const scanned = await Promise.all(source.getPages().map(getLLMText));

  return scanned.join("\n\n");
}
