
import * as fs from "node:fs/promises";
import path from "path";

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
 * Save JSON file with formatting to structured output directory.
 * Returns the absolute path to the saved file.
 */
export async function save_json(
  output_type: OutputType,
  data: unknown,
  project_name: string,
  data_dir: string,
): Promise<string> {
  // Generate ISO timestamp
  const timestamp = new Date().toISOString().replace(/:/g, "-");

  // Build output directory path: {data_dir}/analysis/{project_name}/{output_type}/
  const output_dir = path.join(data_dir, "analysis", project_name, output_type);

  // Create directories if they don't exist
  await fs.mkdir(output_dir, { recursive: true });

  // Build file path
  const file_path = path.join(output_dir, `${timestamp}.json`);

  // Write formatted JSON
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

/**
 * Find the most recent analysis file for a given output type.
 * Returns the absolute path to the file.
 */
export async function find_most_recent_analysis(
  project_name: string,
  data_dir: string,
  output_type: OutputType = OutputType.DETECT_ENTRYPOINTS,
): Promise<string> {
  const target_dir = path.join(data_dir, "analysis", project_name, output_type);

  try {
    const files = await fs.readdir(target_dir);

    // Filter for JSON files
    const json_files = files.filter((file) => file.endsWith(".json"));

    if (json_files.length === 0) {
      throw new Error(
        `No analysis files found in ${target_dir}. Run detect_entrypoints.ts first.`
      );
    }

    // Sort by filename (ISO timestamps sort lexicographically) - most recent last
    json_files.sort();
    const most_recent = json_files[json_files.length - 1];

    return path.join(target_dir, most_recent);
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") {
      throw new Error(
        `Analysis output directory not found: ${target_dir}. Run detect_entrypoints.ts first.`
      );
    }
    throw error;
  }
}
