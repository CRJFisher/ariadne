// The trait - visitor.rs

pub trait Visitor {
    fn visit_item(&mut self);
}
