/**
 * Index a corpus's files across worker threads and deliver each file's
 * SemanticIndex in the caller's order.
 *
 * This is pass A's file-local half: `parse_file` and `build_index_single_file`
 * read nothing but the file they are handed, so they can run anywhere, while
 * populating the registries reads project-wide state and stays on the main
 * thread. The caller applies each index as it arrives, in its own file order,
 * because the call graph Ariadne reports depends on the order files arrive in.
 *
 * Deserializing on the main thread is charged here rather than to the pool: it
 * lands on the critical path the pool exists to shorten and partially cancels
 * the win, so a run that did not report it would overstate what threading
 * bought.
 */
import type { FilePath, SemanticIndex } from "@ariadnejs/types";
import {
  dispatch_to_workers,
  type WorkerPoolStats,
} from "../dispatch_to_workers/dispatch_to_workers";
import type {
  IndexFileInput,
  IndexFileOutput,
} from "../dispatch_to_workers/worker_entry";
import { deserialize_semantic_index } from "../persistence/serialize_index";

/**
 * What one file's trip through the pool produced. A file that could not be READ
 * is not a drop — it never entered the corpus — where a file whose indexing
 * threw is a drop the load reports.
 */
export type IndexedFile =
  | { readonly file_path: FilePath; readonly outcome: "unreadable" }
  | {
      readonly file_path: FilePath;
      readonly outcome: "failed";
      readonly reason: string;
    }
  | {
      readonly file_path: FilePath;
      readonly outcome: "indexed";
      readonly content: string;
      readonly index: SemanticIndex;
    };

export interface ParallelIndexStats extends WorkerPoolStats {
  readonly main_deserialize_ms: number;
}

export async function index_files_across_threads(
  paths: readonly FilePath[],
  worker_width: number,
  on_indexed: (file: IndexedFile) => void | Promise<void>,
): Promise<ParallelIndexStats> {
  let main_deserialize_ms = 0;
  const inputs: IndexFileInput[] = paths.map((file_path) => ({ file_path }));

  const pool_stats = await dispatch_to_workers<IndexFileInput, IndexFileOutput>(
    { inputs, worker_width },
    async (outcome) => {
      const file_path = paths[outcome.input_index];
      if (outcome.output === null) {
        await on_indexed({
          file_path,
          outcome: "failed",
          reason: outcome.error ?? "indexing produced no result",
        });
        return;
      }
      if (!outcome.output.read) {
        await on_indexed({ file_path, outcome: "unreadable" });
        return;
      }
      const deserialize_at_start = process.hrtime.bigint();
      const index = deserialize_semantic_index(outcome.output.index_json);
      main_deserialize_ms +=
        Number(process.hrtime.bigint() - deserialize_at_start) / 1e6;
      await on_indexed({
        file_path,
        outcome: "indexed",
        content: outcome.output.content,
        index,
      });
    },
  );

  return { ...pool_stats, main_deserialize_ms };
}
