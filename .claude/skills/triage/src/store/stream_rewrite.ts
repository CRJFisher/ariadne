/**
 * Byte-stream literal replacement for the store's oversized JSON artifacts.
 *
 * A published `detect_entrypoints` dump reaches 700 MB and a run's `triage.json`
 * reaches 280 MB, so neither the project-id migration nor the cross-machine
 * merge can read one into a string to edit it. Both need the same two edits —
 * retarget an absolute path prefix, and retarget the `project_name` field — and
 * both are literal substitutions with no structural component. Streaming them
 * holds peak memory at one chunk plus the longest needle, whatever the file's
 * size, so a 700 MB artifact costs the same as a 700 byte one.
 *
 * Matching is left-to-right and non-overlapping: the scan resumes after each
 * substitution, so replacement text is never itself rescanned.
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";

/** One literal substitution. `find` must be non-empty. */
export interface Replacement {
  find: string;
  replace: string;
}

/** Occurrences substituted, keyed by the `find` string that matched. */
export type ReplacementCounts = Record<string, number>;

/** Chunk size for the read stream. Must exceed the longest needle. */
const CHUNK_BYTES = 1024 * 1024;

interface CompiledReplacement {
  find: Buffer;
  replace: Buffer;
  key: string;
}

function compile(replacements: readonly Replacement[]): CompiledReplacement[] {
  return replacements.map((r) => {
    if (r.find.length === 0) {
      throw new Error("stream_rewrite: a replacement's `find` must be non-empty");
    }
    return {
      find: Buffer.from(r.find, "utf8"),
      replace: Buffer.from(r.replace, "utf8"),
      key: r.find,
    };
  });
}

/** Rewritten output, plus how far into `buf` the input was consumed. */
interface RewrittenRegion {
  emitted: Buffer;
  consumed: number;
}

/**
 * Substitute the matches that start within `buf[0, limit)` and report how much
 * input that consumed.
 *
 * A match is admitted only when it *starts* before `limit`, so a needle
 * straddling the caller's held-back tail is left for the next pass rather than
 * half-matched. An admitted match may still end past `limit` — the needle is
 * fully present, it just reaches into the tail — so `consumed` is the honest
 * high-water mark and not `limit`. Returning it is what stops the caller from
 * carrying bytes it has already emitted.
 */
function rewrite_region(
  buf: Buffer,
  limit: number,
  compiled: readonly CompiledReplacement[],
  counts: ReplacementCounts,
): RewrittenRegion {
  const out: Buffer[] = [];
  let cursor = 0;

  while (cursor < limit) {
    let best_index = -1;
    let best: CompiledReplacement | null = null;

    for (const rep of compiled) {
      const found = buf.indexOf(rep.find, cursor);
      if (found === -1 || found >= limit) continue;
      if (best_index === -1 || found < best_index) {
        best_index = found;
        best = rep;
      }
    }

    if (best === null || best_index === -1) break;

    out.push(buf.subarray(cursor, best_index));
    out.push(best.replace);
    counts[best.key] = (counts[best.key] ?? 0) + 1;
    cursor = best_index + best.find.length;
  }

  const consumed = Math.max(cursor, limit);
  out.push(buf.subarray(cursor, consumed));
  return { emitted: Buffer.concat(out), consumed };
}

/**
 * Build the Transform that carries a partial needle across chunk boundaries.
 *
 * Each pass writes out everything that can no longer be part of a straddling
 * match and holds back `longest_needle - 1` bytes for the next chunk to complete.
 */
function replacing_transform(
  compiled: readonly CompiledReplacement[],
  counts: ReplacementCounts,
): Transform {
  const longest = Math.max(...compiled.map((r) => r.find.length));
  // Typed loosely: `subarray` of a stream chunk yields Buffer<ArrayBufferLike>.
  let carry: Buffer<ArrayBufferLike> = Buffer.alloc(0);

  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      const buf = carry.length === 0 ? chunk : Buffer.concat([carry, chunk]);
      const limit = buf.length - longest + 1;
      if (limit <= 0) {
        carry = buf;
        callback();
        return;
      }
      const { emitted, consumed } = rewrite_region(buf, limit, compiled, counts);
      carry = buf.subarray(consumed);
      callback(null, emitted);
    },
    flush(callback) {
      const { emitted } = rewrite_region(carry, carry.length, compiled, counts);
      carry = Buffer.alloc(0);
      callback(null, emitted);
    },
  });
}

/**
 * Copy `source_path` to `dest_path`, substituting every replacement on the way.
 *
 * With no replacements this is a plain copy. The destination's parent directory
 * must already exist.
 */
export async function stream_copy_with_replacements(
  source_path: string,
  dest_path: string,
  replacements: readonly Replacement[],
): Promise<ReplacementCounts> {
  if (replacements.length === 0) {
    await fsp.copyFile(source_path, dest_path);
    return {};
  }

  const compiled = compile(replacements);
  const longest = Math.max(...compiled.map((r) => r.find.length));
  if (longest >= CHUNK_BYTES) {
    throw new Error(
      `stream_rewrite: needle of ${longest} bytes exceeds the ${CHUNK_BYTES}-byte chunk size`,
    );
  }

  const counts: ReplacementCounts = {};
  await pipeline(
    fs.createReadStream(source_path, { highWaterMark: CHUNK_BYTES }),
    replacing_transform(compiled, counts),
    fs.createWriteStream(dest_path),
  );
  return counts;
}

/**
 * Substitute within `file_path`, replacing it atomically.
 *
 * The rewrite lands in a sibling temp file and is renamed over the original, so
 * a crash mid-write leaves the original intact rather than a truncated artifact.
 */
export async function stream_replace_in_place(
  file_path: string,
  replacements: readonly Replacement[],
): Promise<ReplacementCounts> {
  if (replacements.length === 0) return {};

  const tmp_path = `${file_path}.tmp.${crypto.randomBytes(4).toString("hex")}`;
  try {
    const counts = await stream_copy_with_replacements(file_path, tmp_path, replacements);
    await fsp.rename(tmp_path, file_path);
    return counts;
  } catch (err) {
    await fsp.rm(tmp_path, { force: true });
    throw err;
  }
}
