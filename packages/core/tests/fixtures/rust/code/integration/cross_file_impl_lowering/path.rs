// The submodule's impl blocks for a crate-root type - path.rs
// Tests: `use super::*` reaching the crate root, several impl blocks in one
// file contributing to one type, and a trait impl beside the inherent ones

use super::*;

impl LoweringContext {
    pub fn lower_path(&mut self) {
        self.depth += 1;
        self.lower_path_segment();
    }

    fn lower_path_segment(&mut self) {
        self.depth += 1;
    }
}

impl LoweringContext {
    pub fn lower_generic_args(&mut self) {
        self.lower_path_segment();
    }
}

impl Resolver for LoweringContext {
    fn resolve(&self) {
        let _ = self.depth;
    }
}
