// Type-qualified associated function - associated_fn.rs
// Tests: Parker::make(5) resolves to the associated fn `make` in Parker's impl

pub struct Parker {
    id: u32,
}

impl Parker {
    // Associated function (not `new`) — captured as a function call,
    // resolved via the type-qualified member index.
    pub fn make(id: u32) -> Parker {
        Parker { id }
    }

    pub fn id(&self) -> u32 {
        self.id
    }
}

fn build() -> Parker {
    // Type-qualified associated call — name `make`, path_prefix ["Parker"]
    Parker::make(5)
}
