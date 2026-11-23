import { Schema } from "effect";
import { isMessageKey, isMessageValues } from ".";

/** Schemas for Effect workflows. Kept apart so plain UI code skips Effect. */
export const messageKeySchema = Schema.declare(isMessageKey);
export const messageValuesSchema = Schema.declare(isMessageValues);
