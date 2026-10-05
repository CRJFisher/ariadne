// A trait with two implementers, dispatched through a trait-typed receiver - visit.rs

pub trait Visitor {
    fn visit_item(&mut self);
}

pub struct Collector {}

pub struct Counter {
    seen: usize,
}

impl Visitor for Collector {
    fn visit_item(&mut self) {}
}

impl Visitor for Counter {
    fn visit_item(&mut self) {
        self.seen += 1;
    }
}

pub fn walk_dyn(v: &mut dyn Visitor) {
    v.visit_item();
}

pub fn walk<V: Visitor>(v: &mut V) {
    v.visit_item();
}
