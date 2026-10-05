// The caller, dispatching through the trait - walk.rs

use crate::visitor::Visitor;

pub fn walk(v: &mut dyn Visitor) {
    v.visit_item();
}

pub fn walk_bounded<V: Visitor>(v: &mut V) {
    v.visit_item();
}
