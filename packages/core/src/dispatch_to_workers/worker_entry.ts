/**
 * The worker-thread side of per-file indexing.
 *
 * This module is only ever loaded as a built `.js` from `dist`, so a worker
 * boots on the compiled tree whether the host process is running the package or
 * a source-tree harness under a TypeScript loader.
 *
 * The index comes back as a JSON string. That is the transport the persistence
 * cache already round-trips a `SemanticIndex` through, and the alternative
 * fails the wrong way: `structuredClone` throws on a single residual
 * non-cloneable field and loses the whole file rather than the field.
 *
 * The job reads its own file, so the corpus's bytes are read and decoded on
 * whichever thread is going to parse them instead of on the one thread every
 * result has to come back through.
 */
import * as fs from "node:fs";
import { parentPort } from "node:worker_threads";
import type { FilePath } from "@ariadnejs/types";
import { parse_file } from "../project/parse_file";
import { build_index_single_file } from "../index_single_file/index_single_file";
import { to_serializable_semantic_index } from "../persistence/serialize_index";

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

interface JobMessage {
  readonly input_index: number;
  readonly input: IndexFileInput;
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

function index_one_file(input: IndexFileInput): IndexFileOutput {
  let content: string;
  try {
    content = fs.readFileSync(input.file_path, "utf-8");
  } catch {
    return { read: false };
  }
  const parsed = parse_file(input.file_path, content, buffer_size_for(content));
  const index = build_index_single_file(parsed, parsed.tree, parsed.lang);
  return {
    read: true,
    content,
    index_json: JSON.stringify(to_serializable_semantic_index(index)),
  };
}

function main(): void {
  const port = parentPort;
  if (port === null) {
    throw new Error(
      "worker_entry ran outside a worker thread — it has no parent port to answer on.",
    );
  }

  port.on("message", (message: JobMessage) => {
    const started = process.hrtime.bigint();
    try {
      port.postMessage({
        input_index: message.input_index,
        output: index_one_file(message.input),
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
