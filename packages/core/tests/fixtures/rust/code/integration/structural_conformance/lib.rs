// A trait, a type whose inherent methods cover it, and a trait-typed caller - lib.rs
// Tests: the same member-coverage test answers a Rust trait no `impl Tr for T`
// names, with no language leaf in `structural_conformance.ts`, and the type
// leaves out the trait method that has a default body

mod visitor;
mod collector;
mod walk;
