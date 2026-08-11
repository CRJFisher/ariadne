import { defineConfig } from "vitest/config";
import { tmpdir } from "os";
import { join } from "path";

// Marks .claude/hooks as a test root for scripts/run_all_tests.sh discovery.
// The .test.ts suffix (not glob depth) is what keeps the self-executing
// *_stop.ts entry files out of collection.
export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    // The scan-base suite builds real repositories and linked worktrees per
    // case, which costs seconds each on a loaded machine. The 5s default turns
    // that cost into spurious Stop-hook blocks, so the budget matches the work.
    testTimeout: 30000,
    hookTimeout: 30000,
    // Hooks under test log through create_logger; without this every test run
    // would forge entries in the real hook_log.txt, which is the forensic
    // record of what the hooks actually did.
    env: { ARIADNE_HOOK_LOG: join(tmpdir(), "ariadne_hook_test_log.txt") },
  },
});
