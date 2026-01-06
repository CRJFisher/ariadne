/**
 * Tests for collection dispatch resolution
 */

import { describe, it, expect } from "vitest";
import { resolve_collection_dispatch } from "./call_resolution.collection_dispatch";

describe("resolve_collection_dispatch", () => {
  it("should be a function", () => {
    expect(typeof resolve_collection_dispatch).toBe("function");
  });
});
