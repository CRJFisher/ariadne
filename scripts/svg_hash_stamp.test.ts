import { describe, expect, it } from "vitest";

import {
  extract_stamped_hash,
  has_stamp,
  inject_hash_comment,
  sha256_of,
} from "./svg_hash_stamp.js";

const HEX = "a".repeat(64);

describe("inject_hash_comment", () => {
  it("prepends the comment when the SVG has no XML declaration", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"></svg>`;
    const stamped = inject_hash_comment(svg, HEX);
    expect(stamped).toEqual(`<!-- source-sha256: ${HEX} -->\n${svg}`);
  });

  it("inserts the comment between <?xml ?> and <svg>", () => {
    const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg></svg>`;
    const stamped = inject_hash_comment(svg, HEX);
    expect(stamped).toEqual(
      `<?xml version="1.0" encoding="UTF-8"?>\n<!-- source-sha256: ${HEX} -->\n<svg></svg>`
    );
  });

  it("throws when an XML declaration is present but malformed", () => {
    const svg = `<?xml version="1.0" encoding="UTF-8"\n<svg></svg>`;
    expect(() => inject_hash_comment(svg, HEX)).toThrowError(
      "malformed SVG: missing ?> after <?xml"
    );
  });
});

describe("extract_stamped_hash", () => {
  it("reads the hash from the first source-sha256 comment", () => {
    const svg = `<?xml version="1.0"?>\n<!-- source-sha256: ${HEX} -->\n<svg></svg>`;
    expect(extract_stamped_hash(svg)).toEqual(HEX);
  });

  it("returns null when no source-sha256 comment is present", () => {
    const svg = `<svg></svg>`;
    expect(extract_stamped_hash(svg)).toEqual(null);
  });

  it("returns null when the comment is malformed (short hash)", () => {
    const svg = `<!-- source-sha256: abc -->\n<svg></svg>`;
    expect(extract_stamped_hash(svg)).toEqual(null);
  });

  it("tolerates extra whitespace inside the comment", () => {
    const svg = `<!--   source-sha256:   ${HEX}   -->\n<svg></svg>`;
    expect(extract_stamped_hash(svg)).toEqual(HEX);
  });

  it("ignores a stamp that appears past the head-scan window", () => {
    // A future diagram describing this very protocol could embed the literal
    // stamp string inside a node label. Only the prepended comment in the
    // SVG's head counts — payload-side occurrences must not be picked up.
    const filler = " ".repeat(600);
    const svg = `<svg>${filler}<!-- source-sha256: ${HEX} --></svg>`;
    expect(extract_stamped_hash(svg)).toEqual(null);
  });
});

describe("has_stamp", () => {
  it("returns true when a valid stamp sits at the head", () => {
    const svg = `<!-- source-sha256: ${HEX} -->\n<svg></svg>`;
    expect(has_stamp(svg)).toEqual(true);
  });

  it("returns false for an unstamped SVG (e.g. a hand-committed icon)", () => {
    expect(has_stamp(`<svg></svg>`)).toEqual(false);
  });
});

describe("sha256_of", () => {
  it("hashes a string", () => {
    expect(sha256_of("abc")).toEqual(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });

  it("hashes a Buffer identically to the equivalent string", () => {
    expect(sha256_of(Buffer.from("abc"))).toEqual(sha256_of("abc"));
  });
});

describe("inject + extract round-trip", () => {
  it("re-reads the stamped hash for an SVG without XML declaration", () => {
    const stamped = inject_hash_comment(`<svg></svg>`, HEX);
    expect(extract_stamped_hash(stamped)).toEqual(HEX);
  });

  it("re-reads the stamped hash for an SVG with XML declaration", () => {
    const stamped = inject_hash_comment(
      `<?xml version="1.0"?>\n<svg></svg>`,
      HEX
    );
    expect(extract_stamped_hash(stamped)).toEqual(HEX);
  });
});
