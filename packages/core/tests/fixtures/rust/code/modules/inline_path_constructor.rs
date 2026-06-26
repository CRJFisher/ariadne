// Inline-full-path associated constructor - inline_path_constructor.rs
// Tests: crate::runtime::Driver::new() resolves to the `new` associated
// constructor by walking the inline module path to the type, even though
// `Driver` is never bound by a bare name in the caller's scope.

mod runtime {
    // Unit struct so `new`'s body does not self-reference via a struct literal,
    // keeping `new` a clean false-positive entry point until the call resolves.
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
