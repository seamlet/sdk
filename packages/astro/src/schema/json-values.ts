// What a value read from JSON is: every reader of the schema language asks the same questions of
// its input, so they are answered once.

/** An object of named values: not null, not a list. */
export type JsonObject = Readonly<Record<string, unknown>>;

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A string with words in it: a name or a title that cannot be blank. */
export function isText(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}
