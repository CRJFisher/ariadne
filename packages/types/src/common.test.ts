/**
 * Tests for common utilities
 */

import { describe, it, expect } from "vitest";
import type { Location, FilePath, LocationKey } from "./common";
import { location_key, parse_location_key } from "./common";

describe("location_key", () => {
  it("should create a location key from a location", () => {
    const location: Location = {
      file_path: "test.ts" as FilePath,
      start_line: 1,
      start_column: 0,
      end_line: 5,
      end_column: 10,
    };

    const key = location_key(location);

    expect(typeof key).toBe("string");
    expect(key).toContain("test.ts");
  });
});

describe("parse_location_key", () => {
  it("should parse a location key back to a location", () => {
    const location: Location = {
      file_path: "test.ts" as FilePath,
      start_line: 1,
      start_column: 0,
      end_line: 5,
      end_column: 10,
    };

    const key = location_key(location);
    const parsed = parse_location_key(key);

    expect(parsed.file_path).toBe(location.file_path);
    expect(parsed.start_line).toBe(location.start_line);
    expect(parsed.start_column).toBe(location.start_column);
  });
});
