import { describe, test, expect } from "vitest";
import type { Language } from "./location";
import { is_language_global } from "./language_globals";

describe("is_language_global", () => {
  const cases: ReadonlyArray<{ language: Language; name: string; expected: boolean }> = [
    { language: "python", name: "len", expected: true },
    { language: "python", name: "print", expected: true },
    { language: "python", name: "ValueError", expected: true },
    { language: "python", name: "console", expected: false },
    { language: "python", name: "Some", expected: false },
    { language: "typescript", name: "console", expected: true },
    { language: "typescript", name: "JSON", expected: true },
    { language: "typescript", name: "require", expected: true },
    { language: "javascript", name: "process", expected: true },
    { language: "javascript", name: "len", expected: false },
    { language: "javascript", name: "expect", expected: false },
    { language: "rust", name: "Some", expected: true },
    { language: "rust", name: "Ok", expected: true },
    { language: "rust", name: "Vec", expected: true },
    { language: "rust", name: "drop", expected: true },
    { language: "rust", name: "window", expected: false },
    { language: "rust", name: "len", expected: false },
  ];

  test.each(cases)("$name in $language is $expected", ({ language, name, expected }) => {
    expect(is_language_global(language, name)).toEqual(expected);
  });
});
