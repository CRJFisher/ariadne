import { defineConfig } from "vitest/config";

// Marks .claude/hooks as a test root for scripts/run_all_tests.sh discovery.
// The .test.ts suffix (not glob depth) is what keeps the self-executing
// *_stop.ts entry files out of collection.
export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
  },
});
