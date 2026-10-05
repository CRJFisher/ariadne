import { describe, expect, it } from "vitest";

import { error_code } from "./node_error_code.js";

describe("error_code", () => {
  it("returns the .code string when present", () => {
    const err = Object.assign(new Error("nope"), { code: "ENOENT" });
    expect(error_code(err)).toEqual("ENOENT");
  });

  it("returns null when the value is not an object", () => {
    expect(error_code("ENOENT")).toEqual(null);
    expect(error_code(123)).toEqual(null);
    expect(error_code(null)).toEqual(null);
    expect(error_code(undefined)).toEqual(null);
  });

  it("returns null when .code is absent or non-string", () => {
    expect(error_code(new Error("boom"))).toEqual(null);
    expect(error_code({ code: 7 })).toEqual(null);
    expect(error_code({ code: { nested: true } })).toEqual(null);
  });
});
