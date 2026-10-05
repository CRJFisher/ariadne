// The type covering the trait's required methods from an inherent impl block only - collector.rs

pub struct Collector {
    seen: usize,
}

impl Collector {
    fn visit_item(&mut self) {
        self.seen += 1;
    }

    fn visit_expr(&mut self) {}

    fn finish(&mut self) {}
}
