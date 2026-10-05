import { describe, it, expect, vi } from "vitest";
import { start_server } from "./server";
import "./cli";

// Hoisted above the imports so the module-scope boot in cli.ts reads this
// argv/env, not the test runner's.
vi.hoisted(() => {
  process.argv = ["node", "cli.js", "--project-path", "/boot/path", "--no-watch"];
  delete process.env.ARIADNE_TOOLSETS;
  delete process.env.ARIADNE_SHOW_SUPPRESSED;
});

vi.mock("./server", () => ({
  start_server: vi.fn().mockResolvedValue({}),
}));

describe("cli", () => {
  it("boots start_server exactly once with the resolved cli options", () => {
    expect(vi.mocked(start_server)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(start_server)).toHaveBeenCalledWith({
      project_path: "/boot/path",
      watch: false,
      toolsets: [],
      show_suppressed: false,
    });
  });
});
