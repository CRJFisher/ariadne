import { describe, expect, it } from "vitest";
import { evaluate_tool_call } from "./registry_write_guard.js";

const PROJECT_DIR = "/repo";
const REGISTRY_ABS = "/repo/.claude/skills/triage/known_issues/registry.json";
const REGISTRY_REL = ".claude/skills/triage/known_issues/registry.json";

function decision_of(
  tool_name: string,
  tool_input: Record<string, unknown> | undefined,
): "pass" | "ask" {
  return evaluate_tool_call({ tool_name, tool_input, project_dir: PROJECT_DIR })
    .decision;
}

describe("evaluate_tool_call — Write/Edit", () => {
  it("asks on a Write to the registry by absolute path", () => {
    expect(decision_of("Write", { file_path: REGISTRY_ABS })).toEqual("ask");
  });

  it("asks on an Edit to the registry by repo-relative path", () => {
    expect(decision_of("Edit", { file_path: REGISTRY_REL })).toEqual("ask");
  });

  it("asks on a path that resolves to the registry through ..", () => {
    expect(
      decision_of("Write", {
        file_path:
          "/repo/.claude/skills/triage/known_issues/../known_issues/registry.json",
      }),
    ).toEqual("ask");
  });

  it("asks on a Write to the lock sidecar", () => {
    expect(decision_of("Write", { file_path: `${REGISTRY_ABS}.lock` })).toEqual(
      "ask",
    );
  });

  it("passes a registry.json that lives elsewhere in the repo", () => {
    expect(
      decision_of("Write", { file_path: "/repo/packages/core/registry.json" }),
    ).toEqual("pass");
  });

  it("passes an ordinary source-file Edit", () => {
    expect(
      decision_of("Edit", { file_path: "/repo/packages/core/src/index.ts" }),
    ).toEqual("pass");
  });

  it("passes when file_path is missing", () => {
    expect(decision_of("Write", {})).toEqual("pass");
    expect(decision_of("Write", undefined)).toEqual("pass");
  });

  it("names the per-edit contract in the ask reason", () => {
    const result = evaluate_tool_call({
      tool_name: "Write",
      tool_input: { file_path: REGISTRY_ABS },
      project_dir: PROJECT_DIR,
    });
    expect(result).toEqual({
      decision: "ask",
      reason:
        "This Write targets the human-owned classifier registry " +
        "(.claude/skills/triage/known_issues/registry.json). Per " +
        ".claude/rules/classifier-lifecycle.md every registry transition is " +
        "a per-edit human decision: approve only if you are interactively " +
        "directing this edit; an unattended pipeline agent must route the " +
        "transition back to the human (reconcile_registry.ts --stage / " +
        "--id ... --fixed --reason).",
    });
  });
});

