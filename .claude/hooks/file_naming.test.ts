/**
 * The PreToolUse validator and the Stop audit both run these checks on every
 * file write, so a regression here either blocks every edit in a session or
 * silently stops enforcing the naming rules.
 */

import { describe, expect, it } from "vitest";
import {
  BLOCKED_GENERIC_BASENAMES,
  LANGUAGES,
  LANGUAGE_NAMES,
  UNSUPPORTED_LANGUAGES,
  audit_prohibited_files,
  validate_src_file,
} from "./file_naming.js";

/** Mirrors how the PreToolUse validator splits a project-relative path. */
function check(relative_path: string): boolean {
  return validate_src_file(relative_path, relative_path.split("/")).valid;
}

function error_for(relative_path: string): string {
  const result = validate_src_file(relative_path, relative_path.split("/"));
  return result.error ?? "";
}

describe("naming constants", () => {
  it("bans exactly the nine category names the rule doc lists", () => {
    expect([...BLOCKED_GENERIC_BASENAMES]).toEqual([
      "utils.ts",
      "types.ts",
      "common.ts",
      "errors.ts",
      "helpers.ts",
      "constants.ts",
      "analytics.ts",
      "misc.ts",
      "shared.ts",
    ]);
  });

  it("names every language a folder may not be called after", () => {
    expect(LANGUAGE_NAMES).toEqual(["typescript", "javascript", "python", "rust", "go", "java"]);
  });

  it("lists exactly the four supported languages", () => {
    expect(LANGUAGES).toEqual(["typescript", "javascript", "python", "rust"]);
  });

  it("derives the unsupported languages from the supported ones", () => {
    expect(UNSUPPORTED_LANGUAGES).toEqual(["go", "java"]);
  });

  it("keeps the supported and unsupported lists disjoint", () => {
    expect(LANGUAGES.filter((language) => UNSUPPORTED_LANGUAGES.includes(language))).toEqual([]);
  });
});

describe("generic-name denylist", () => {
  it.each([...BLOCKED_GENERIC_BASENAMES])("blocks %s in a module folder", (basename) => {
    expect(check(`packages/core/src/resolve_references/${basename}`)).toBe(false);
  });

  it.each([...BLOCKED_GENERIC_BASENAMES])("blocks %s in the src root", (basename) => {
    expect(check(`packages/types/src/${basename}`)).toBe(false);
  });

  it("names the rule doc and the offending file in the message", () => {
    expect(error_for("packages/core/src/resolve_references/utils.ts")).toEqual(
      "Blocked: 'packages/core/src/resolve_references/utils.ts' - 'utils' names a category, not a concept.\n" +
        "Name the file for what it holds (e.g. resolve_module_path.ts). See .claude/rules/file-naming.md"
    );
  });

  it.each(["types.d.ts", "utils.d.ts", "errors.python.ts", "shared.rust.ts"])(
    "blocks %s, matching the stem rather than the whole filename",
    (basename) => {
      expect(check(`packages/core/src/resolve_references/${basename}`)).toBe(false);
    }
  );

  it("allows a concept-named file in the same folder", () => {
    expect(check("packages/core/src/resolve_references/resolve_module_path.ts")).toBe(true);
  });

  it("allows index.ts as a barrel", () => {
    expect(check("packages/core/src/resolve_references/index.ts")).toBe(true);
    expect(check("packages/types/src/index.ts")).toBe(true);
  });

  it.each(["types.test.ts", "utils.test.ts", "errors.integration.test.ts", "helpers.e2e.test.ts"])(
    "allows the test file %s",
    (basename) => {
      expect(check(`packages/core/src/resolve_references/${basename}`)).toBe(true);
    }
  );

  it("allows test_utils.ts through the special-file allowlist", () => {
    expect(check("packages/core/src/project/test_utils.ts")).toBe(true);
  });

  it("blocks a banned name that claims its folder as the main implementation", () => {
    expect(check("packages/mcp/src/analytics/analytics.ts")).toBe(false);
  });

  it("blocks a banned name inside a special-cased folder", () => {
    expect(check("packages/core/src/index_single_file/scopes/extractors/utils.ts")).toBe(false);
  });
});

