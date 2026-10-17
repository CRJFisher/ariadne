---
"@ariadnejs/core": patch
---

Stop reporting methods read as values, and runner-invoked tests and benchmarks, as entry points.

- A bound or static method read as a value is indirectly reachable: passed as an
  argument, `this.write.bind(this)`, `addEventListener(handler)`, or stored in a
  field. Constructors are excluded; a constructor invocation is a call.
- Rust `#[test]` functions, and anything in a `#[cfg(test)]` module or `impl`,
  are test callables. `#[cfg(not(test))]` is not. ASV benchmark methods
  (`time_*`, `mem_*`, `peakmem_*` under `asv_bench/benchmarks/`) are test
  callables too. With `include_tests` off, none of them appears among the entry
  points.
