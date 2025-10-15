# Task epic-11.116.2: Implement Fixture Generation Tooling

**Status:** Not Started
**Parent:** task-epic-11.116
**Depends On:** task-epic-11.116.1
**Priority:** High (blocks testing tasks)
**Created:** 2025-10-14

## Overview

Implement the tooling to serialize `SemanticIndex` objects to JSON and deserialize them back. Create a CLI tool to generate fixtures from code files. This is the infrastructure that makes the entire fixture system work.

## Objectives

1. Implement `serialize_semantic_index()` function
2. Implement `deserialize_semantic_index()` function
3. Create CLI tool for fixture generation
4. Add fixture regeneration script
5. Create test helpers for loading fixtures in tests

## Detailed Implementation

### 1. Serialization Function

**Location:** `packages/core/tests/fixtures/serialize_semantic_index.ts`

```typescript
import type { SemanticIndex } from "@ariadnejs/types";
import type { SemanticIndexJSON } from "./semantic_index_json";

/**
 * Serialize SemanticIndex to JSON-compatible object
 * Converts ReadonlyMaps to objects for JSON serialization
 */
export function serialize_semantic_index(index: SemanticIndex): SemanticIndexJSON {
  return {
    file_path: index.file_path,
    language: index.language,
    root_scope_id: index.root_scope_id,

    // Convert ReadonlyMap<K, V> to Record<string, V>
    scopes: Object.fromEntries(index.scopes),
    functions: Object.fromEntries(index.functions),
    classes: Object.fromEntries(index.classes),
    variables: Object.fromEntries(index.variables),
    interfaces: Object.fromEntries(index.interfaces),
    enums: Object.fromEntries(index.enums),
    namespaces: Object.fromEntries(index.namespaces),
    types: Object.fromEntries(index.types),
    imported_symbols: Object.fromEntries(index.imported_symbols),

    // References array stays as-is (readonly becomes regular array in JSON)
    references: [...index.references],
  };
}

/**
 * Write SemanticIndex to JSON file
 */
export function write_semantic_index_fixture(
  index: SemanticIndex,
  output_path: string
): void {
  const json = serialize_semantic_index(index);
  const json_string = JSON.stringify(json, null, 2);
  fs.writeFileSync(output_path, json_string + "\n", "utf-8");
}
```

### 2. Deserialization Function

**Location:** `packages/core/tests/fixtures/deserialize_semantic_index.ts`

```typescript
import type { SemanticIndex, ScopeId, SymbolId, FilePath, Language } from "@ariadnejs/types";
import type { SemanticIndexJSON } from "./semantic_index_json";

/**
 * Deserialize JSON object back to SemanticIndex
 * Converts objects back to ReadonlyMaps
 */
export function deserialize_semantic_index(json: SemanticIndexJSON): SemanticIndex {
  return {
    file_path: json.file_path as FilePath,
    language: json.language as Language,
    root_scope_id: json.root_scope_id as ScopeId,

    // Convert Record<string, V> back to ReadonlyMap<K, V>
    scopes: new Map(Object.entries(json.scopes)) as ReadonlyMap<ScopeId, LexicalScope>,
    functions: new Map(Object.entries(json.functions)) as ReadonlyMap<SymbolId, FunctionDefinition>,
    classes: new Map(Object.entries(json.classes)) as ReadonlyMap<SymbolId, ClassDefinition>,
    variables: new Map(Object.entries(json.variables)) as ReadonlyMap<SymbolId, VariableDefinition>,
    interfaces: new Map(Object.entries(json.interfaces)) as ReadonlyMap<SymbolId, InterfaceDefinition>,
    enums: new Map(Object.entries(json.enums)) as ReadonlyMap<SymbolId, EnumDefinition>,
    namespaces: new Map(Object.entries(json.namespaces)) as ReadonlyMap<SymbolId, NamespaceDefinition>,
    types: new Map(Object.entries(json.types)) as ReadonlyMap<SymbolId, TypeAliasDefinition>,
    imported_symbols: new Map(Object.entries(json.imported_symbols)) as ReadonlyMap<SymbolId, ImportDefinition>,

    // Convert array back to readonly array
    references: json.references as readonly SymbolReference[],
  };
}

/**
 * Load SemanticIndex from JSON file
 */
export function load_semantic_index_fixture(relative_path: string): SemanticIndex {
  const fixture_path = path.join(__dirname, relative_path);
  const json_string = fs.readFileSync(fixture_path, "utf-8");
  const json = JSON.parse(json_string) as SemanticIndexJSON;
  return deserialize_semantic_index(json);
}
```

