/**
 * The hash functions behind the fingerprint, pinned.
 *
 * Every expected digest here was computed OUTSIDE this codebase — an
 * independent SHA-256 over the same spec — so these are expectations rather
 * than a recording of what the code happened to print. A change to the digest
 * algorithm or its width fails here, which is what stops it from silently
 * revaluing every baseline already recorded in a task doc.
 */

import { describe, expect, it } from "vitest";
import { digest_members } from "./streaming_digest";

describe("digest_members", () => {
  it("pins the digest of an empty component", () => {
    // A corpus that drops no files has an empty dropped-file set, so this is a
    // real recorded value rather than a degenerate case.
    expect(digest_members([])).toEqual("e3b0c44298fc1c14");
  });

  it("tells an empty component apart from one empty member", () => {
    expect(digest_members([""])).toEqual("01ba4719c80b6fe9");
  });

  it("pins a single member", () => {
    expect(digest_members(["a"])).toEqual("87428fc522803d31");
  });

  it("pins a two-member component", () => {
    expect(digest_members(["a", "b"])).toEqual("911169ddaaf146af");
  });

  it("depends on order, which is why every component sorts before hashing", () => {
    expect(digest_members(["b", "a"])).toEqual("aea8a04c2f293417");
  });

  it("depends on multiplicity", () => {
    expect(digest_members(["a", "a"])).toEqual("7da0810372718aab");
  });

  it("does not collide across a moved separator", () => {
    expect(digest_members(["ab", "c"])).toEqual("1b10891da7a8bc41");
    expect(digest_members(["a", "bc"])).toEqual("4b8d1dd1e2b97bee");
  });

  it("pins a corpus-shaped member set", () => {
    expect(
      digest_members([
        "function:src/a.ts:1:0:3:1:alpha",
        "function:src/b.ts:1:0:3:1:beta",
      ]),
    ).toEqual("de75febee99e7c8a");
  });

  it("refuses a member holding the delimiter it is joined with", () => {
    // Unguarded, this member digests to 911169ddaaf146af — the same value as
    // ["a", "b"] — so a symbol whose name carried a newline would silently
    // collide with a two-member component.
    expect(() => digest_members(["a\nb"])).toThrow(
      /may not contain a newline/,
    );
  });

  it("hashes a generator without ever holding the members as one string", () => {
    // The streaming contract AC #12 is about: a full-corpus arm was lost to a
    // V8 max-string-length blowup inside `join` at two million members.
    function* many(): Generator<string> {
      for (let index = 0; index < 100_000; index++) {
        yield `member-${index}`;
      }
    }
    const from_generator = digest_members(many());
    const from_array = digest_members([...many()]);
    expect(from_generator).toEqual(from_array);
  });
});
