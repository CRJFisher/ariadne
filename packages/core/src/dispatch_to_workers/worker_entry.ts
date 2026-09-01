/**
 * The worker-thread side of a per-file pass.
 *
 * This module is only ever loaded as a built `.js` from `dist`, so a worker
 * boots on the compiled tree whether the host process is running the package or
 * a source-tree harness under a TypeScript loader.
 *
 * An indexing job hands its SemanticIndex back as a JSON string. That is the
 * transport the persistence cache already round-trips a `SemanticIndex`
 * through, and the alternative fails the wrong way: `structuredClone` throws on
 * a single residual non-cloneable field and loses the whole file rather than
 * the field.
 *
 * The job reads its own file, so the corpus's bytes are read and decoded on
 * whichever thread is going to parse them instead of on the one thread every
 * result has to come back through.
 */
import * as fs from "node:fs";
import { parentPort, workerData } from "node:worker_threads";
import type { FilePath, Language } from "@ariadnejs/types";
import { parse_file } from "../project/parse_file";
import { build_index_single_file } from "../index_single_file/index_single_file";
import { to_serializable_semantic_index } from "../persistence/serialize_index";
import { for_each_call_occurrence } from "../classify_entry_points/qualify_grep_hits";
import type { WorkerPassName } from "./dispatch_to_workers";

export interface IndexFileInput {
  readonly file_path: FilePath;
}

/**
 * A file that could not be READ is reported as such rather than thrown: it
 * never entered the corpus, so it is skipped, where a file whose indexing threw
 * is a drop the load has to report.
 */
export type IndexFileOutput =
  | { readonly read: false }
  | {
      readonly read: true;
      readonly content: string;
      readonly index_json: string;
    };

export interface GrepFileInput {
  readonly file_path: FilePath;
  readonly language: Language;
  /**
   * The file's lines when the caller already holds them, and null when the
   * worker should read the file itself. The indexed pass greps the corpus the
   * project has in memory; the residue pass greps files nothing has read.
   */
  readonly lines: readonly string[] | null;
}

export interface GrepOccurrence {
  readonly name: string;
  readonly line: number;
  readonly content: string;
}

export interface GrepFileOutput {
  readonly occurrences: readonly GrepOccurrence[];
  /** Generated lines the pass refused to read, summed over the file. */
  readonly skipped_lines: number;
}

/** Declaration keys are corpus-wide, so they travel once per worker. */
export interface GrepPassShared {
  readonly declaration_keys: readonly string[];
}

interface JobMessage {
  readonly input_index: number;
  readonly input: IndexFileInput | GrepFileInput;
}

/**
 * A file's own parse buffer, sized the way the serial load sizes it. The load
 * grows one buffer monotonically across the corpus, so every file there is
 * parsed with at least twice its own length; asking for exactly that per file
 * is the same guarantee without carrying the largest file's buffer to the
 * smallest.
 */
function buffer_size_for(content: string): number {
  return Math.max(32 * 1024, content.length * 2);
}

function run_index_file(input: IndexFileInput): IndexFileOutput {
  let content: string;
  try {
    content = fs.readFileSync(input.file_path, "utf-8");
  } catch {
    return { read: false };
  }
  const parsed = parse_file(
    input.file_path,
    content,
    buffer_size_for(content),
  );
  const index = build_index_single_file(parsed, parsed.tree, parsed.lang);
  return {
    read: true,
    content,
    index_json: JSON.stringify(to_serializable_semantic_index(index)),
  };
}

function run_grep_file(
  input: GrepFileInput,
  declaration_keys: ReadonlySet<string>,
): GrepFileOutput {
  let lines: string[];
  if (input.lines === null) {
    try {
      lines = fs.readFileSync(input.file_path, "utf-8").split("\n");
    } catch {
      return { occurrences: [], skipped_lines: 0 };
    }
  } else {
    lines = input.lines as string[];
  }

  const occurrences: GrepOccurrence[] = [];
  const skipped_lines = for_each_call_occurrence(
    input.file_path,
    lines,
    input.language,
    declaration_keys,
    ({ name, line, content }) => {
      occurrences.push({ name, line, content });
    },
  );
  return { occurrences, skipped_lines };
}

function main(): void {
  const port = parentPort;
  if (port === null) {
    throw new Error(
      "worker_entry ran outside a worker thread — it has no parent port to answer on.",
    );
  }
  const { pass, shared } = workerData as {
    pass: WorkerPassName;
    shared: GrepPassShared | null;
  };
  const declaration_keys: ReadonlySet<string> = new Set(
    shared === null ? [] : shared.declaration_keys,
  );

  port.on("message", (message: JobMessage) => {
    const started = process.hrtime.bigint();
    try {
      const output =
        pass === "index_file"
          ? run_index_file(message.input as IndexFileInput)
          : run_grep_file(message.input as GrepFileInput, declaration_keys);
      port.postMessage({
        input_index: message.input_index,
        output,
        pass_ns: Number(process.hrtime.bigint() - started),
      });
    } catch (error: unknown) {
      port.postMessage({
        input_index: message.input_index,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  port.postMessage({ ready: true });
}

main();