describe("evaluate_tool_call — Bash write constructs", () => {
  it("passes read-only commands over the registry", () => {
    expect(decision_of("Bash", { command: `cat ${REGISTRY_REL}` })).toEqual(
      "pass",
    );
    expect(
      decision_of("Bash", { command: `jq '.[].group_id' ${REGISTRY_ABS}` }),
    ).toEqual("pass");
    expect(
      decision_of("Bash", { command: `grep -n wip ${REGISTRY_REL}` }),
    ).toEqual("pass");
    expect(
      decision_of("Bash", { command: `git show HEAD:${REGISTRY_REL}` }),
    ).toEqual("pass");
  });

  it("asks on a redirect into the registry", () => {
    expect(
      decision_of("Bash", { command: `echo '[]' > ${REGISTRY_REL}` }),
    ).toEqual("ask");
    expect(
      decision_of("Bash", {
        command: `jq 'map(.status = "fixed")' in.json >> ${REGISTRY_ABS}`,
      }),
    ).toEqual("ask");
  });

  it("asks on cwd-relative redirect forms", () => {
    expect(
      decision_of("Bash", {
        command:
          "cd .claude/skills/triage/known_issues && jq '.' x.json > registry.json",
      }),
    ).toEqual("ask");
  });

  it("asks on in-place edits, moves, copies, and tee", () => {
    expect(
      decision_of("Bash", { command: `sed -i 's/wip/fixed/' ${REGISTRY_REL}` }),
    ).toEqual("ask");
    expect(
      decision_of("Bash", { command: `mv draft.json ${REGISTRY_REL}` }),
    ).toEqual("ask");
    expect(
      decision_of("Bash", { command: `cp draft.json ${REGISTRY_ABS}` }),
    ).toEqual("ask");
    expect(
      decision_of("Bash", { command: `cat x.json | tee ${REGISTRY_REL}` }),
    ).toEqual("ask");
  });

  it("asks on removing the lock sidecar", () => {
    expect(
      decision_of("Bash", { command: `rm ${REGISTRY_REL}.lock` }),
    ).toEqual("ask");
  });

  it("asks on an inline node write", () => {
    expect(
      decision_of("Bash", {
        command: `node -e 'fs.writeFileSync("${REGISTRY_REL}", "[]")'`,
      }),
    ).toEqual("ask");
  });

  it("asks on inline node copy/rename/rm/stream writes", () => {
    expect(
      decision_of("Bash", {
        command: `node -e 'require("fs").cpSync("draft.json", "${REGISTRY_REL}")'`,
      }),
    ).toEqual("ask");
    expect(
      decision_of("Bash", {
        command: `node -e 'fs.copyFileSync("draft.json", "${REGISTRY_ABS}")'`,
      }),
    ).toEqual("ask");
    expect(
      decision_of("Bash", {
        command: `node -e 'fs.renameSync("/tmp/staged.json", "${REGISTRY_REL}")'`,
      }),
    ).toEqual("ask");
    expect(
      decision_of("Bash", {
        command: `node -e 'fs.rmSync("${REGISTRY_REL}")'`,
      }),
    ).toEqual("ask");
    expect(
      decision_of("Bash", {
        command: `node -e 'fs.createWriteStream("${REGISTRY_REL}").end("[]")'`,
      }),
    ).toEqual("ask");
  });

  it("passes an inline node read of the registry", () => {
    expect(
      decision_of("Bash", {
        command: `node -e 'console.log(fs.readFileSync("${REGISTRY_REL}", "utf8"))'`,
      }),
    ).toEqual("pass");
  });

  it("asks on async node fs move/copy/delete twins", () => {
    expect(
      decision_of("Bash", {
        command: `node -e 'require("fs").rm("${REGISTRY_REL}", () => {})'`,
      }),
    ).toEqual("ask");
    expect(
      decision_of("Bash", {
        command: `node -e 'require("fs").promises.rename("/tmp/staged.json", "${REGISTRY_REL}")'`,
      }),
    ).toEqual("ask");
    expect(
      decision_of("Bash", {
        command: `node -e 'fs.copyFile("draft.json", "${REGISTRY_ABS}", () => {})'`,
      }),
    ).toEqual("ask");
  });

  it("asks on python shutil/os moves, replaces, and removes", () => {
    expect(
      decision_of("Bash", {
        command: `python3 -c "import shutil; shutil.move('/tmp/staged.json', '${REGISTRY_REL}')"`,
      }),
    ).toEqual("ask");
    expect(
      decision_of("Bash", {
        command: `python3 -c "import os; os.replace('/tmp/staged.json', '${REGISTRY_ABS}')"`,
      }),
    ).toEqual("ask");
    expect(
      decision_of("Bash", {
        command: `python3 -c "import os; os.remove('${REGISTRY_REL}')"`,
      }),
    ).toEqual("ask");
    expect(
      decision_of("Bash", {
        command: `python3 -c "import os; os.replace(os.path.join(d, 'staged.json'), '${REGISTRY_REL}')"`,
      }),
    ).toEqual("ask");
  });

  it("asks on pathlib write_text against the registry", () => {
    expect(
      decision_of("Bash", {
        command: `python3 -c "from pathlib import Path; Path('${REGISTRY_REL}').write_text('[]')"`,
      }),
    ).toEqual("ask");
  });

  it("passes a pathlib read of the registry", () => {
    expect(
      decision_of("Bash", {
        command: `python3 -c "from pathlib import Path; print(Path('${REGISTRY_REL}').read_text())"`,
      }),
    ).toEqual("pass");
  });

  it("asks on a python write-mode open against the registry", () => {
    expect(
      decision_of("Bash", {
        command: `python3 -c "open('${REGISTRY_REL}', 'w').write('[]')"`,
      }),
    ).toEqual("ask");
    expect(
      decision_of("Bash", {
        command: `python3 -c "open('${REGISTRY_ABS}', 'a').write(',{}')"`,
      }),
    ).toEqual("ask");
    expect(
      decision_of("Bash", {
        command: `python3 -c "f = open('${REGISTRY_REL}', 'r+'); f.write('[]')"`,
      }),
    ).toEqual("ask");
    expect(
      decision_of("Bash", {
        command: `python3 -c "open('${REGISTRY_REL}', mode='w').write('[]')"`,
      }),
    ).toEqual("ask");
    expect(
      decision_of("Bash", {
        command: `python3 -c "import io; io.open('${REGISTRY_REL}', 'w').write('[]')"`,
      }),
    ).toEqual("ask");
    expect(
      decision_of("Bash", {
        command: `python3 -c "open('${REGISTRY_REL}', 'x').write('[]')"`,
      }),
    ).toEqual("ask");
  });

  it("passes a python read-mode or modeless open of the registry", () => {
    expect(
      decision_of("Bash", {
        command: `python3 -c "import json; print(json.load(open('${REGISTRY_REL}')))"`,
      }),
    ).toEqual("pass");
    expect(
      decision_of("Bash", {
        command: `python3 -c "print(open('${REGISTRY_REL}', 'r').read())"`,
      }),
    ).toEqual("pass");
    expect(
      decision_of("Bash", {
        command: `python3 -c "print(open('${REGISTRY_ABS}', 'rb').read())"`,
      }),
    ).toEqual("pass");
  });

  it("passes a python read even when an unrelated quoted 'w' follows the closed open call", () => {
    expect(
      decision_of("Bash", {
        command: `python3 -c "print(open('${REGISTRY_REL}').read(), 'w')"`,
      }),
    ).toEqual("pass");
  });

  it("passes a multiline registry read followed by a write to another file", () => {
    expect(
      decision_of("Bash", {
        command: `python3 -c "data = open('${REGISTRY_REL}').read()\nopen('/tmp/report.txt', 'w').write(data)"`,
      }),
    ).toEqual("pass");
  });

  it("asks on a perl > open against the registry", () => {
    expect(
      decision_of("Bash", {
        command: `perl -e "open(F, '>', '${REGISTRY_REL}'); print F '[]'"`,
      }),
    ).toEqual("ask");
    expect(
      decision_of("Bash", {
        command: `perl -e "open(F, '>>${REGISTRY_ABS}'); print F ','"`,
      }),
    ).toEqual("ask");
  });

  it("passes a perl read-mode open of the registry", () => {
    expect(
      decision_of("Bash", {
        command: `perl -e "open(F, '<', '${REGISTRY_REL}'); print <F>"`,
      }),
    ).toEqual("pass");
  });

  it("passes commands that never mention the registry", () => {
    expect(decision_of("Bash", { command: "pnpm test" })).toEqual("pass");
    expect(
      decision_of("Bash", { command: "echo hi > /tmp/out.txt" }),
    ).toEqual("pass");
  });

  it("passes registry reads that redirect their output elsewhere", () => {
    expect(
      decision_of("Bash", { command: `grep wip ${REGISTRY_REL} > /tmp/out.txt` }),
    ).toEqual("pass");
    expect(
      decision_of("Bash", {
        command: `git show HEAD:${REGISTRY_REL} > /tmp/before.json`,
      }),
    ).toEqual("pass");
  });

  it("passes reads whose > is a comparison, not a redirect", () => {
    expect(
      decision_of("Bash", {
        command: `jq '[.[] | select(.observed_count > 1)]' ${REGISTRY_REL}`,
      }),
    ).toEqual("pass");
  });

  it("passes a flag cluster that merely contains a write verb", () => {
    expect(
      decision_of("Bash", { command: `grep -rm 5 wip ${REGISTRY_REL}` }),
    ).toEqual("pass");
  });

  it("asks on git checkout/restore over the registry", () => {
    expect(
      decision_of("Bash", { command: `git checkout -- ${REGISTRY_REL}` }),
    ).toEqual("ask");
    expect(
      decision_of("Bash", { command: `git restore ${REGISTRY_REL}` }),
    ).toEqual("ask");
  });

  it("passes when command is missing", () => {
    expect(decision_of("Bash", {})).toEqual("pass");
    expect(decision_of("Bash", undefined)).toEqual("pass");
  });
});

