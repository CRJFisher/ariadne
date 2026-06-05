import * as fs from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";

import { atomic_write_file } from "./atomic_write.js";
import { error_code } from "./errors.js";

/**
 * Outcome returned by an `atomic_update_registry` mutator. `kind: "write"`
 * commits `next` to disk under the held lock; `kind: "noop"` releases the
 * lock without writing. Both shapes carry the caller's `result` payload
 * (e.g. an `ApplyResult`) back through the helper.
 */
export type RegistryUpdate<R> =
  | { kind: "write"; next: string; result: R }
  | { kind: "noop"; result: R };

/**
 * Locked read-mutate-write against a shared-registry file (e.g.
 * `known_issues/registry.json`). Acquires a `.lock` sidecar under
 * `fs.open(... "wx")`, runs the mutator with the current on-disk contents,
 * writes the returned `next` via `atomic_write_file`, and releases the lock
 * on both success and failure paths.
 *
 * Concurrent writers landing on the same machine cannot interleave their
 * read-mutate-write cycles; whichever one acquires the lock first runs to
 * completion before
 * the other sees the file. Bare `atomic_write_file` is rename-atomic at the
 * filesystem level but does NOT protect against last-writer-wins data loss
 * when two writers compute independent mutations from a stale read.
 *
 * The lock is in-memory cooperative — only writers using this helper honour
 * it. Bypassing `atomic_update_registry` with a direct write skips the lock
 * silently; the structural write-boundary test
 * (`packages/skill-fs/src/registry_writers.test.ts`) is the enforcement
 * surface for that contract.
 */
export async function atomic_update_registry<R>(
  registry_path: string,
  mutator: (raw: string) => Promise<RegistryUpdate<R>>,
): Promise<R> {
  const lock_path = `${registry_path}.lock`;
  const max_attempts = 100;
  const retry_delay_ms = 50;

  let handle: fs.FileHandle | null = null;
  let attempt = 0;
  while (attempt < max_attempts) {
    try {
      handle = await fs.open(lock_path, "wx");
      break;
    } catch (err) {
      if (error_code(err) !== "EEXIST") throw err;
      attempt++;
      await sleep(retry_delay_ms);
    }
  }
  if (handle === null) {
    throw new Error(
      `atomic_update_registry: could not acquire ${lock_path} after ` +
        `${max_attempts * retry_delay_ms}ms — stale lock?`,
    );
  }

  try {
    const raw = await fs.readFile(registry_path, "utf8");
    const update = await mutator(raw);
    if (update.kind === "write") {
      await atomic_write_file(registry_path, update.next);
    }
    return update.result;
  } finally {
    await handle.close().catch(() => undefined);
    await fs.unlink(lock_path).catch(() => undefined);
  }
}
