// Turns a picked line range into text an agent understands: `src/app.ts:10-25` plus the code.

export type CopyFormat = "lines" | "code" | "markdown";

/** `/home/me/api/src/app.ts` under root `/home/me/api` → `src/app.ts`; outside the root it stays absolute. Both separators are accepted. */
export function relativeTo(root: string, path: string): string {
  const norm = (value: string): string => value.replace(/\\/g, "/").replace(/\/+$/, "");
  const base = norm(root);
  const full = norm(path);
  if (base === "") return full;
  const prefix = `${base}/`;
  // a Windows drive path compares without case, as its file system does
  const inside = /^[A-Za-z]:/.test(base) ? full.toLowerCase().startsWith(prefix.toLowerCase()) : full.startsWith(prefix);
  return inside ? full.slice(prefix.length) : full;
}

export function lineLabel(from: number, to: number): string {
  return from === to ? String(from) : `${from}-${to}`;
}

/** Lines `from`..`to` (1-based, inclusive) of `text`. */
export function sliceLines(text: string, from: number, to: number): string {
  return text.split("\n").slice(from - 1, to).join("\n").replace(/\r$/gm, "");
}

export function formatReference(format: CopyFormat, path: string, from: number, to: number, code: string, language: string | null): string {
  const where = `${path}:${lineLabel(from, to)}`;
  switch (format) {
    case "lines": return where;
    case "code": return `${where}\n${code}\n`;
    case "markdown": {
      // a fence longer than any backtick run in the code, so the block cannot end early
      const longest = Math.max(2, ...[...code.matchAll(/`+/g)].map((match) => match[0].length));
      const fence = "`".repeat(longest + 1);
      return `${where}\n${fence}${language ?? ""}\n${code}\n${fence}\n`;
    }
  }
}
