import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { Project } from "../../src/index";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

describe("Import Resolution in Project (Integration)", () => {
  let tempDir: string;
  let project: Project;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ariadne-test-"));
    project = new Project();
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test("resolves TypeScript imports with module paths", () => {
    const utilsContent = `
export function formatString(str: string): string {
  return str.toUpperCase();
}

export class StringUtils {
  static reverse(str: string): string {
    return str.split('').reverse().join('');
  }
}
`;

    const mainContent = `
import { formatString, StringUtils } from "./utils";

export function processText(text: string): string {
  const formatted = formatString(text);
  return StringUtils.reverse(formatted);
}
`;

    const utilsPath = path.join(tempDir, "utils.ts");
    const mainPath = path.join(tempDir, "main.ts");

    fs.writeFileSync(utilsPath, utilsContent);
    fs.writeFileSync(mainPath, mainContent);

    project.add_or_update_file(utilsPath, utilsContent);
    project.add_or_update_file(mainPath, mainContent);

    const imports = project.get_imports_with_definitions(mainPath);

    expect(imports.length).toBe(2);
    const formatImport = imports.find((i) => i.local_name === "formatString");
    expect(formatImport).toBeDefined();
    expect(formatImport!.imported_function.file_path).toBe(utilsPath);
    const utilsImport = imports.find((i) => i.local_name === "StringUtils");
    expect(utilsImport).toBeDefined();
    expect(utilsImport!.imported_function.file_path).toBe(utilsPath);
  });
});
