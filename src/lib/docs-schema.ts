import { Schema } from "effect";

const nonEmptyText = Schema.String.check(Schema.isMinLength(1));
const calendarDate = Schema.String.check(
  Schema.makeFilter((value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Use a valid calendar date";
    const date = new Date(`${value}T00:00:00Z`);
    return (
      (!Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value) ||
      "Use a valid calendar date"
    );
  }),
);

export const docsSchema = Schema.Struct({
  title: Schema.String,
  icon: nonEmptyText,
  description: nonEmptyText,
  full: Schema.optional(Schema.Boolean),
  _openapi: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
  docType: Schema.Literals(["tutorial", "how-to", "reference", "explanation"]),
  appliesTo: nonEmptyText,
  reviewed: calendarDate,
  version: Schema.String.check(Schema.isPattern(/^\d+\.\d+\.\d+$/)),
});

export const docsFrontmatterSchema = Schema.toStandardSchemaV1(docsSchema);
