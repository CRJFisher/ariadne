import * as fs from "node:fs/promises";
import * as crypto from "node:crypto";

/**
 * Atomic write: write content to a temp sibling, then rename(2) over the
 * target path. POSIX rename is atomic — concurrent readers see either the old
 * file or the new file, never a partial write or empty file.
 *
 * Used for any file with multiple potential writers (e.g. `registry.json`,
 * reached only through `atomic_update_registry`) and for per-run files where
 * in-process readers may race the writer (e.g.
 * `novel_issues.json`, which the dispatcher rewrites between dispense calls).
 *
 * On error the temp file is best-effort removed; the rename atomicity means
 * the target is left untouched on a partial failure.
 */
export async function atomic_write_file(
  target_path: string,
  content: string,
): Promise<void> {
  const tmp_path = `${target_path}.tmp.${process.pid}.${crypto.randomUUID()}`;
  try {
    await fs.writeFile(tmp_path, content, "utf8");
    await fs.rename(tmp_path, target_path);
  } catch (err) {
    await fs.unlink(tmp_path).catch(() => undefined);
    throw err;
  }
}
