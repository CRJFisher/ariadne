import * as fs from "node:fs/promises";
import path from "path";
import { ANALYSIS_OUTPUT_DIR } from "./paths.js";

// ===== Project ID =====

/** Convert a resolved project path to a collision-free identifier for file naming. */
export function path_to_project_id(project_path: string): string {
  return project_path.replace(/\//g, "-");
}

/**
 * Derive a project identifier from config fields.
 * Internal projects (project_path=".") require an explicit name.
 * External projects derive the identifier from the resolved absolute path.
 */
export function project_id_from_config(
  raw_project_path: string,
  explicit_name: string | undefined,
): string {
  if (raw_project_path === ".") {
    if (!explicit_name) {
      throw new Error("Internal project (project_path=\".\") requires explicit project_name");
    }
    return explicit_name;
  }
  return path_to_project_id(path.resolve(raw_project_path));
}

// ===== Output Type =====

export enum OutputType {
  DETECT_ENTRYPOINTS = "detect_entrypoints",
  TRIAGE_RESULTS = "triage_results"
}

/**
 * Save JSON file with formatting to structured output directory
 * Returns the absolute path to the saved file
 */
export async function save_json(
  output_type: OutputType,
  data: unknown,
  project_name: string
): Promise<string> {
  const timestamp = new Date().toISOString().replace(/:/g, "-");
  const output_dir = path.join(ANALYSIS_OUTPUT_DIR, project_name, output_type);

  await fs.mkdir(output_dir, { recursive: true });

  const file_path = path.join(output_dir, `${timestamp}.json`);
  await fs.writeFile(file_path, JSON.stringify(data, null, 2) + "\n", "utf-8");

  return file_path;
}

/**
 * Load JSON file
 */
export async function load_json<T>(file_path: string): Promise<T> {
  const content = await fs.readFile(file_path, "utf-8");
  return JSON.parse(content);
}

