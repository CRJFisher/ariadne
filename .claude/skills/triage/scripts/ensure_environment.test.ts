import { execFileSync, spawnSync } from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(SCRIPTS_DIR, "ensure_environment.sh");
const SKILL_PACKAGE_JSON = path.join(SCRIPTS_DIR, "..", "package.json");

// The skill's real workspace dependencies, in package.json order — the script reads
// the same file, so these are the packages it must install and build.
const WORKSPACE_PACKAGES = ["core", "skill-fs", "skill-protocol", "types"];

// A `pnpm` stand-in that records each call and leaves behind what the real one
// would: an install lays down `tsx` and the skill's workspace links, a build
// writes every package's `dist/index.js`.
const FAKE_PNPM = `#!/usr/bin/env bash
echo "$*" >>"$PNPM_LOG"
if [[ "$1" == "install" ]]; then
  mkdir -p node_modules/.bin .claude/skills/triage/node_modules/@ariadnejs
  touch node_modules/.bin/tsx
  for name in ${WORKSPACE_PACKAGES.join(" ")}; do
    mkdir -p ".claude/skills/triage/node_modules/@ariadnejs/$name"
  done
else
  for name in ${WORKSPACE_PACKAGES.join(" ")}; do
    mkdir -p "packages/$name/dist"
    touch "packages/$name/dist/index.js"
  done
fi
`;

interface RunResult {
  status: number | null;
  stdout: string;
  stderr: string;
  pnpm_calls: string[];
}

let root: string;
let bin_dir: string;
let pnpm_log: string;

async function write(rel: string, content: string): Promise<string> {
  const full = path.join(root, rel);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, content, "utf8");
  return full;
}

async function run(env_path: string): Promise<RunResult> {
  const result = spawnSync(
    "bash",
    [path.join(root, ".claude/skills/triage/scripts/ensure_environment.sh")],
    {
      cwd: root,
      encoding: "utf8",
      env: { HOME: process.env.HOME, PATH: env_path, PNPM_LOG: pnpm_log },
    }
  );
  const log = await fs.readFile(pnpm_log, "utf8").catch(() => "");
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    pnpm_calls: log.split("\n").filter((line) => line !== ""),
  };
}

const WITH_PNPM = (): string => `${bin_dir}:/usr/bin:/bin`;
const WITHOUT_PNPM = "/usr/bin:/bin";

beforeEach(async () => {
  const sandbox = await fs.mkdtemp(
    path.join(os.tmpdir(), "ensure-environment-test-")
  );
  root = path.join(sandbox, "checkout");
  bin_dir = path.join(sandbox, "bin");
  pnpm_log = path.join(sandbox, "pnpm.log");

  await fs.mkdir(root, { recursive: true });
  execFileSync("git", ["init", "-q"], { cwd: root });
  await write(
    ".claude/skills/triage/scripts/ensure_environment.sh",
    await fs.readFile(SCRIPT, "utf8")
  );
  await write(
    ".claude/skills/triage/package.json",
    await fs.readFile(SKILL_PACKAGE_JSON, "utf8")
  );
  for (const name of WORKSPACE_PACKAGES) {
    await write(`packages/${name}/src/index.ts`, "export const x = 1;\n");
  }

  await fs.mkdir(bin_dir, { recursive: true });
  await fs.writeFile(path.join(bin_dir, "pnpm"), FAKE_PNPM, { mode: 0o755 });
});

afterEach(async () => {
  await fs.rm(path.dirname(root), { recursive: true, force: true });
});

describe("ensure_environment.sh", () => {
  it("installs and builds a fresh worktree that has neither", async () => {
    const result = await run(WITH_PNPM());

    expect(result).toEqual({
      status: 0,
      stdout:
        "environment: installed dependencies; built core skill-fs skill-protocol types\n",
      stderr: "",
      pnpm_calls: [
        "install --prefer-offline --frozen-lockfile",
        "--filter triage^... run build",
      ],
    });
  });

  it("leaves a ready checkout untouched", async () => {
    await run(WITH_PNPM());
    await fs.rm(pnpm_log);

    const result = await run(WITH_PNPM());

    expect(result).toEqual({
      status: 0,
      stdout: "environment: ready\n",
      stderr: "",
      pnpm_calls: [],
    });
  });

  it("rebuilds without reinstalling when a package's source is newer than its build", async () => {
    await run(WITH_PNPM());
    await fs.rm(pnpm_log);
    const later = new Date(Date.now() + 60_000);
    await fs.utimes(
      path.join(root, "packages/skill-fs/src/index.ts"),
      later,
      later
    );

    const result = await run(WITH_PNPM());

    expect(result).toEqual({
      status: 0,
      stdout: "environment: built core skill-fs skill-protocol types\n",
      stderr: "",
      pnpm_calls: ["--filter triage^... run build"],
    });
  });

  it("reinstalls when one of the skill's workspace links is missing", async () => {
    await run(WITH_PNPM());
    await fs.rm(pnpm_log);
    await fs.rm(
      path.join(root, ".claude/skills/triage/node_modules/@ariadnejs/types"),
      { recursive: true }
    );

    const result = await run(WITH_PNPM());

    expect(result).toEqual({
      status: 0,
      stdout: "environment: installed dependencies\n",
      stderr: "",
      pnpm_calls: ["install --prefer-offline --frozen-lockfile"],
    });
  });

  it("takes over a lock whose holder has died", async () => {
    const git_dir = execFileSync("git", ["rev-parse", "--absolute-git-dir"], {
      cwd: root,
      encoding: "utf8",
    }).trim();
    const dead = spawnSync("true");
    await fs.mkdir(path.join(git_dir, "triage-environment.lock"));
    await fs.writeFile(
      path.join(git_dir, "triage-environment.lock", "pid"),
      `${dead.pid}\n`
    );

    const result = await run(WITH_PNPM());

    expect(result.stdout).toEqual(
      "environment: installed dependencies; built core skill-fs skill-protocol types\n"
    );
    await expect(
      fs.access(path.join(git_dir, "triage-environment.lock"))
    ).rejects.toThrow(/ENOENT/);
  });

  it("fails naming pnpm when a checkout needs work and pnpm is not on PATH", async () => {
    const result = await run(WITHOUT_PNPM);

    expect(result).toEqual({
      status: 1,
      stdout: "",
      stderr: `environment: pnpm is not on PATH; install it to hydrate ${root}\n`,
      pnpm_calls: [],
    });
  });
});
