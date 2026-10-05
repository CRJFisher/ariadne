// A trait, its implementers and a trait-typed caller, one file each - lib.rs
// Tests: a `dyn` receiver fans out to every `impl Visitor for T`, whichever
// file arrives first

mod visitor;
mod collector;
mod counter;
mod walk;
