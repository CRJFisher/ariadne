// Trait edges recorded from impl blocks - lib.rs
// Tests: librustdoc's `impl DocFolder for CacheBuilder` shape — a trait with a
// default body that calls a method the implementer overrides in another file

mod fold;
mod cache;
mod visit;
