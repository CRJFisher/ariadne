/**
 * A continuous pool of concurrent investigations that warms the prompt cache
 * before it fans out.
 *
 * A prompt-cache entry becomes readable only once the first response to the
 * request that wrote it has started, so investigations launched together each
 * pay the full prefix write. Every pool therefore starts one lead
 * investigation and releases the other slots when the lead's first response
 * arrives; a lead that ends without a response hands the lead role to the next
 * investigation. Once warm, a slot refills as soon as it frees: there is no
 * batch barrier, so concurrency stays at N, and every refill is itself a
 * request that keeps the 5-minute entry alive. The pool never idles while it
 * has work, so the only gap the cache can expire across is between two pools —
 * a run resumed by a later call — and each pool begins cold with a lead.
 */

export interface WarmUp {
  /** True for an investigation started while the cache was cold. */
  lead: boolean;
  /** Call when the investigation's first response arrives. */
  on_first_response: () => void;
}

export type TaskOutcome = "done" | "requeue";

export interface PoolOptions<T> {
  tasks: readonly T[];
  concurrency: number;
  investigate: (task: T, warm_up: WarmUp) => Promise<TaskOutcome>;
  /** Checked before each dispatch; a reason stops the pool from starting more. */
  stop_reason: () => string | null;
}

export interface PoolResult {
  /** Why dispatch stopped before the queue emptied, or `null` when it emptied. */
  stopped: string | null;
}

/**
 * Run every task, `concurrency` at a time. A task that resolves `"requeue"`
 * goes to the back of the queue. A task that throws stops dispatch, with the
 * error's message as the reason; tasks already in flight run to completion.
 */
export async function run_investigation_pool<T>(options: PoolOptions<T>): Promise<PoolResult> {
  const queue = [...options.tasks];
  let stopped: string | null = null;
  let cache: "cold" | "warming" | "warm" = "cold";
  let release: () => void = () => undefined;
  let warmed: Promise<void> = Promise.resolve();

  const mark_warm = (): void => {
    if (cache !== "warming") return;
    cache = "warm";
    release();
  };

  /** Resolves with whether the caller leads; waits while another lead warms the cache. */
  const acquire = async (): Promise<boolean> => {
    for (;;) {
      if (cache === "warm") return false;
      if (cache === "cold") {
        cache = "warming";
        warmed = new Promise((resolve) => (release = resolve));
        return true;
      }
      await warmed;
    }
  };

  const worker = async (): Promise<void> => {
    for (;;) {
      stopped ??= options.stop_reason();
      if (stopped !== null) return;
      const task = queue.shift();
      if (task === undefined) return;
      const lead = await acquire();
      stopped ??= options.stop_reason();
      if (stopped !== null) {
        if (lead) {
          cache = "cold";
          release();
        }
        return;
      }
      try {
        const outcome = await options.investigate(task, { lead, on_first_response: mark_warm });
        if (outcome === "requeue") queue.push(task);
      } catch (err) {
        stopped ??= err instanceof Error ? err.message : String(err);
      } finally {
        if (lead && cache === "warming") {
          cache = "cold";
          release();
        }
      }
    }
  };

  await Promise.all(Array.from({ length: Math.max(1, options.concurrency) }, worker));
  return { stopped };
}

export interface FirstTurnCache {
  lead: boolean;
  turn1_cache_read_input_tokens: number;
}

/**
 * Investigations that started into a warm cache yet read less than 90% of the
 * shared prefix on their first request. The prefix size is taken as the
 * largest first-turn cache read of the run, so a run where no investigation
 * read the prefix at all counts every non-lead as a miss: the prefix is not
 * being shared.
 */
export function count_prefix_misses(investigations: readonly FirstTurnCache[]): number {
  const expected = Math.max(0, ...investigations.map((i) => i.turn1_cache_read_input_tokens));
  return investigations.filter((i) => !i.lead && (expected === 0 || i.turn1_cache_read_input_tokens < 0.9 * expected)).length;
}