describe("language sub-folder block", () => {
  it.each(["typescript", "javascript", "python", "rust", "go", "java"])(
    "blocks a %s/ sub-folder",
    (language) => {
      expect(check(`packages/core/src/call_resolution/${language}/resolve.ts`)).toBe(false);
    }
  );

  it.each(["Python", "TypeScript", "GO"])("blocks a %s/ sub-folder regardless of case", (segment) => {
    expect(check(`packages/core/src/call_resolution/${segment}/resolve.ts`)).toBe(false);
  });

  it("directs a language folder at the src root into a feature folder", () => {
    expect(error_for("packages/core/src/python/resolve.ts")).toEqual(
      "Blocked: 'packages/core/src/python/resolve.ts' - language sub-folder 'python/' is prohibited.\n" +
        "Move it under the feature folder it belongs to, as {feature}/resolve.python.ts. " +
        "See .claude/rules/file-naming.md"
    );
  });

  it("blocks a language folder holding query files", () => {
    expect(check("packages/core/src/query_code_tree/queries/python/tags.scm")).toBe(false);
  });

  it("blocks a language folder holding docs", () => {
    expect(check("packages/core/src/call_resolution/java/README.md")).toBe(false);
  });

  it("blocks a language folder holding an allowlisted special file", () => {
    expect(check("packages/core/src/call_resolution/python/test_utils.ts")).toBe(false);
  });

  it("prescribes the dotted-suffix alternative", () => {
    expect(error_for("packages/core/src/call_resolution/python/resolve.ts")).toEqual(
      "Blocked: 'packages/core/src/call_resolution/python/resolve.ts' - language sub-folder 'python/' is prohibited.\n" +
        "Use a dotted suffix in the parent folder instead: resolve.python.ts. See .claude/rules/file-naming.md"
    );
  });

  it("places the language ahead of a test suffix in the suggestion", () => {
    expect(error_for("packages/core/src/call_resolution/python/resolve.test.ts")).toEqual(
      "Blocked: 'packages/core/src/call_resolution/python/resolve.test.ts' - language sub-folder 'python/' is prohibited.\n" +
        "Use a dotted suffix in the parent folder instead: resolve.python.test.ts. See .claude/rules/file-naming.md"
    );
  });

  it("does not repeat a language the filename already carries", () => {
    expect(error_for("packages/core/src/call_resolution/python/resolve.python.ts")).toEqual(
      "Blocked: 'packages/core/src/call_resolution/python/resolve.python.ts' - language sub-folder 'python/' is prohibited.\n" +
        "Use a dotted suffix in the parent folder instead: resolve.python.ts. See .claude/rules/file-naming.md"
    );
  });

  it("suggests no dotted suffix for a language that has none", () => {
    expect(error_for("packages/core/src/call_resolution/go/resolve.ts")).toEqual(
      "Blocked: 'packages/core/src/call_resolution/go/resolve.ts' - language sub-folder 'go/' is prohibited.\n" +
        "'go' has no accepted dotted suffix, so move the file into the parent folder under a concept name. " +
        "See .claude/rules/file-naming.md"
    );
  });

  it("suggests no language suffix for a barrel", () => {
    expect(error_for("packages/core/src/call_resolution/python/index.ts")).toEqual(
      "Blocked: 'packages/core/src/call_resolution/python/index.ts' - language sub-folder 'python/' is prohibited.\n" +
        "A barrel names its folder's exports rather than one language's, so move it into the parent folder. " +
        "See .claude/rules/file-naming.md"
    );
  });

  it("blocks a language folder at any depth", () => {
    expect(check("packages/core/src/a/b/c/rust/thing.ts")).toBe(false);
  });

  it("blocks a language folder above an extractors folder", () => {
    expect(check("packages/core/src/python/extractors/scope_extractor.ts")).toBe(false);
  });

  it("allows a package named after a language", () => {
    expect(check("packages/python/src/parse_module.ts")).toBe(true);
  });

  it("allows a folder that merely contains a language name", () => {
    expect(check("packages/core/src/typescript_helpers/resolve_module_path.ts")).toBe(true);
  });

  it("allows the extractors shared-base prefix naming", () => {
    expect(
      check("packages/core/src/index_single_file/scopes/extractors/python_scope_boundary_extractor.ts")
    ).toBe(true);
  });

  it("allows a kebab-case classifier source naming a language", () => {
    expect(check("packages/core/src/classify_entry_points/builtins/check_python-dunder.ts")).toBe(true);
  });
});

