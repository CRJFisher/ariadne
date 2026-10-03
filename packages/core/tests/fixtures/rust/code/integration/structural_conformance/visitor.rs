// The trait - visitor.rs

pub trait Visitor {
    fn visit_item(&mut self);
    fn visit_expr(&mut self);
    fn finish(&mut self);

    // A default body: an implementing type may leave it out.
    fn visit_pat(&mut self) {}
}
