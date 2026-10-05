// Crate root declaring the type a submodule's impl blocks extend - lib.rs
// Tests: the rustc `rustc_ast_lowering` shape, where `LoweringContext` is
// declared in the crate root and `impl LoweringContext` lives in path.rs,
// which reaches the type through `use super::*`

mod path;
mod visit;

pub struct LoweringContext {
    pub depth: usize,
}

pub trait Resolver {
    fn resolve(&self);
}

impl LoweringContext {
    pub fn lower_crate(&mut self) {
        self.lower_path();
        self.lower_generic_args();
    }
}
