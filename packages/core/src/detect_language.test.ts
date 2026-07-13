import { describe, it, expect } from "vitest";
import { detect_language, assert_language } from "./detect_language";

describe("detect_language", () => {
  it("detects TypeScript files", () => {
    expect(detect_language("src/index.ts")).toBe("typescript");
    expect(detect_language("src/component.tsx")).toBe("typescript");
  });

  it("detects JavaScript files including module-extension variants", () => {
    expect(detect_language("lib/utils.js")).toBe("javascript");
    expect(detect_language("src/app.jsx")).toBe("javascript");
    expect(detect_language("lib/entry.mjs")).toBe("javascript");
    expect(detect_language("lib/legacy.cjs")).toBe("javascript");
  });

  it("detects Python files", () => {
    expect(detect_language("main.py")).toBe("python");
  });

  it("detects Rust files", () => {
    expect(detect_language("src/lib.rs")).toBe("rust");
  });

  it("returns null for unsupported file types", () => {
    expect(detect_language("main.go")).toBeNull();
    expect(detect_language("App.java")).toBeNull();
    expect(detect_language("lib.cpp")).toBeNull();
    expect(detect_language("README.md")).toBeNull();
    expect(detect_language("style.css")).toBeNull();
  });
});

describe("assert_language", () => {
  it("returns the language for supported extensions", () => {
    expect(assert_language("src/index.ts")).toBe("typescript");
    expect(assert_language("main.py")).toBe("python");
  });

  it("throws naming the extension for unsupported file types", () => {
    expect(() => assert_language("main.go")).toThrow(
      "Unsupported file extension: go"
    );
    expect(() => assert_language("App.java")).toThrow(
      "Unsupported file extension: java"
    );
  });
});
