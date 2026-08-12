// Cross-file inline-path constructor (no use) - uses_separate_gadget.rs
// `Gadget` lives in a separate file (gadget.rs) declared only via `mod gadget;`.
// The author's path names that file, so the constructor resolves to the type's
// associated `new` there without any `use` statement.

mod gadget;

fn run() {
    let _g = crate::gadget::Gadget::new();
}