describe("evaluate_tool_call — Bash reconcile_registry.ts invocations", () => {
  const RECONCILE = "node --import tsx .claude/skills/triage/scripts/reconcile_registry.ts";

  it("asks on a bare invocation, which applies detected proposals by default", () => {
    expect(decision_of("Bash", { command: RECONCILE })).toEqual("ask");
  });

  it("asks on write-mode flags", () => {
    expect(
      decision_of("Bash", { command: `${RECONCILE} --id r --promote` }),
    ).toEqual("ask");
    expect(
      decision_of("Bash", {
        command: `${RECONCILE} --id r --fixed --reason "subsumed"`,
      }),
    ).toEqual("ask");
    expect(
      decision_of("Bash", { command: `${RECONCILE} --stage draft.json --apply` }),
    ).toEqual("ask");
  });

  it("passes read-only invocations", () => {
    expect(
      decision_of("Bash", { command: `${RECONCILE} --dry-run` }),
    ).toEqual("pass");
    expect(
      decision_of("Bash", { command: `${RECONCILE} --id r --promote --dry-run` }),
    ).toEqual("pass");
    expect(
      decision_of("Bash", { command: `${RECONCILE} --stage draft.json` }),
    ).toEqual("pass");
    expect(decision_of("Bash", { command: `${RECONCILE} --help` })).toEqual(
      "pass",
    );
  });

  it("asks when a read-only flag appears only inside a quoted argument", () => {
    expect(
      decision_of("Bash", {
        command: `${RECONCILE} --id r --fixed --reason "see --dry-run docs"`,
      }),
    ).toEqual("ask");
    expect(
      decision_of("Bash", {
        command: `${RECONCILE} --id r --fixed --reason 'mentions --help'`,
      }),
    ).toEqual("ask");
  });

  it("asks on a bun invocation", () => {
    expect(
      decision_of("Bash", {
        command:
          "bun .claude/skills/triage/scripts/reconcile_registry.ts --id r --promote",
      }),
    ).toEqual("ask");
  });

  it("asks on a deno invocation", () => {
    expect(
      decision_of("Bash", {
        command:
          "deno run -A .claude/skills/triage/scripts/reconcile_registry.ts --id r --fixed --reason 'subsumed'",
      }),
    ).toEqual("ask");
  });

  it("asks on a command-position bare-path exec", () => {
    expect(
      decision_of("Bash", {
        command: "./reconcile_registry.ts --id r --fixed --reason 'subsumed'",
      }),
    ).toEqual("ask");
    expect(
      decision_of("Bash", {
        command:
          "cd .claude/skills/triage/scripts && ./reconcile_registry.ts --id r --promote",
      }),
    ).toEqual("ask");
    expect(
      decision_of("Bash", {
        command:
          "/repo/.claude/skills/triage/scripts/reconcile_registry.ts --stage draft.json --apply",
      }),
    ).toEqual("ask");
  });

  it("passes read-only bun and bare-path invocations", () => {
    expect(
      decision_of("Bash", {
        command:
          "bun .claude/skills/triage/scripts/reconcile_registry.ts --dry-run",
      }),
    ).toEqual("pass");
    expect(
      decision_of("Bash", {
        command: "./reconcile_registry.ts --stage draft.json",
      }),
    ).toEqual("pass");
  });

  it("passes commands that mention the script without executing it", () => {
    expect(
      decision_of("Bash", {
        command:
          "grep -n known_builtin_names .claude/skills/triage/scripts/reconcile_registry.ts",
      }),
    ).toEqual("pass");
    expect(
      decision_of("Bash", {
        command: "cat .claude/skills/triage/scripts/reconcile_registry.ts",
      }),
    ).toEqual("pass");
    expect(
      decision_of("Bash", {
        command:
          "npx vitest run .claude/skills/triage/scripts/reconcile_registry.test.ts",
      }),
    ).toEqual("pass");
  });
});

describe("evaluate_tool_call — other tools", () => {
  it("passes non-guarded tools even when they name the registry", () => {
    expect(decision_of("Read", { file_path: REGISTRY_ABS })).toEqual("pass");
    expect(decision_of("Grep", { path: REGISTRY_ABS })).toEqual("pass");
  });
});
