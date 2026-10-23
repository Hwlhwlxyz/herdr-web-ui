// Pure helpers of the scratch notes: what a stored list may hold, and the title a note shows.

export interface Note {
  id: string;
  text: string;
  /** last edit, ms since epoch */
  updated: number;
}

/** A stored value as notes: anything malformed is dropped, never thrown on. */
export function parseNotes(value: unknown): Note[] {
  if (!Array.isArray(value)) return [];
  return value.filter((note): note is Note =>
    typeof note === "object" && note !== null &&
    typeof (note as Note).id === "string" && (note as Note).id !== "" &&
    typeof (note as Note).text === "string" &&
    typeof (note as Note).updated === "number" && Number.isFinite((note as Note).updated));
}

/** The first line with text, cut to `max` characters; "" for an empty note. */
export function titleOf(text: string, max = 40): string {
  const line = text.split(/\r?\n/).find((row) => row.trim() !== "")?.trim() ?? "";
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

/** An id that needs no secure context (crypto.randomUUID is missing on a plain-HTTP LAN address). */
export function newId(now = Date.now()): string {
  return `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
