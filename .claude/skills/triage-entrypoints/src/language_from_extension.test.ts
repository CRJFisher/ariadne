import { describe, expect, it } from "vitest";

import { language_from_extension } from "./language_from_extension.js";

describe("language_from_extension", () => {
  it("maps TypeScript variants", () => {
    expect(language_from_extension("src/foo.ts")).toEqual("typescript");
    expect(language_from_extension("src/foo.tsx")).toEqual("typescript");
    expect(language_from_extension("src/foo.mts")).toEqual("typescript");
    expect(language_from_extension("src/foo.cts")).toEqual("typescript");
  });

  it("maps JavaScript variants", () => {
    expect(language_from_extension("src/foo.js")).toEqual("javascript");
    expect(language_from_extension("src/foo.jsx")).toEqual("javascript");
    expect(language_from_extension("src/foo.mjs")).toEqual("javascript");
    expect(language_from_extension("src/foo.cjs")).toEqual("javascript");
  });

  it("maps Python and Rust", () => {
    expect(language_from_extension("src/foo.py")).toEqual("python");
    expect(language_from_extension("src/foo.pyi")).toEqual("python");
    expect(language_from_extension("src/foo.rs")).toEqual("rust");
  });

  it("is case-insensitive on the extension", () => {
    expect(language_from_extension("src/FOO.TS")).toEqual("typescript");
    expect(language_from_extension("src/Foo.Py")).toEqual("python");
  });

  it("returns null for unknown extensions", () => {
    expect(language_from_extension("src/foo.go")).toEqual(null);
    expect(language_from_extension("src/foo.java")).toEqual(null);
  });

  it("returns null for extensionless paths", () => {
    expect(language_from_extension("Makefile")).toEqual(null);
    expect(language_from_extension("src/foo")).toEqual(null);
  });
});
