// Self-qualified associated constructor - self_constructor.rs
// Tests: Self::new() inside an impl resolves to the enclosing type's `new`,
// so the constructor is reachable rather than a false-positive entry point.

pub struct Widget {
    size: u32,
}

impl Widget {
    // The associated constructor. Reached only via Self::new() below.
    pub fn new(size: u32) -> Self {
        Widget { size }
    }

    // Self-qualified constructor call — name `Self`, path_prefix ["Self"].
    pub fn zeroed() -> Self {
        Self::new(0)
    }
}

fn build() -> Widget {
    Widget::zeroed()
}
