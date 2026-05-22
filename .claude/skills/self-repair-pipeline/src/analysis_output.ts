import * as fs from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import * as readline from "node:readline";
import path from "path";
import { ANALYSIS_OUTPUT_DIR } from "./paths.js";

export enum OutputType {
  DETECT_ENTRYPOINTS = "detect_entrypoints",
  TRIAGE_RESULTS = "triage_results",
}

/**
 * Save JSON to `analysis_output/{project}/{output_type}/{timestamp}.json`.
 * Returns the absolute path to the saved file.
 *
 * `bulk_array_field` names the top-level array property (if any) that may grow
 * past V8's max string length when stringified whole. When supplied, that array
 * is written one element per line so the writer never materializes the full
 * payload as a single string.
 */
export async function save_json<T extends object>(
  output_type: OutputType,
  data: T,
  project_name: string,
  bulk_array_field?: keyof T & string,
): Promise<string> {
  const timestamp = new Date().toISOString().replace(/:/g, "-");
  return save_json_with_filename(
    output_type,
    data,
    project_name,
    `${timestamp}.json`,
    bulk_array_field,
  );
}

/**
 * Save JSON to `analysis_output/{project}/{output_type}/{filename}`.
 * Caller controls the filename — used by finalize_triage to write
 * `<run-id>.json` so triage_results filename matches the run that produced it.
 * Returns the absolute path to the saved file.
 */
export async function save_json_with_filename<T extends object>(
  output_type: OutputType,
  data: T,
  project_name: string,
  filename: string,
  bulk_array_field?: keyof T & string,
): Promise<string> {
  const output_dir = path.join(ANALYSIS_OUTPUT_DIR, project_name, output_type);
  await fs.mkdir(output_dir, { recursive: true });

  const file_path = path.join(output_dir, filename);
  await write_json_streaming(file_path, data, bulk_array_field);

  return file_path;
}

/**
 * Read and parse a JSON file. Falls back to a line-streaming parser when the
 * file is too large for `fs.readFile` + `JSON.parse` (V8's ~512 MB string
 * limit). The streamed format is the one written by `write_json_streaming`:
 * a header line ending in `"<bulk_array_field>":[`, one JSON object per
 * subsequent line, and a closing `]}` line.
 */
export async function load_json<T>(file_path: string): Promise<T> {
  try {
    const content = await fs.readFile(file_path, "utf-8");
    return JSON.parse(content) as T;
  } catch (err) {
    if (!is_string_length_error(err)) throw err;
    return load_json_streaming<T>(file_path);
  }
}

function is_string_length_error(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return err.message.includes("Invalid string length") || err.name === "RangeError";
}

async function write_json_streaming<T extends object>(
  file_path: string,
  data: T,
  bulk_array_field: (keyof T & string) | undefined,
): Promise<void> {
  const arr = bulk_array_field !== undefined ? data[bulk_array_field] : undefined;

  if (!Array.isArray(arr) || bulk_array_field === undefined) {
    // No bulk field declared, or the field isn't actually an array — write the
    // whole object in one shot. Falls back transparently for small payloads.
    await fs.writeFile(file_path, JSON.stringify(data, null, 2) + "\n", "utf-8");
    return;
  }

  const stream = createWriteStream(file_path, { encoding: "utf-8" });
  const write = (chunk: string): Promise<void> =>
    new Promise<void>((resolve, reject) => {
      const ok = stream.write(chunk, (err) => {
        if (err) reject(err);
      });
      if (ok) resolve();
      else stream.once("drain", () => resolve());
    });

  // Separate scalars from the bulk array. Object spread preserves all other
  // top-level fields exactly.
  const scalars: Record<string, unknown> = { ...(data as Record<string, unknown>) };
  delete scalars[bulk_array_field];

  // Header line: scalars JSON minus the closing brace, then the bulk-array key
  // and the opening bracket. Format guarantees: header is one line ending in
  // `"<bulk_array_field>":[`.
  const scalar_json = JSON.stringify(scalars);
  const open_brace_offset = 1; // scalar_json starts with `{`
  const close_brace_offset = scalar_json.length - 1; // last char is `}`
  const has_scalars = close_brace_offset > open_brace_offset;
  const header =
    scalar_json.slice(0, close_brace_offset) +
    (has_scalars ? "," : "") +
    JSON.stringify(bulk_array_field) +
    ":[";
  await write(header + "\n");

  for (let i = 0; i < arr.length; i++) {
    const suffix = i < arr.length - 1 ? ",\n" : "\n";
    await write(JSON.stringify(arr[i]) + suffix);
  }

  await write("]}\n");

  await new Promise<void>((resolve, reject) => {
    stream.end((err: Error | null | undefined) => (err ? reject(err) : resolve()));
  });
}

async function load_json_streaming<T>(file_path: string): Promise<T> {
  const stream = createReadStream(file_path, { encoding: "utf-8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let scalars: Record<string, unknown> | null = null;
  let bulk_field: string | null = null;
  const entries: unknown[] = [];

  try {
    for await (const raw of rl) {
      const line = raw.trimEnd();
      if (line === "") continue;

      if (scalars === null) {
        // Header line: <scalar-json>,"<field>":[ — find the opening bracket and
        // the field key by parsing backward from the end.
        if (!line.endsWith(":[")) {
          throw new Error(
            `load_json_streaming: header line does not end in ':[' (file=${file_path})`,
          );
        }
        // Find the last `,"<key>":[` or `{"<key>":[` boundary by scanning for
        // the unescaped quote that opens the field name. We accept either a
        // leading comma (scalars present) or a leading `{` (no scalars).
        const without_open = line.slice(0, -2); // strip `:[`
        const last_quote = without_open.lastIndexOf("\"");
        if (last_quote === -1) {
          throw new Error(`load_json_streaming: malformed header (file=${file_path})`);
        }
        // The field name is delimited by two quotes; find the opening one.
        const close_quote = last_quote;
        let open_quote = -1;
        for (let i = close_quote - 1; i >= 0; i--) {
          if (without_open[i] === "\"" && without_open[i - 1] !== "\\") {
            open_quote = i;
            break;
          }
        }
        if (open_quote === -1) {
          throw new Error(`load_json_streaming: malformed header (file=${file_path})`);
        }
        bulk_field = JSON.parse(without_open.slice(open_quote, close_quote + 1)) as string;
        // Everything before the opening quote is either `{` (no scalars) or
        // `{...,` — replace the trailing comma (if any) with `}` and parse.
        const before = without_open.slice(0, open_quote);
        const scalar_text =
          before === "{" ? "{}" : before.replace(/,$/, "") + "}";
        scalars = JSON.parse(scalar_text) as Record<string, unknown>;
        continue;
      }

      if (line === "]}") break;

      const entry_text = line.endsWith(",") ? line.slice(0, -1) : line;
      entries.push(JSON.parse(entry_text));
    }
  } finally {
    rl.close();
    stream.close();
  }

  if (scalars === null || bulk_field === null) {
    throw new Error(`load_json_streaming: empty or malformed file (${file_path})`);
  }

  scalars[bulk_field] = entries;
  return scalars as T;
}