describe("supported language suffixes", () => {
  it("lists exactly the four supported languages", () => {
    expect(LANGUAGES).toEqual(["typescript", "javascript", "python", "rust"]);
  });

  it("treats go and java as language names that are not supported suffixes", () => {
    expect(UNSUPPORTED_LANGUAGES).toEqual(["go", "java"]);
  });

  it.each(LANGUAGES)("accepts a .%s.ts submodule suffix", (language) => {
    expect(check(`packages/core/src/import_resolution/imports.${language}.ts`)).toBe(true);
  });

  it.each(LANGUAGES)("accepts a .%s.ts main-module suffix", (language) => {
    expect(check(`packages/core/src/import_resolution/import_resolution.${language}.ts`)).toBe(true);
  });

  it.each([
    "imports.go.ts",
    "imports.java.ts",
    "import_resolution.go.ts",
    "import_resolution.java.ts",
    "imports.go.test.ts",
    "import_resolution.go.test.ts",
    "go.ts",
    "java.ts",
    "go.imports.ts",
  ])("rejects %s", (basename) => {
    expect(check(`packages/core/src/import_resolution/${basename}`)).toBe(false);
  });

  it("names the supported set when rejecting an unsupported language", () => {
    expect(error_for("packages/core/src/import_resolution/imports.go.ts")).toEqual(
      "Blocked: 'packages/core/src/import_resolution/imports.go.ts' - 'go' is not a supported language.\n" +
        "Supported languages: typescript, javascript, python, rust. See .claude/rules/file-naming.md"
    );
  });

  it("allows a concept name that merely contains an unsupported language", () => {
    expect(check("packages/core/src/import_resolution/mongo.ts")).toBe(true);
    expect(check("packages/core/src/import_resolution/javascript_go_between.ts")).toBe(true);
  });

  it("allows a genuine aspect suffix", () => {
    expect(check("packages/core/src/import_resolution/import_resolution.strict.test.ts")).toBe(true);
  });
});

describe("language prefix", () => {
  it.each(LANGUAGES)("rejects %s as a submodule prefix", (language) => {
    expect(check(`packages/core/src/import_resolution/${language}.imports.ts`)).toBe(false);
  });

  it.each(LANGUAGES)("rejects a file named after %s alone", (language) => {
    expect(check(`packages/core/src/import_resolution/${language}.ts`)).toBe(false);
  });

  it("prescribes the suffix form for a prefixed submodule", () => {
    expect(error_for("packages/core/src/import_resolution/python.imports.ts")).toEqual(
      "Blocked: 'python.imports.ts' has language as prefix.\n" +
        "Language should be a suffix. Rename to: imports.python.ts"
    );
  });

  it("prescribes the main-module form for a bare language filename", () => {
    expect(error_for("packages/core/src/import_resolution/python.ts")).toEqual(
      "Blocked: 'python.ts' has language as prefix.\n" +
        "Language should be a suffix. Rename to: import_resolution.python.ts"
    );
  });
});

describe("repository audit", () => {
  it("reports no naming violations across the workspace", () => {
    const repo_root = new URL("../..", import.meta.url).pathname;
    expect(audit_prohibited_files(repo_root)).toEqual([]);
  });
});
