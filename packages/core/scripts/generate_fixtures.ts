#!/usr/bin/env npx tsx

/**
 * Fixture Generation Script
 *
 * Generates semantic index JSON fixtures from code files.
 * Usage:
 *   npm run generate-fixtures -- --all
 *   npm run generate-fixtures -- --language typescript
 *   npm run generate-fixtures -- --file path/to/file.ts
 */

import fs from "fs";
import path from "path";
import { glob } from "glob";
import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import JavaScript from "tree-sitter-javascript";
import Python from "tree-sitter-python";
import Rust from "tree-sitter-rust";
import type { Language, FilePath } from "@ariadnejs/types";
import { build_index_single_file } from "../src/index_single_file/index_single_file";
import { write_index_single_file_fixture } from "../tests/fixtures/index_single_file_json";
import type { ParsedFile } from "../src/index_single_file/file_utils";

// Language parsers
const parsers = {
  typescript: (() => {
    const p = new Parser();
    p.setLanguage(TypeScript.typescript);
    return p;
  })(),
  javascript: (() => {
    const p = new Parser();
    p.setLanguage(JavaScript);
    return p;
  })(),
  python: (() => {
    const p = new Parser();
    p.setLanguage(Python);
    return p;
  })(),
  rust: (() => {
    const p = new Parser();
    p.setLanguage(Rust);
    return p;
  })(),
};

// File extensions to language mapping
const EXT_TO_LANG: Record<string, Language> = {
  ".ts": "typescript" as Language,
  ".js": "javascript" as Language,
  ".py": "python" as Language,
  ".rs": "rust" as Language,
};

/**
 * Helper to create ParsedFile from code
 */
function create_parsed_file(
  code: string,
  file_path: FilePath,
  tree: Parser.Tree,
  language: Language
): ParsedFile {
  const lines = code.split("\n");
  return {
    file_path,
    file_lines: lines.length,
    file_end_column: lines[lines.length - 1]?.length || 0,
    tree,
    lang: language,
  };
}

/**
 * Generate fixture for a single code file
 */
function generate_fixture_for_file(code_path: string): void {
  console.log(`Generating fixture for ${code_path}...`);

  // Determine language from extension
  const ext = path.extname(code_path);
  const language = EXT_TO_LANG[ext];

  if (!language) {
    console.error(`  ✗ Unknown file extension: ${ext}`);
    return;
  }

  try {
    // Read code file
    const code = fs.readFileSync(code_path, "utf-8");

    // Parse code
    const parser = parsers[language];
    const tree = parser.parse(code);

    // Create ParsedFile
    const parsed_file = create_parsed_file(
      code,
      code_path as FilePath,
      tree,
      language
    );

    // Build semantic index
    const index = build_index_single_file(parsed_file, tree, language);

    // Determine output path
    // Input:  fixtures/typescript/code/classes/basic_class.ts
    // Output: fixtures/typescript/index_single_file/classes/basic_class.json
    const fixtures_dir = path.join(__dirname, "../tests/fixtures");
    const relative_path = path.relative(fixtures_dir, code_path);
    const parts = relative_path.split(path.sep);

    if (parts[1] !== "code") {
      console.error(`  ✗ File not in code/ directory: ${code_path}`);
      return;
    }

    const lang = parts[0];
    const category = parts[2];
    const filename = path.basename(parts[3], ext) + ".json";

    const output_path = path.join(
      fixtures_dir,
      lang,
      "index_single_file",
      category,
      filename
    );

    // Ensure output directory exists
    fs.mkdirSync(path.dirname(output_path), { recursive: true });

    // Write JSON fixture
    write_index_single_file_fixture(index, output_path);

    console.log(`  ✓ Written to ${output_path}`);
  } catch (error) {
    console.error(`  ✗ Error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Generate all fixtures for a language
 */
function generate_fixtures_for_language(language: string): void {
  const pattern = path.join(
    __dirname,
    `../tests/fixtures/${language}/code/**/*${Object.keys(EXT_TO_LANG).find(ext => EXT_TO_LANG[ext] === language)}`
  );

  const files = glob.sync(pattern);
  console.log(`Found ${files.length} ${language} files`);

  for (const file of files) {
    generate_fixture_for_file(file);
  }
}

/**
 * Generate all fixtures for all languages
 */
function generate_all_fixtures(): void {
  const languages = ["typescript", "javascript", "python", "rust"];
  for (const lang of languages) {
    console.log(`\n=== ${lang.toUpperCase()} ===\n`);
    generate_fixtures_for_language(lang);
  }
}

/**
 * Show usage help
 */
function show_help(): void {
  console.log(`
Fixture Generation Script

Usage:
  npm run generate-fixtures -- --all              Generate all fixtures
  npm run generate-fixtures -- --language <lang>  Generate for specific language
  npm run generate-fixtures -- --file <path>      Generate for specific file

Options:
  --all                Regenerate all fixtures for all languages
  --language <lang>    Generate fixtures for specific language (typescript, javascript, python, rust)
  --file <path>        Generate fixture for specific file
  --help               Show this help message

Examples:
  npm run generate-fixtures -- --all
  npm run generate-fixtures -- --language typescript
  npm run generate-fixtures -- --file tests/fixtures/typescript/code/classes/basic_class.ts
`);
}

/**
 * Main entry point
 */
function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    show_help();
    process.exit(0);
  }

  if (args.includes("--all")) {
    generate_all_fixtures();
  } else if (args.includes("--language")) {
    const lang_index = args.indexOf("--language");
    const language = args[lang_index + 1];
    if (!language) {
      console.error("Error: --language requires a language argument");
      process.exit(1);
    }
    if (!["typescript", "javascript", "python", "rust"].includes(language)) {
      console.error(`Error: Unknown language: ${language}`);
      process.exit(1);
    }
    generate_fixtures_for_language(language);
  } else if (args.includes("--file")) {
    const file_index = args.indexOf("--file");
    const file = args[file_index + 1];
    if (!file) {
      console.error("Error: --file requires a file path argument");
      process.exit(1);
    }
    generate_fixture_for_file(file);
  } else {
    console.error("Error: Must specify --all, --language, or --file");
    show_help();
    process.exit(1);
  }
}

main();
