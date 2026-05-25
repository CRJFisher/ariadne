import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { render_authored_files } from "./render_authored_files.js";
import type { BuiltinClassifierSpec, InvestigateResponse } from "./types.js";

let tmp_dir: string;
let builtins_dir: string;

beforeEach(async () => {
  tmp_dir = await fs.mkdtemp(path.join(os.tmpdir(), "curator-render-"));
  builtins_dir = path.join(tmp_dir, "builtins");
});

afterEach(async () => {
  await fs.rm(tmp_dir, { recursive: true, force: true });
});

function spec(function_name: string): BuiltinClassifierSpec {
  return {
    function_name,
    min_confidence: 0.9,
    combinator: "all",
    checks: [{ op: "language_eq", value: "typescript" }],
    positive_examples: [],
    negative_examples: [],
    description: `${function_name} classifier`,
  };
}

function response(
  group_id: string,
  overrides: Partial<InvestigateResponse> = {},
): InvestigateResponse {
  return {
    group_id,
    proposed_classifier: {
      kind: "builtin",
      function_name: `check_${group_id}`,
      min_confidence: 0.9,
    },
    classifier_spec: spec(`check_${group_id}`),
    retargets_to: null,
    signal_library_gap: null,
    ariadne_bug: null,
    rejected_members: [],
    reasoning: "",
    ...overrides,
  };
}

describe("render_authored_files", () => {
  it("writes one check_<group_id>.ts per response with a non-null classifier_spec", async () => {
    const result = await render_authored_files(
      [response("alpha"), response("beta")],
      builtins_dir,
    );
    expect(result.render_failures).toEqual([]);
    expect(result.authored_files_by_group).toEqual({
      alpha: path.join(builtins_dir, "check_alpha.ts"),
      beta: path.join(builtins_dir, "check_beta.ts"),
    });
    const alpha_source = await fs.readFile(
      path.join(builtins_dir, "check_alpha.ts"),
      "utf8",
    );
    expect(alpha_source).toContain("check_alpha");
  });

  it("skips responses whose classifier_spec is null", async () => {
    const result = await render_authored_files(
      [
        response("alpha"),
        response("beta", {
          proposed_classifier: { kind: "none" },
          classifier_spec: null,
        }),
      ],
      builtins_dir,
    );
    expect(result.authored_files_by_group).toEqual({
      alpha: path.join(builtins_dir, "check_alpha.ts"),
    });
    await expect(
      fs.access(path.join(builtins_dir, "check_beta.ts")),
    ).rejects.toThrow();
  });

  it("keys the output by retargets_to when set, naming the file after the target", async () => {
    const result = await render_authored_files(
      [response("dispatch-group", { retargets_to: "existing-entry" })],
      builtins_dir,
    );
    expect(result.authored_files_by_group).toEqual({
      "existing-entry": path.join(builtins_dir, "check_existing-entry.ts"),
    });
  });

  it("creates the builtins dir when it does not exist", async () => {
    const nested = path.join(tmp_dir, "deep", "nest", "builtins");
    const result = await render_authored_files([response("alpha")], nested);
    expect(result.render_failures).toEqual([]);
    const source = await fs.readFile(
      path.join(nested, "check_alpha.ts"),
      "utf8",
    );
    expect(source).toContain("check_alpha");
  });

  it("is idempotent across re-runs — second call overwrites with identical source", async () => {
    const responses = [response("alpha")];
    const first = await render_authored_files(responses, builtins_dir);
    const first_source = await fs.readFile(
      first.authored_files_by_group["alpha"],
      "utf8",
    );
    const second = await render_authored_files(responses, builtins_dir);
    const second_source = await fs.readFile(
      second.authored_files_by_group["alpha"],
      "utf8",
    );
    expect(second.authored_files_by_group).toEqual(first.authored_files_by_group);
    expect(second_source).toEqual(first_source);
  });

  it("returns render_failures for specs that throw, without writing the file", async () => {
    // `op: "bogus"` is not in the closed SignalCheck union → renderer throws
    // UnknownSignalCheckOpError.
    const bad_spec: BuiltinClassifierSpec = {
      ...spec("check_bogus"),
      checks: [{ op: "bogus" as never } as never],
    };
    const result = await render_authored_files(
      [response("bogus", { classifier_spec: bad_spec })],
      builtins_dir,
    );
    expect(result.authored_files_by_group).toEqual({});
    expect(result.render_failures).toHaveLength(1);
    expect(result.render_failures[0].group_id).toBe("bogus");
    expect(result.render_failures[0].reason).toMatch(/render_classifier threw/);
    await expect(
      fs.access(path.join(builtins_dir, "check_bogus.ts")),
    ).rejects.toThrow();
  });
});