### 3. CLI Tool for Generation

**Location:** `packages/core/scripts/generate_fixtures.ts`

```typescript
#!/usr/bin/env tsx

import { program } from "commander";
import { glob } from "glob";
import path from "path";
import fs from "fs";
import { index_single_file } from "../src/index_single_file";
import { write_semantic_index_fixture } from "../tests/fixtures/serialize_semantic_index";

program
  .name("generate-fixtures")
  .description("Generate semantic index JSON fixtures from code files")
  .option("-l, --language <lang>", "Generate for specific language (typescript, python, rust, javascript)")
  .option("-f, --file <path>", "Generate for specific file")
  .option("--all", "Regenerate all fixtures")
  .parse();

const options = program.opts();

/**
 * Generate fixture for a single code file
 */
function generate_fixture_for_file(code_path: string, language: string): void {
  console.log(`Generating fixture for ${code_path}...`);

  // Read code file
  const code = fs.readFileSync(code_path, "utf-8");

  // Index the file
  const index = index_single_file(code, language as any);

  // Determine output path
  // Input:  fixtures/typescript/code/classes/basic_class.ts
  // Output: fixtures/typescript/semantic_index/classes/basic_class.json
  const relative_path = path.relative(
    path.join(__dirname, "../tests/fixtures"),
    code_path
  );
  const parts = relative_path.split(path.sep);
  const lang = parts[0];
  const category = parts[2]; // Skip "code"
  const filename = path.basename(parts[3], path.extname(parts[3])) + ".json";

  const output_path = path.join(
    __dirname,
    "../tests/fixtures",
    lang,
    "semantic_index",
    category,
    filename
  );

  // Ensure output directory exists
  fs.mkdirSync(path.dirname(output_path), { recursive: true });

  // Write JSON fixture
  write_semantic_index_fixture(index, output_path);

  console.log(`  ✓ Written to ${output_path}`);
}

/**
 * Generate all fixtures for a language
 */
function generate_fixtures_for_language(language: string): void {
  const pattern = path.join(
    __dirname,
    `../tests/fixtures/${language}/code/**/*.{ts,py,rs,js}`
  );

  const files = glob.sync(pattern);
  console.log(`Found ${files.length} ${language} files`);

  for (const file of files) {
    try {
      generate_fixture_for_file(file, language);
    } catch (error) {
      console.error(`  ✗ Error: ${error.message}`);
    }
  }
}

/**
 * Main
 */
if (options.file) {
  // Generate single file
  const ext_to_lang: Record<string, string> = {
    ".ts": "typescript",
    ".py": "python",
    ".rs": "rust",
    ".js": "javascript",
  };
  const ext = path.extname(options.file);
  const language = ext_to_lang[ext];

  if (!language) {
    console.error(`Unknown file extension: ${ext}`);
    process.exit(1);
  }

  generate_fixture_for_file(options.file, language);
} else if (options.language) {
  // Generate all for language
  generate_fixtures_for_language(options.language);
} else if (options.all) {
  // Generate all languages
  const languages = ["typescript", "python", "rust", "javascript"];
  for (const lang of languages) {
    console.log(`\n=== ${lang.toUpperCase()} ===\n`);
    generate_fixtures_for_language(lang);
  }
} else {
  console.error("Must specify --language, --file, or --all");
  program.help();
}
```

**Usage:**
```bash
# Generate all fixtures
npm run generate-fixtures -- --all

# Generate for specific language
npm run generate-fixtures -- --language typescript

# Generate for specific file
npm run generate-fixtures -- --file fixtures/typescript/code/classes/basic_class.ts
```

### 4. Test Helpers

**Location:** `packages/core/tests/fixtures/test_helpers.ts`

