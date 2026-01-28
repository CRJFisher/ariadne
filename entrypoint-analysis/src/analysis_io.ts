 
import * as fs from "node:fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

// ===== Enums for Output Organization =====

export enum AnalysisCategory {
  INTERNAL = "internal",
  EXTERNAL = "external"
}

export enum InternalScriptType {
  DETECT_ENTRYPOINTS = "detect_entrypoints",
  DETECT_DEAD_CODE = "detect_dead_code",
  TRIAGE_FALSE_POSITIVES = "triage_false_positives",
  TRIAGE_FALSE_NEGATIVES = "triage_false_negatives"
}

export enum ExternalScriptType {
  DETECT_ENTRYPOINTS = "detect_entrypoints",
  TRIAGE_ENTRY_POINTS = "triage_entry_points"
}

type ScriptType = InternalScriptType | ExternalScriptType;

/**
 * Save JSON file with formatting to structured output directory
 * Returns the absolute path to the saved file
 */
export async function save_json(
  category: AnalysisCategory,
  script_type: ScriptType,
  data: unknown
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const __filename = fileURLToPath(import.meta.url);
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const __dirname = dirname(__filename);

  // Generate ISO timestamp
  const timestamp = new Date().toISOString().replace(/:/g, "-");

  // Build nested directory path
  const output_dir = path.resolve(__dirname, "..", "analysis_output", category, script_type);

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
 * Find the most recent file in a nested output directory
 * Returns the absolute path to the file
 */
async function find_most_recent_file(
  category: AnalysisCategory,
  script_type: ScriptType,
  script_hint: string
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const __filename = fileURLToPath(import.meta.url);
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const __dirname = dirname(__filename);
  const target_dir = path.resolve(__dirname, "..", "analysis_output", category, script_type);

  try {
    const files = await fs.readdir(target_dir);

    // Filter for JSON files
    const json_files = files.filter((file) => file.endsWith(".json"));

    if (json_files.length === 0) {
      throw new Error(
        `No analysis files found in ${target_dir}. Run ${script_hint} first.`
      );
    }

    // Sort by filename (ISO timestamps sort lexicographically) - most recent last
    json_files.sort();
    const most_recent = json_files[json_files.length - 1];

    return path.join(target_dir, most_recent);
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") {
      throw new Error(
        `Analysis output directory not found: ${target_dir}. Run ${script_hint} first.`
      );
    }
    throw error;
  }
}

/**
 * Find the most recent internal analysis file
 */
export async function find_most_recent_analysis(analysis_name?: string): Promise<string> {
  const script_hint = analysis_name
    ? `detect_entrypoints.ts --package ${analysis_name}`
    : "detect_entrypoints.ts --package <name>";

  return find_most_recent_file(
    AnalysisCategory.INTERNAL,
    InternalScriptType.DETECT_ENTRYPOINTS,
    script_hint
  );
}

/**
 * Find the most recent dead code analysis file
 */
export async function find_most_recent_dead_code_analysis(): Promise<string> {
  return find_most_recent_file(
    AnalysisCategory.INTERNAL,
    InternalScriptType.DETECT_DEAD_CODE,
    "detect_dead_code.ts"
  );
}

/**
 * Find the most recent false positive triage file
 */
export async function find_most_recent_false_positive_triage(): Promise<string> {
  return find_most_recent_file(
    AnalysisCategory.INTERNAL,
    InternalScriptType.TRIAGE_FALSE_POSITIVES,
    "triage_false_positives.ts"
  );
}

/**
 * Find the most recent false negative triage file
 */
export async function find_most_recent_false_negative_triage(): Promise<string> {
  return find_most_recent_file(
    AnalysisCategory.INTERNAL,
    InternalScriptType.TRIAGE_FALSE_NEGATIVES,
    "triage_false_negatives.ts"
  );
}

/**
 * Find the most recent external analysis file
 */
export async function find_most_recent_external_analysis(): Promise<string> {
  return find_most_recent_file(
    AnalysisCategory.EXTERNAL,
    ExternalScriptType.DETECT_ENTRYPOINTS,
    "external detect_entrypoints.ts"
  );
}

/**
 * Find the most recent external triage file
 */
export async function find_most_recent_external_triage(): Promise<string> {
  return find_most_recent_file(
    AnalysisCategory.EXTERNAL,
    ExternalScriptType.TRIAGE_ENTRY_POINTS,
    "triage_entry_points.ts"
  );
}
