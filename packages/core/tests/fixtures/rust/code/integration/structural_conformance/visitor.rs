// The trait - visitor.rs

pub trait Visitor {
    fn visit_item(&mut self);
    fn visit_expr(&mut self);
    fn finish(&mut self);
}
