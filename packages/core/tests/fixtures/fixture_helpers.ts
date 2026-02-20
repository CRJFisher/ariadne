/**
 * Test Helper Functions for Fixture Loading
 *
 * Convenience functions for loading semantic index fixtures in tests.
 */

import path from "path";
import type { SemanticIndex } from "../../src/index_single_file/index_single_file";
import { load_index_single_file_fixture } from "./index_single_file_json";

/**
 * Load a semantic index fixture by relative path
 *
 * The path is relative to the fixtures directory.
 *
 * @example
 * const index = load_fixture("typescript/index_single_file/classes/basic_class.json");
 *
 * @param relative_path - Path relative to fixtures directory
 * @returns The loaded SemanticIndex
 */
export function load_fixture(relative_path: string): SemanticIndex {
  const fixture_path = path.join(__dirname, relative_path);
  return load_index_single_file_fixture(fixture_path);
}

/**
 * Load multiple fixtures and return as array
 *
 * Convenience function for loading multiple fixtures at once.
 *
 * @example
 * const [index1, index2] = load_fixtures(
 *   "typescript/index_single_file/classes/basic_class.json",
 *   "typescript/index_single_file/functions/simple_function.json"
 * );
 *
 * @param paths - Paths relative to fixtures directory
 * @returns Array of loaded SemanticIndex objects
 */
export function load_fixtures(...paths: string[]): SemanticIndex[] {
  return paths.map(load_fixture);
}
