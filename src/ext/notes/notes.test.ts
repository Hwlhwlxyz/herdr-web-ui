import { describe, expect, test } from "bun:test";

import { newId, parseNotes, titleOf } from "./notes.ts";

describe("parseNotes", () => {
  test("keeps well-formed notes and drops the rest", () => {
    const good = { id: "a", text: "hi", updated: 1 };
    expect(parseNotes([good, { id: "", text: "x", updated: 1 }, { id: "b", text: 2, updated: 1 }, null, "x"])).toEqual([good]);
  });

  test("anything but an array is no notes", () => {
    expect(parseNotes(null)).toEqual([]);
    expect(parseNotes({ id: "a" })).toEqual([]);
  });
});

describe("titleOf", () => {
  test("the first line with text", () => {
    expect(titleOf("\n  \n  fix the login bug \nmore")).toBe("fix the login bug");
  });

  test("cut to the limit", () => {
    expect(titleOf("abcdefghij", 5)).toBe("abcd…");
  });

  test("empty", () => {
    expect(titleOf("  \n ")).toBe("");
  });
});

test("newId differs between calls", () => {
  expect(newId(1)).not.toBe(newId(1));
});
