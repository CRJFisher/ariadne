/**
 * The hash function behind the fingerprint, pinned.
 *
 * Every expected digest here was computed OUTSIDE this codebase — an
 * independent SHA-256 over the same spec — so these are expectations rather
 * than a recording of what the code happened to print. A change to the digest
 * algorithm or its width fails here, which is what stops it from silently
 * revaluing every baseline already recorded.
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
    expect(digest_members([""])).toEqual("ba768b331fd86cec");
  });

  it("pins a single member", () => {
    expect(digest_members(["a"])).toEqual("4162fddd39a3e422");
  });

  it("pins a two-member component", () => {
    expect(digest_members(["a", "b"])).toEqual("facdde7abf1eac5b");
  });

  it("depends on order, which is why every component sorts before hashing", () => {
    expect(digest_members(["b", "a"])).toEqual("9c50aa7b503956ef");
  });

  it("depends on multiplicity", () => {
    expect(digest_members(["a", "a"])).toEqual("73f77843a18cdc37");
  });

  it("does not collide across a moved boundary", () => {
    expect(digest_members(["ab", "c"])).toEqual("430fb1b4ac43316e");
    expect(digest_members(["a", "bc"])).toEqual("5310a58788781ab2");
  });

  it("pins a corpus-shaped member set", () => {
    expect(
      digest_members([
        "function:src/a.ts:1:0:3:1:alpha",
        "function:src/b.ts:1:0:3:1:beta",
      ]),
    ).toEqual("155148480a1aaaa2");
  });

  it("digests a member holding a newline as one member", () => {
    // Under a newline-delimited encoding this member and ["a", "b"] are the
    // same digest, so a symbol whose name carried a newline collided with a
    // two-member component. Length-prefixing makes them different values, and
    // makes such a member ordinary rather than a condition to refuse — a
    // refusal that could only fire after the corpus had already been loaded.
    expect(digest_members(["a\nb"])).toEqual("d829d98420342a34");
    expect(digest_members(["a\nb"])).not.toEqual(digest_members(["a", "b"]));
  });

  it("digests a member that looks like an encoded member as one member", () => {
    expect(digest_members(["1:a"])).toEqual("4b35c71453118b7b");
    expect(digest_members(["1:a"])).not.toEqual(digest_members(["a"]));
  });

  it("counts a member's length in UTF-8 bytes, not code units", () => {
    // The prefix has to describe the bytes that follow it, or the stream stops
    // being parseable at the first non-ASCII member. A code-unit prefix over
    // this one-character, two-byte member digests to 1a07c0971c1bef61.
    expect(digest_members(["é"])).toEqual("2f23c71856587c2a");
  });

  it("hashes a generator without ever holding the members as one string", () => {
    // A full-corpus arm was lost to a V8 max-string-length blowup inside
    // `join` at two million members; the members are never collected here.
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
