 
import * as fs from "node:fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

/**
 * Save JSON file with formatting
 */
export async function save_json(file_path: string, data: unknown): Promise<void> {
  await fs.writeFile(file_path, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

/**
 * Load JSON file
 */
export async function load_json<T>(file_path: string): Promise<T> {
  const content = await fs.readFile(file_path, "utf-8");
  return JSON.parse(content);
}

/**
 * Find the most recent file matching a prefix in analysis_output directory
 * Returns the absolute path to the file
 */
async function find_most_recent_file(prefix: string, script_hint: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const __filename = fileURLToPath(import.meta.url);
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const __dirname = dirname(__filename);
  const analysis_dir = path.resolve(__dirname, "..", "analysis_output");

  try {
    const files = await fs.readdir(analysis_dir);

    // Filter for files matching the pattern
    const matching_files = files.filter((file) => file.startsWith(prefix));

    if (matching_files.length === 0) {
      throw new Error(
        `No ${prefix}* files found in ${analysis_dir}. Run ${script_hint} first.`
      );
    }

    // Sort by filename (timestamp is in the name) - most recent last
    matching_files.sort();
    const most_recent = matching_files[matching_files.length - 1];

    return path.join(analysis_dir, most_recent);
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") {
      throw new Error(
        `Analysis output directory not found: ${analysis_dir}. Run ${script_hint} first.`
      );
    }
    throw error;
  }
}

/**
 * Find the most recent analysis file in analysis_output directory
 * Returns the absolute path to the file
 *
 * @param analysis_name - Optional package name to filter by (e.g., "core", "mcp", "types").
 *                        If not provided, looks for any *-analysis_* files.
 */
export async function find_most_recent_analysis(analysis_name?: string): Promise<string> {
  const prefix = analysis_name ? `${analysis_name}-analysis_` : "-analysis_";

  const script_hint = analysis_name
    ? `detect_entrypoints_using_ariadne.ts --package ${analysis_name}`
    : "detect_entrypoints_using_ariadne.ts --package <name>";

  // eslint-disable-next-line @typescript-eslint/naming-convention
  const __filename = fileURLToPath(import.meta.url);
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const __dirname = dirname(__filename);
  const analysis_dir = path.resolve(__dirname, "..", "analysis_output");

  try {
    const files = await fs.readdir(analysis_dir);

    // Filter for files matching the pattern
    const matching_files = analysis_name
      ? files.filter((file) => file.startsWith(prefix))
      : files.filter((file) => file.includes("-analysis_") && file.endsWith(".json"));

    if (matching_files.length === 0) {
      throw new Error(
        `No analysis files found in ${analysis_dir}. Run ${script_hint} first.`
      );
    }

    // Sort by filename (timestamp is in the name) - most recent last
    matching_files.sort();
    const most_recent = matching_files[matching_files.length - 1];

    return path.join(analysis_dir, most_recent);
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") {
      throw new Error(
        `Analysis output directory not found: ${analysis_dir}. Run ${script_hint} first.`
      );
    }
    throw error;
  }
}

/**
 * Find the most recent dead code analysis file in analysis_output directory
 * Returns the absolute path to the file
 */
export async function find_most_recent_dead_code_analysis(): Promise<string> {
  return find_most_recent_file("dead_code_analysis_", "detect_dead_code.ts");
}
