import { describe, expect, it } from "bun:test";

import { formatReference, relativeTo, sliceLines } from "./reference.ts";

describe("relativeTo", () => {
  it("cuts the root off a path inside it", () => {
    expect(relativeTo("/home/me/api", "/home/me/api/src/app.ts")).toBe("src/app.ts");
    expect(relativeTo("/home/me/api/", "/home/me/api/src/app.ts")).toBe("src/app.ts");
  });
  it("keeps a path outside the root, and a sibling with the same prefix, whole", () => {
    expect(relativeTo("/home/me/api", "/home/me/web/x.ts")).toBe("/home/me/web/x.ts");
    expect(relativeTo("/home/me/api", "/home/me/api2/x.ts")).toBe("/home/me/api2/x.ts");
  });
  it("reads Windows paths with either separator and any case", () => {
    expect(relativeTo("C:\\work\\api", "c:\\Work\\api\\src\\app.ts")).toBe("src/app.ts");
  });
});

describe("formatReference", () => {
  const code = sliceLines("a\nb\nc\nd\n", 2, 3);
  it("slices the lines asked for", () => expect(code).toBe("b\nc"));
  it("writes each format", () => {
    expect(formatReference("lines", "src/a.ts", 2, 3, code, "ts")).toBe("src/a.ts:2-3");
    expect(formatReference("lines", "src/a.ts", 4, 4, "d", "ts")).toBe("src/a.ts:4");
    expect(formatReference("code", "src/a.ts", 2, 3, code, "ts")).toBe("src/a.ts:2-3\nb\nc\n");
    expect(formatReference("markdown", "src/a.ts", 2, 3, code, "ts")).toBe("src/a.ts:2-3\n```ts\nb\nc\n```\n");
  });
  it("fences code holding backticks with a longer fence", () => {
    expect(formatReference("markdown", "a.md", 1, 1, "````", null)).toBe("a.md:1\n`````\n````\n`````\n");
  });
});
