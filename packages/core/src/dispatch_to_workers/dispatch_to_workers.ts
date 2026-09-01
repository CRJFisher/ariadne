/**
 * Run a per-file pass across worker threads and hand its results back in the
 * caller's input order.
 *
 * What comes through here is work that reads nothing but the file it is given.
 * Everything else in the pipeline reads project-wide registries and stays on
 * one thread. Results are re-ordered before delivery because the call graph
 * Ariadne reports depends on the order files arrive in.
 *
 * The transport is whatever `postMessage` copies, and an indexing job hands
 * back a JSON string rather than an object graph: `structuredClone` throws on
 * any residual non-cloneable field and takes the whole file down with it, which
 * cost 133 nodes, 172 call edges and 15 entry points on `vs/base` alone.
 *
 * The worker entry is the BUILT `.js` under `dist`. A pass dispatched from a
 * source-run harness still loads the compiled worker, so no worker depends on
 * the host process having registered a TypeScript loader hook.
 */
import { Worker } from "node:worker_threads";
import * as fs from "node:fs";
import * as path from "node:path";

export interface WorkerOutcome<TOutput> {
  /** Position in the caller's input array. Outcomes arrive in this order. */
  readonly input_index: number;
  readonly output: TOutput | null;
  /** The message the pass threw for this input, or null when it succeeded. */
  readonly error: string | null;
}

export interface WorkerPassRequest<TInput> {
  readonly inputs: readonly TInput[];
  readonly worker_width: number;
}

export interface WorkerPoolStats {
  readonly worker_width: number;
  /** Wall spent starting workers, before any job is dispatched. */
  readonly boot_ms: number;
  readonly boot_cpu_ms: number;
  /** Summed worker-thread time inside the pass itself, across all workers. */
  readonly worker_pass_ms: number;
  /** Inputs re-dispatched because the worker holding them died. */
  readonly redispatched_inputs: number;
  /** Workers replaced after a crash. */
  readonly worker_restarts: number;
}

/**
 * How many jobs a worker holds at once. One would leave it idle across every
 * round trip; more than two buys nothing once the queue is deep and delays the
 * re-dispatch of a crashed worker's backlog.
 */
const JOBS_IN_FLIGHT_PER_WORKER = 2;

/**
 * How many times one input may kill a worker before it is reported as a failed
 * input rather than re-dispatched again. Without it an input that crashes the
 * thread deterministically would restart workers forever.
 */
const MAX_REDISPATCHES_PER_INPUT = 2;

export interface RedispatchPlan {
  /** Inputs to hand to a fresh worker. */
  readonly requeue: readonly number[];
  /** Inputs that have now killed a worker too often to try again. */
  readonly give_up: readonly number[];
  /** `attempts_so_far`, advanced by this crash. */
  readonly attempts: ReadonlyMap<number, number>;
}

/**
 * What a dying worker's backlog becomes.
 *
 * A crash loses only the jobs that worker held, so re-dispatching them keeps
 * the load's coverage complete — which is the whole reason a load reports its
 * dropped files instead of dying on one. An input that kills every worker it
 * reaches is the opposite case: retried without bound it restarts workers
 * forever and the load never finishes, so it becomes a failed input, which the
 * load records as a dropped file.
 */
export function plan_worker_redispatch(
  in_flight: ReadonlySet<number>,
  attempts_so_far: ReadonlyMap<number, number>,
): RedispatchPlan {
  const requeue: number[] = [];
  const give_up: number[] = [];
  const attempts = new Map(attempts_so_far);
  for (const input_index of in_flight) {
    const attempt = (attempts.get(input_index) ?? 0) + 1;
    attempts.set(input_index, attempt);
    if (attempt > MAX_REDISPATCHES_PER_INPUT) give_up.push(input_index);
    else requeue.push(input_index);
  }
  return { requeue, give_up, attempts };
}

const WORKER_ENTRY = resolve_worker_entry();

/**
 * The built worker entry beside this module in `dist`, whether this module is
 * itself running from `dist` or from `src` under a TypeScript loader.
 */
function resolve_worker_entry(): string {
  const built_beside_here = path.join(__dirname, "worker_entry.js");
  if (fs.existsSync(built_beside_here)) return built_beside_here;
  const from_source = path.join(
    __dirname,
    "..",
    "..",
    "dist",
    "dispatch_to_workers",
    "worker_entry.js",
  );
  if (fs.existsSync(from_source)) return from_source;
  throw new Error(
    `No built worker entry at ${built_beside_here} or ${from_source}. ` +
      "Worker passes load the compiled worker rather than the host's loader hook — run `npm run build` in packages/core.",
  );
}

interface PoolWorker {
  readonly worker: Worker;
  /** Input indices this worker holds, so a crash can re-dispatch them. */
  readonly in_flight: Set<number>;
  alive: boolean;
}

/**
 * Dispatch `inputs` across `worker_width` threads, calling `on_outcome` once
 * per input in input order.
 *
 * `on_outcome` may be async and is awaited before the next outcome is
 * delivered, so a caller applying results to shared state never sees two at
 * once. Feeding the workers does not wait on it: a worker is handed its next
 * job the moment its result arrives, before the main thread spends anything
 * applying.
 */
