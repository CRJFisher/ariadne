// A second implementer - counter.rs

use crate::visitor::Visitor;

pub struct Counter {
    seen: usize,
}

impl Visitor for Counter {
    fn visit_item(&mut self) {
        self.seen += 1;
    }
}
