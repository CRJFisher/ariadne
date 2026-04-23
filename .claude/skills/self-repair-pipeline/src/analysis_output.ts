import * as fs from "node:fs/promises";
import path from "path";
import { ANALYSIS_OUTPUT_DIR } from "./paths.js";

export enum OutputType {
  DETECT_ENTRYPOINTS = "detect_entrypoints",
  TRIAGE_RESULTS = "triage_results",
}

/**
 * Save JSON to `analysis_output/{project}/{output_type}/{timestamp}.json`.
 * Returns the absolute path to the saved file.
 */
export async function save_json(
  output_type: OutputType,
  data: unknown,
  project_name: string,
): Promise<string> {
  const timestamp = new Date().toISOString().replace(/:/g, "-");
  const output_dir = path.join(ANALYSIS_OUTPUT_DIR, project_name, output_type);

  await fs.mkdir(output_dir, { recursive: true });

  const file_path = path.join(output_dir, `${timestamp}.json`);
  await fs.writeFile(file_path, JSON.stringify(data, null, 2) + "\n", "utf-8");

  return file_path;
}

/** Read and parse a JSON file. */
export async function load_json<T>(file_path: string): Promise<T> {
  const content = await fs.readFile(file_path, "utf-8");
  return JSON.parse(content);
}
