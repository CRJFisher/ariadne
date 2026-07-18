import { defineConfig } from "vitest/config";

// Marks .claude/hooks as a test root for scripts/run_all_tests.sh discovery.
// `include` stays flat: the hook entry files self-execute on import, so only
// *.test.ts may ever be collected.
export default defineConfig({
  test: {
    environment: "node",
    include: ["*.test.ts"],
  },
});
