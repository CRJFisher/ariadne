// Mirror of .claude/skills/triage-entrypoints/src/atomic_write.ts — keep
// behavior identical. The skills are independent pnpm packages with no shared
// workspace layer, so the helper is duplicated rather than imported across
// package boundaries. Any change here must be applied to the mirror.

import * as fs from "node:fs/promises";
import * as crypto from "node:crypto";

/**
 * Atomic write: write content to a temp sibling, then rename(2) over the
 * target path. POSIX rename is atomic — concurrent readers see either the old
 * file or the new file, never a partial write or empty file.
 *
 * Use this for any file that has multiple potential writers (e.g.
 * `registry.json`, which the curator and the fix-sequencer reconciler both
 * touch).
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
