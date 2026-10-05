import { describe, it, expect, beforeEach } from "vitest";
import type { Location, FilePath } from "@ariadnejs/types";
import {
  store_documentation,
  consume_documentation,
  reset_documentation_state,
} from "./documentation_state.rust";

const file_path = "/test.rs" as FilePath;

describe("documentation state", () => {
  beforeEach(() => {
    reset_documentation_state();
  });

  it("stores and consumes documentation for adjacent definition", () => {
    store_documentation("/// Does something", 5);
    const doc = consume_documentation({
      file_path,
      start_line: 6,
      start_column: 1,
      end_line: 10,
      end_column: 1,
    });
    expect(doc).toBe("/// Does something");
  });

  it("concatenates consecutive comment lines", () => {
    store_documentation("/// Line 1", 5);
    store_documentation("/// Line 2", 6);
    const doc = consume_documentation({
      file_path,
      start_line: 7,
      start_column: 1,
      end_line: 10,
      end_column: 1,
    });
    expect(doc).toBe("/// Line 1\n/// Line 2");
  });

  it("returns undefined when no documentation matches", () => {
    store_documentation("/// Far away", 1);
    const doc = consume_documentation({
      file_path,
      start_line: 10,
      start_column: 1,
      end_line: 15,
      end_column: 1,
    });
    expect(doc).toBeUndefined();
  });

  it("consumes documentation only once", () => {
    store_documentation("/// Single use", 5);
    const first = consume_documentation({
      file_path,
      start_line: 6,
      start_column: 1,
      end_line: 10,
      end_column: 1,
    });
    expect(first).toBe("/// Single use");

    const second = consume_documentation({
      file_path,
      start_line: 6,
      start_column: 1,
      end_line: 10,
      end_column: 1,
    });
    expect(second).toBeUndefined();
  });

  it("allows 1-line gap between doc and definition", () => {
    store_documentation("/// With gap", 5);
    // Definition starts at line 7 (gap at line 6)
    const doc = consume_documentation({
      file_path,
      start_line: 7,
      start_column: 1,
      end_line: 10,
      end_column: 1,
    });
    expect(doc).toBe("/// With gap");
  });

  it("reset clears all pending documentation", () => {
    store_documentation("/// Cleared", 5);
    reset_documentation_state();
    const doc = consume_documentation({
      file_path,
      start_line: 6,
      start_column: 1,
      end_line: 10,
      end_column: 1,
    });
    expect(doc).toBeUndefined();
  });
});
