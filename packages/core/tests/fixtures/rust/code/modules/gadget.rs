// Separate-file module type - gadget.rs
// The type a sibling file references via an inline full path. The path names
// this file through the caller's `mod gadget;`, so the constructor binds here
// with no `use` statement in between.

pub struct Gadget;

impl Gadget {
    pub fn new() -> Self {
        Gadget
    }
}
