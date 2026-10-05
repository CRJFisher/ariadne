// Impl blocks for a type declared in another file - impls.rs
// Tests: Rust impl blocks recording the implemented type when the file itself
// declares no class, so no per-file member index could name it

mod types;

use types::{Lowering, Visit};

impl Lowering {
    pub fn descend(&mut self) {
        self.depth += 1;
    }
}

impl Visit for Lowering {
    fn visit(&self) {
        self.report();
    }
}

impl Lowering {
    fn report(&self) {
        let _ = self.depth;
    }
}
