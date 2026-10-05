// An implementer the caller never names - collector.rs

use crate::visitor::Visitor;

pub struct Collector {}

impl Visitor for Collector {
    fn visit_item(&mut self) {}
}
