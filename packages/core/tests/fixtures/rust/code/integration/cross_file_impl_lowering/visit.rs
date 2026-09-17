// A third file calling a method a cross-file impl block declares - visit.rs
// Tests: a caller that declares neither the type nor the impl reaching the
// method through the type's member index

use super::LoweringContext;

pub fn run(ctx: &mut LoweringContext) {
    ctx.lower_path();
    ctx.resolve();
}
