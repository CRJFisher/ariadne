import { describe, expect, it } from "vitest";

import { count_prefix_misses, run_investigation_pool, type TaskOutcome, type WarmUp } from "./investigation_pool.js";

/** A task the test settles by hand, recording the order things happen in. */
class ManualTask {
  readonly started: Promise<WarmUp>;
  private start: (warm_up: WarmUp) => void = () => undefined;
  private settle: (outcome: TaskOutcome) => void = () => undefined;
  private fail: (err: Error) => void = () => undefined;

  constructor(readonly id: string) {
    this.started = new Promise((resolve) => (this.start = resolve));
  }

  run(warm_up: WarmUp): Promise<TaskOutcome> {
    this.start(warm_up);
    return new Promise((resolve, reject) => {
      this.settle = resolve;
      this.fail = reject;
    });
  }

  finish(outcome: TaskOutcome = "done"): void {
    this.settle(outcome);
  }

  throw(message: string): void {
    this.fail(new Error(message));
  }
}

const tick = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

function pool_over(tasks: ManualTask[], concurrency: number, extra: { stop_reason?: () => string | null } = {}) {
  const started: string[] = [];
  const done = run_investigation_pool({
    tasks,
    concurrency,
    investigate: (task, warm_up) => {
      started.push(`${task.id}${warm_up.lead ? " (lead)" : ""}`);
      return task.run(warm_up);
    },
    stop_reason: extra.stop_reason ?? (() => null),
  });
  return { started, done };
}

describe("run_investigation_pool", () => {
  it("starts one lead and releases the other slots when its first response arrives", async () => {
    const tasks = ["a", "b", "c"].map((id) => new ManualTask(id));
    const { started, done } = pool_over(tasks, 3);

    const lead = await tasks[0].started;
    await tick();
    expect(started).toEqual(["a (lead)"]);

    lead.on_first_response();
    await tick();
    expect(started).toEqual(["a (lead)", "b", "c"]);

    tasks.forEach((t) => t.finish());
    expect(await done).toEqual({ stopped: null });
  });

  it("refills a freed slot immediately once warm, with no batch barrier", async () => {
    const tasks = ["a", "b", "c"].map((id) => new ManualTask(id));
    const { started, done } = pool_over(tasks, 2);

    (await tasks[0].started).on_first_response();
    await tasks[1].started;
    tasks[1].finish();
    await tasks[2].started;
    expect(started).toEqual(["a (lead)", "b", "c"]);

    tasks[0].finish();
    tasks[2].finish();
    await done;
  });

  it("hands the lead role on when a lead ends without a response", async () => {
    const tasks = ["a", "b"].map((id) => new ManualTask(id));
    const { started, done } = pool_over(tasks, 2);

    await tasks[0].started;
    tasks[0].finish();
    await tasks[1].started;
    expect(started).toEqual(["a (lead)", "b (lead)"]);

    tasks[1].finish();
    await done;
  });

  it("runs a requeued task again", async () => {
    const tasks = [new ManualTask("a")];
    const outcomes: TaskOutcome[] = ["requeue", "done"];
    const started: string[] = [];
    const done = run_investigation_pool({
      tasks,
      concurrency: 1,
      investigate: async (task, warm_up) => {
        started.push(task.id);
        warm_up.on_first_response();
        return outcomes.shift() ?? "done";
      },
      stop_reason: () => null,
    });
    expect(await done).toEqual({ stopped: null });
    expect(started).toEqual(["a", "a"]);
  });

  it("stops dispatching on a stop reason, and when a task throws", async () => {
    let reason: string | null = null;
    const tasks = ["a", "b", "c"].map((id) => new ManualTask(id));
    const { started, done } = pool_over(tasks, 1, { stop_reason: () => reason });

    (await tasks[0].started).on_first_response();
    reason = "spend cap reached";
    tasks[0].finish();
    expect(await done).toEqual({ stopped: "spend cap reached" });
    expect(started).toEqual(["a (lead)"]);

    const failing = [new ManualTask("x"), new ManualTask("y")];
    const second = pool_over(failing, 1);
    await failing[0].started;
    failing[0].throw("investigation stopped by billing_error");
    expect(await second.done).toEqual({ stopped: "investigation stopped by billing_error" });
    expect(second.started).toEqual(["x (lead)"]);
  });
});

describe("count_prefix_misses", () => {
  it("counts non-leads that read under 90% of the largest first-turn cache read", () => {
    expect(
      count_prefix_misses([
        { lead: true, turn1_cache_read_input_tokens: 0 },
        { lead: false, turn1_cache_read_input_tokens: 3000 },
        { lead: false, turn1_cache_read_input_tokens: 2800 },
        { lead: false, turn1_cache_read_input_tokens: 400 },
      ]),
    ).toEqual(1);
  });

  it("counts every non-lead when no investigation read the prefix", () => {
    expect(
      count_prefix_misses([
        { lead: true, turn1_cache_read_input_tokens: 0 },
        { lead: false, turn1_cache_read_input_tokens: 0 },
        { lead: false, turn1_cache_read_input_tokens: 0 },
      ]),
    ).toEqual(2);
  });
});