```typescript
import path from "path";
import { load_semantic_index_fixture, deserialize_semantic_index } from "./deserialize_semantic_index";
import type { SemanticIndex } from "@ariadnejs/types";

/**
 * Load semantic index fixture by relative path
 *
 * @example
 * const index = load_fixture("typescript/classes/basic_class.json");
 */
export function load_fixture(relative_path: string): SemanticIndex {
  return load_semantic_index_fixture(relative_path);
}

/**
 * Load multiple fixtures and return as array
 */
export function load_fixtures(...paths: string[]): SemanticIndex[] {
  return paths.map(load_fixture);
}

/**
 * Build registries from semantic indexes
 * Helper for integration tests
 */
export function build_registries(indexes: SemanticIndex[]) {
  const definitions = new DefinitionRegistry();
  const references = new ReferenceRegistry();
  const scopes = new ScopeRegistry();
  const types = new TypeRegistry();
  const exports = new ExportRegistry();
  const resolutions = new ResolutionRegistry();
  const imports = new ImportGraph();

  // Populate registries
  for (const index of indexes) {
    // Extract definitions, scopes, types, exports from index
    // Add to respective registries
    // (Implementation details depend on current registry APIs)
  }

  // Resolve
  const file_paths = new Set(indexes.map(i => i.file_path));
  const languages = new Map(indexes.map(i => [i.file_path, i.language]));

  resolutions.resolve_files(
    file_paths,
    references,
    languages,
    definitions,
    scopes,
    exports,
    imports,
    types,
    root_folder
  );

  return {
    definitions,
    references,
    scopes,
    types,
    exports,
    resolutions,
    imports,
  };
}
```

### 5. Package.json Scripts

Add to `packages/core/package.json`:

```json
{
  "scripts": {
    "generate-fixtures": "tsx scripts/generate_fixtures.ts",
    "generate-fixtures:ts": "tsx scripts/generate_fixtures.ts --language typescript",
    "generate-fixtures:py": "tsx scripts/generate_fixtures.ts --language python",
    "generate-fixtures:rs": "tsx scripts/generate_fixtures.ts --language rust",
    "generate-fixtures:js": "tsx scripts/generate_fixtures.ts --language javascript"
  }
}
```

## Deliverables

- [ ] `serialize_semantic_index.ts` implemented and tested
- [ ] `deserialize_semantic_index.ts` implemented and tested
- [ ] `generate_fixtures.ts` CLI tool working
- [ ] `test_helpers.ts` with `load_fixture()` and `build_registries()`
- [ ] npm scripts added to package.json
- [ ] Unit tests for serialization/deserialization
- [ ] Documentation on how to use tooling

## Testing Strategy

**Unit tests for serialization round-trip:**
```typescript
describe("Semantic Index Serialization", () => {
  it("should serialize and deserialize without loss", () => {
    const original = create_test_index(/* ... */);
    const json = serialize_semantic_index(original);
    const deserialized = deserialize_semantic_index(json);

    expect(deserialized).toEqual(original);
  });

  it("should handle empty collections", () => {
    const index = create_minimal_index();
    const json = serialize_semantic_index(index);

    expect(json.functions).toEqual({});
    expect(json.classes).toEqual({});
  });

  it("should preserve all definition types", () => {
    const index = create_index_with_various_definitions();
    const json = serialize_semantic_index(index);
    const deserialized = deserialize_semantic_index(json);

    expect(deserialized.functions.size).toBe(index.functions.size);
    expect(deserialized.classes.size).toBe(index.classes.size);
    expect(deserialized.imported_symbols.size).toBe(index.imported_symbols.size);
  });
});
```

## Success Criteria

- ✅ Serialization preserves all data (no information loss)
- ✅ Deserialization reconstructs exact SemanticIndex structure
- ✅ CLI tool generates valid JSON for all test files
- ✅ Test helpers work in actual tests
- ✅ Generated JSON is human-readable and properly formatted
- ✅ Round-trip tests pass (serialize → deserialize → equal)

## Estimated Effort

**4-6 hours**
- 1.5 hours: Implement serialization/deserialization
- 1 hour: Implement CLI tool
- 0.5 hours: Create test helpers
- 1 hour: Write unit tests
- 0.5-1 hour: Test with real fixtures
- 0.5 hour: Documentation

## Next Steps

After completion:
- Proceed to **116.3**: Organize code fixtures
- Then **116.4**: Generate initial JSON fixtures using this tooling

## Notes

- Keep serialization simple and mechanical
- Don't try to optimize JSON size - readability is more important
- Ensure proper TypeScript types throughout
- Add error handling for malformed JSON
- Consider adding JSON schema validation in future
