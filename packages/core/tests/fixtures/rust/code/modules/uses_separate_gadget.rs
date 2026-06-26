// Cross-file inline-path constructor (no use) - uses_separate_gadget.rs
// Tests the bail boundary: `Gadget` lives in a separate file (gadget.rs) and is
// declared only via `mod gadget;` with no `use`. There is no in-scope module
// body to walk, so the inline-path constructor walk bails rather than fabricate
// a cross-file edge — the call stays unresolved (import_resolution's territory).

mod gadget;

fn run() {
    let _g = crate::gadget::Gadget::new();
}
