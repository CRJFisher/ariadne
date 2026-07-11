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

  it("produces the known SHA-256 hex digest of an ascii string", () => {
    expect(compute_content_hash("hello")).toEqual(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });

  it("produces the known SHA-256 of empty string", () => {
    expect(compute_content_hash("")).toEqual(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("hashes unicode content via its utf-8 encoding", () => {
    expect(compute_content_hash("const x = '日本語';")).toEqual(
      "cb04720a4bd9eaa700c1199078958415c54dbae03195a6ed4c3b8ec9d019e2bb",
    );
  });
});
