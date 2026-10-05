// Module-qualified call site - uses_worker.rs
// Tests: worker::create(7) resolves to create in the worker module

mod worker;

use worker::create;

fn run() -> u32 {
    // Module-qualified call — name reduces to `create`, path_prefix ["worker"]
    worker::create(7)
}