export async function dispatch_to_workers<TInput, TOutput>(
  request: WorkerPassRequest<TInput>,
  on_outcome: (outcome: WorkerOutcome<TOutput>) => void | Promise<void>,
): Promise<WorkerPoolStats> {
  const { inputs, worker_width } = request;
  if (worker_width < 1) {
    throw new Error(
      `A worker pass needs at least one worker, not ${worker_width}.`,
    );
  }
  if (inputs.length === 0) {
    return {
      worker_width,
      boot_ms: 0,
      boot_cpu_ms: 0,
      worker_pass_ms: 0,
      redispatched_inputs: 0,
      worker_restarts: 0,
    };
  }

  const boot_wall_at_start = process.hrtime.bigint();
  const boot_cpu_at_start = process.cpuUsage();
  const pool: PoolWorker[] = [];
  let worker_pass_ms = 0;
  let redispatched_inputs = 0;
  let worker_restarts = 0;
  let next_to_dispatch = 0;
  let next_to_emit = 0;
  let emitted = 0;
  let draining = false;
  const requeued: number[] = [];
  let redispatch_count: ReadonlyMap<number, number> = new Map();
  const pending = new Map<number, WorkerOutcome<TOutput>>();

  let settle: (error?: Error) => void = () => {};
  const finished = new Promise<void>((resolve, reject) => {
    settle = (error) => (error ? reject(error) : resolve());
  });

  const start_worker = (): PoolWorker => {
    const entry: PoolWorker = {
      worker: new Worker(WORKER_ENTRY),
      in_flight: new Set<number>(),
      alive: true,
    };
    entry.worker.on("message", (message: WorkerMessage<TOutput>) => {
      if ("ready" in message) return;
      entry.in_flight.delete(message.input_index);
      if ("error" in message) {
        pending.set(message.input_index, {
          input_index: message.input_index,
          output: null,
          error: message.error,
        });
      } else {
        worker_pass_ms += message.pass_ns / 1e6;
        pending.set(message.input_index, {
          input_index: message.input_index,
          output: message.output,
          error: null,
        });
      }
      feed(entry);
      void drain();
    });
    entry.worker.on("error", (error: Error) => retire(entry, error.message));
    entry.worker.on("exit", (code) => {
      if (!entry.alive) return;
      retire(entry, `worker exited with code ${code}`);
    });
    return entry;
  };

  const retire = (entry: PoolWorker, reason: string): void => {
    if (!entry.alive) return;
    entry.alive = false;
    void entry.worker.terminate();
    worker_restarts++;
    const plan = plan_worker_redispatch(entry.in_flight, redispatch_count);
    redispatch_count = plan.attempts;
    for (const input_index of plan.give_up) {
      pending.set(input_index, {
        input_index,
        output: null,
        error: `killed a worker too many times to retry: ${reason}`,
      });
    }
    redispatched_inputs += plan.requeue.length;
    requeued.push(...plan.requeue);
    entry.in_flight.clear();
    const replacement = start_worker();
    pool.push(replacement);
    feed(replacement);
    void drain();
  };

  const feed = (entry: PoolWorker): void => {
    while (
      entry.alive &&
      entry.in_flight.size < JOBS_IN_FLIGHT_PER_WORKER &&
      (requeued.length > 0 || next_to_dispatch < inputs.length)
    ) {
      const input_index = requeued.pop() ?? next_to_dispatch++;
      entry.in_flight.add(input_index);
      entry.worker.postMessage({ input_index, input: inputs[input_index] });
    }
  };

  const drain = async (): Promise<void> => {
    if (draining) return;
    draining = true;
    try {
      for (
        let outcome = pending.get(next_to_emit);
        outcome !== undefined;
        outcome = pending.get(next_to_emit)
      ) {
        pending.delete(next_to_emit);
        next_to_emit++;
        emitted++;
        await on_outcome(outcome);
      }
      if (emitted === inputs.length) settle();
    } catch (error: unknown) {
      settle(error instanceof Error ? error : new Error(String(error)));
    } finally {
      draining = false;
    }
  };

  for (let i = 0; i < worker_width; i++) pool.push(start_worker());
  await Promise.all(pool.map((entry) => worker_is_ready(entry.worker)));
  const boot_cpu = process.cpuUsage(boot_cpu_at_start);
  const boot_ms = Number(process.hrtime.bigint() - boot_wall_at_start) / 1e6;

  for (const entry of pool) feed(entry);

  try {
    await finished;
  } finally {
    await Promise.all(
      pool.map((entry) => {
        entry.alive = false;
        return entry.worker.terminate();
      }),
    );
  }

  return {
    worker_width,
    boot_ms,
    boot_cpu_ms: (boot_cpu.user + boot_cpu.system) / 1000,
    worker_pass_ms,
    redispatched_inputs,
    worker_restarts,
  };
}

type WorkerMessage<TOutput> =
  | { readonly ready: true }
  | {
      readonly input_index: number;
      readonly output: TOutput;
      readonly pass_ns: number;
    }
  | { readonly input_index: number; readonly error: string };

function worker_is_ready(worker: Worker): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    worker.once("message", () => resolve());
    worker.once("error", reject);
  });
}
