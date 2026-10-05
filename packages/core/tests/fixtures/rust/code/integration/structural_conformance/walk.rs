// The caller, dispatching through the trait - walk.rs

use crate::visitor::Visitor;

pub fn walk(v: &mut dyn Visitor) {
    v.visit_item();
}
