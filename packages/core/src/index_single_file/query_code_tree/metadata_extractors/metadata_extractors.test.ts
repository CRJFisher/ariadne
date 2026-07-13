import { describe, it, expect } from "vitest";
import type { Language } from "@ariadnejs/types";
import { get_metadata_extractors } from "./metadata_extractors";
import { JAVASCRIPT_METADATA_EXTRACTORS } from "./metadata_extractors.javascript";
import { TYPESCRIPT_METADATA_EXTRACTORS } from "./metadata_extractors.typescript";
import { PYTHON_METADATA_EXTRACTORS } from "./metadata_extractors.python";
import { RUST_METADATA_EXTRACTORS } from "./metadata_extractors.rust";

describe("get_metadata_extractors", () => {
  it("returns the javascript extractors for javascript", () => {
    expect(get_metadata_extractors("javascript" as Language)).toBe(
      JAVASCRIPT_METADATA_EXTRACTORS
    );
  });

  it("returns the typescript extractors for typescript", () => {
    expect(get_metadata_extractors("typescript" as Language)).toBe(
      TYPESCRIPT_METADATA_EXTRACTORS
    );
  });

  it("returns the python extractors for python", () => {
    expect(get_metadata_extractors("python" as Language)).toBe(
      PYTHON_METADATA_EXTRACTORS
    );
  });

  it("returns the rust extractors for rust", () => {
    expect(get_metadata_extractors("rust" as Language)).toBe(
      RUST_METADATA_EXTRACTORS
    );
  });

  it("returns undefined for an unsupported language", () => {
    expect(get_metadata_extractors("go" as Language)).toEqual(undefined);
  });
});
