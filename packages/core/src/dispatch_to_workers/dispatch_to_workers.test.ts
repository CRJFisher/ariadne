import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { FilePath } from "@ariadnejs/types";
import {
  dispatch_to_workers,
  plan_worker_redispatch,
  type WorkerOutcome,
} from "./dispatch_to_workers";
import type { IndexFileInput, IndexFileOutput } from "./worker_entry";

/**
 * The pool boots the BUILT worker under `dist`, so these run against whatever
 * `npm run build` last emitted. A checkout with no `dist` has no worker to
 * dispatch to, and a test that quietly passed there would be asserting nothing.
 */
const WORKER_ENTRY_BUILT = fs.existsSync(
  path.join(__dirname, "..", "..", "dist", "dispatch_to_workers", "worker_entry.js"),
);

let corpus_dir: string;
let paths: FilePath[];

beforeAll(() => {
  corpus_dir = fs.mkdtempSync(path.join(os.tmpdir(), "ariadne-dispatch-"));
  paths = [];
  for (let i = 0; i < 12; i++) {
    const file_path = path.join(corpus_dir, `file_${i}.ts`);
    fs.writeFileSync(
      file_path,
      `export function name_${i}(): number {\n  return ${i};\n}\n`,
    );
    paths.push(file_path as FilePath);
  }
});

afterAll(() => {
  fs.rmSync(corpus_dir, { recursive: true, force: true });
});

async function index_at_width(
  width: number,
  inputs: readonly IndexFileInput[],
): Promise<WorkerOutcome<IndexFileOutput>[]> {
  const seen: WorkerOutcome<IndexFileOutput>[] = [];
  await dispatch_to_workers<IndexFileInput, null, IndexFileOutput>(
    { pass: "index_file", shared: null, inputs, worker_width: width },
    (outcome) => {
      seen.push(outcome);
    },
  );
  return seen;
}

describe.runIf(WORKER_ENTRY_BUILT)("dispatch_to_workers", () => {
  it("delivers every outcome in the caller's input order at width three", async () => {
    const inputs = paths.map((file_path) => ({ file_path }));
    const seen = await index_at_width(3, inputs);

    expect(seen.map((outcome) => outcome.input_index)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ]);
    expect(seen.every((outcome) => outcome.error === null)).toBe(true);
  });

  it("gives the same ordered outcomes at width one as at width three", async () => {
    const inputs = paths.map((file_path) => ({ file_path }));
    const wide = await index_at_width(3, inputs);
    const narrow = await index_at_width(1, inputs);

    expect(narrow.map((outcome) => outcome.input_index)).toEqual(
      wide.map((outcome) => outcome.input_index),
    );
    expect(narrow.map((outcome) => outcome.output)).toEqual(
      wide.map((outcome) => outcome.output),
    );
  });

  it("reports a file it could not read rather than throwing it", async () => {
    const inputs: IndexFileInput[] = [
      { file_path: paths[0] },
      { file_path: path.join(corpus_dir, "absent.ts") as FilePath },
      { file_path: paths[1] },
    ];
    const seen = await index_at_width(2, inputs);

    expect(seen.map((outcome) => outcome.input_index)).toEqual([0, 1, 2]);
    expect(seen[1].error).toBe(null);
    expect(seen[1].output).toEqual({ read: false });
    expect(seen[0].output?.read).toBe(true);
    expect(seen[2].output?.read).toBe(true);
  });

  it("boots no worker for an empty input list", async () => {
    const stats = await dispatch_to_workers<IndexFileInput, null, IndexFileOutput>(
      { pass: "index_file", shared: null, inputs: [], worker_width: 4 },
      () => {
        throw new Error("an empty pass must call back for nothing");
      },
    );

    expect(stats.boot_ms).toBe(0);
    expect(stats.worker_pass_ms).toBe(0);
  });

  it("refuses a width below one rather than dispatching nothing forever", async () => {
    await expect(
      dispatch_to_workers<IndexFileInput, null, IndexFileOutput>(
        {
          pass: "index_file",
          shared: null,
          inputs: [{ file_path: paths[0] }],
          worker_width: 0,
        },
        () => {},
      ),
    ).rejects.toThrow("at least one worker");
  });
});

/**
 * The thread-death half of a crash cannot be staged from a test — a worker dies
 * on an out-of-memory or a native fault, neither of which a fixture can produce
 * on demand — so the policy that decides what its backlog becomes is tested
 * directly.
 */
describe("plan_worker_redispatch", () => {
  it("re-dispatches every file a dying worker held", () => {
    const plan = plan_worker_redispatch(new Set([4, 7]), new Map());

    expect(plan.requeue).toEqual([4, 7]);
    expect(plan.give_up).toEqual([]);
    expect([...plan.attempts]).toEqual([
      [4, 1],
      [7, 1],
    ]);
  });

  it("gives up on a file once it has killed three workers", () => {
    const twice = plan_worker_redispatch(
      new Set([4]),
      new Map([[4, 2]]),
    );

    expect(twice.requeue).toEqual([]);
    expect(twice.give_up).toEqual([4]);
    expect(twice.attempts.get(4)).toBe(3);
  });

  it("counts attempts per file, so one bad file does not condemn its neighbours", () => {
    const plan = plan_worker_redispatch(
      new Set([1, 2]),
      new Map([[1, 2]]),
    );

    expect(plan.give_up).toEqual([1]);
    expect(plan.requeue).toEqual([2]);
  });
});
