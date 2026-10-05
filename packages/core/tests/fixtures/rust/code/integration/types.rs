// Type declarations for the cross-file impl pair - types.rs
// Tests: Rust struct and trait bodies recording their own self type

pub struct Lowering {
    depth: usize,
}

pub trait Visit {
    fn visit(&self);
}
