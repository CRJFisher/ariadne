// Ambiguous inline-path constructors - ambiguous_path_constructor.rs
// Tests: two in-scope modules each expose a `Driver` with its own `new`; the
// path_prefix disambiguates each inline-path constructor to the correct type.
//
// The structs are not `pub`: two same-named file-level exports collide in the
// export registry, and the path walk binds the type through the module's scope
// definitions, not its exports — so privacy is irrelevant to this resolution.

mod alpha {
    struct Driver;

    impl Driver {
        fn new() -> Self {
            Driver
        }
    }
}

mod beta {
    struct Driver;

    impl Driver {
        fn new() -> Self {
            Driver
        }
    }
}

fn run() {
    let _a = crate::alpha::Driver::new();
    let _b = crate::beta::Driver::new();
}
