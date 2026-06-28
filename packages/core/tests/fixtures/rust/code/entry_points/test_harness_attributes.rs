// Test-harness suppression evidence: `#[test]` / `#[cfg(test)]` callables live
// in a non-`tests/` `src` file (matching the actix-web / sqlx / tokio evidence,
// e.g. actix-http/src/ws/mask.rs), so file-path detection never sees them — the
// definition-level attribute gate must suppress them as runner-invoked.

// Genuine entry point: an uncalled production function, not test-gated.
pub fn run_server() {
    helper();
}

// Reachable (called by run_server) — not an entry point.
fn helper() {}

// Suppressed: directly attributed test, invoked by the Rust test harness.
#[test]
fn top_level_test() {}

#[cfg(test)]
mod tests {
    // Suppressed: `#[test]` inside a `#[cfg(test)]` mod.
    #[test]
    fn masks_roundtrip() {}

    // Suppressed: plain helper, gated test-only by the enclosing `#[cfg(test)]`.
    fn build_fixture() {}
}

// Over-suppression guard: a non-test `cfg` gate must NOT be suppressed, so this
// uncalled function stays a genuine entry point.
#[cfg(unix)]
fn unix_only_entry() {}
