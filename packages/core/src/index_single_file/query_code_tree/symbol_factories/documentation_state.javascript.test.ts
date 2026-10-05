import { describe, it, expect, beforeEach } from "vitest";
import type { Location, FilePath } from "@ariadnejs/types";
import {
  store_documentation,
  consume_documentation,
  reset_documentation_state,
} from "./documentation_state.javascript";

const file_path = "/test.js" as FilePath;

describe("documentation state triad", () => {
  beforeEach(() => {
    reset_documentation_state();
  });

  it("should store and consume documentation within 1 line", () => {
    store_documentation("/** my doc */", 5);
    const doc = consume_documentation({
      file_path,
      start_line: 6,
      start_column: 1,
      end_line: 6,
      end_column: 10,
    });
    expect(doc).toBe("/** my doc */");
  });

  it("should store and consume documentation within 2 lines", () => {
    store_documentation("/** my doc */", 5);
    const doc = consume_documentation({
      file_path,
      start_line: 7,
      start_column: 1,
      end_line: 7,
      end_column: 10,
    });
    expect(doc).toBe("/** my doc */");
  });

  it("should not consume documentation more than 2 lines away", () => {
    store_documentation("/** my doc */", 5);
    const doc = consume_documentation({
      file_path,
      start_line: 8,
      start_column: 1,
      end_line: 8,
      end_column: 10,
    });
    expect(doc).toBeUndefined();
  });

  it("should remove documentation after consumption", () => {
    store_documentation("/** my doc */", 5);
    consume_documentation({
      file_path,
      start_line: 6,
      start_column: 1,
      end_line: 6,
      end_column: 10,
    });
    const doc2 = consume_documentation({
      file_path,
      start_line: 6,
      start_column: 1,
      end_line: 6,
      end_column: 10,
    });
    expect(doc2).toBeUndefined();
  });

  it("should clear all documentation on reset", () => {
    store_documentation("/** doc1 */", 5);
    store_documentation("/** doc2 */", 10);
    reset_documentation_state();
    const doc1 = consume_documentation({
      file_path,
      start_line: 6,
      start_column: 1,
      end_line: 6,
      end_column: 10,
    });
    const doc2 = consume_documentation({
      file_path,
      start_line: 11,
      start_column: 1,
      end_line: 11,
      end_column: 10,
    });
    expect(doc1).toBeUndefined();
    expect(doc2).toBeUndefined();
  });
});
