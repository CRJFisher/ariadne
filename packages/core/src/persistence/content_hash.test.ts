import { describe, it, expect } from "vitest";
import { compute_content_hash } from "./content_hash";

describe("compute_content_hash", () => {
  it("is deterministic", () => {
    const content = "function foo() { return 42; }";
    expect(compute_content_hash(content)).toEqual(
      compute_content_hash(content),
    );
  });

  it("produces different hashes for different content", () => {
    const a = compute_content_hash("function foo() {}");
    const b = compute_content_hash("function bar() {}");
    expect(a).not.toEqual(b);
  });

  it("produces a 64-character hex string", () => {
    const hash = compute_content_hash("hello");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces the known SHA-256 of empty string", () => {
    const hash = compute_content_hash("");
    expect(hash).toEqual(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("handles unicode content", () => {
    const hash = compute_content_hash("const x = '日本語';");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toEqual(compute_content_hash("const x = '日本語';"));
  });
});
