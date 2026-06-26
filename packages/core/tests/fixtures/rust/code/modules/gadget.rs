// Separate-file module type - gadget.rs
// The type a sibling file references via an inline full path. Reaching it from
// another file without a `use` is a cross-file module hop (import_resolution's
// concern), so the inline-path constructor walk does not bind it.

pub struct Gadget;

impl Gadget {
    pub fn new() -> Self {
        Gadget
    }
}
