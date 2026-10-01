import { pageSchema } from "fumadocs-core/source/schema";
import { z } from "zod";

export const docsSchema = pageSchema.extend({
  icon: z.string().min(1),
  description: z.string().min(1),
  docType: z.enum(["tutorial", "how-to", "reference", "explanation"]),
  appliesTo: z.string().min(1),
  reviewed: z.iso.date(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
});
