// Inline-full-path associated constructor - inline_path_constructor.rs
// Tests: crate::runtime::Driver::new() resolves to the `new` associated
// constructor by walking the inline module path to the type, even though
// `Driver` is never bound by a bare name in the caller's scope.

mod runtime {
    // Unit struct on purpose. With a field-bearing struct, `new`'s body would
    // build it via a struct literal `Driver { .. }`, which is itself captured as
    // a constructor call that 349.4 links back to `new` — making `new` reachable
    // from its own body regardless of this fix and masking the entry-point flip.
    // A unit struct is returned as a bare value (`Driver`), so before the fix
    // `new` is a clean false-positive entry point and the test can observe it
    // flip to reachable once the inline-path call resolves.
    pub struct Driver;

    impl Driver {
        pub fn new() -> Self {
            Driver
        }
    }
}

fn run() {
    // Inline full path — `Driver` is not imported; the leading `crate` anchor
    // must be normalized and the `runtime` module walked to bind the type.
    let _d = crate::runtime::Driver::new();
}
