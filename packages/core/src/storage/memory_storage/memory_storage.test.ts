import { describe, it, expect } from "vitest";
import { FilePath , SourceCode} from "@ariadnejs/types";
import { MemoryStorage, create_memory_storage } from "./";
import { FilePath , SourceCode} from "@ariadnejs/types";

describe("MemoryStorage", () => {
  it("initializes and updates files", async () => {
    const storage = create_memory_storage();
    await storage.initialize();
    await storage.update_file({
      file_path: "a.ts" as FilePath,
      source_code: "const a=1;" as SourceCode,
      language: "javascript" as any,
      last_modified: Date.now(),
    });
    const files = await storage.list_files();
    expect(files).toContain("a.ts");
  });
});
