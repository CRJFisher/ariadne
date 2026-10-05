# Over-suppression guard for the ASV benchmark gate: a `time_`-prefixed method
# OUTSIDE asv_bench/benchmarks/ follows the prefix by coincidence and is NOT a
# runner-invoked benchmark, so it must stay a genuine entry point.


class Stopwatch:
    def time_elapsed(self):
        return 0
