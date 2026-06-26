// Inline module-qualified call over a local shadow - inline_qualified.rs
// Tests: worker::create() binds to the inline module fn even though a local
// `fn create` of the same name exists and there is no `use worker::create`.

mod worker {
    pub fn create(id: u32) -> u32 {
        id + 1
    }
}

// Local function shadowing the module function's name.
fn create() -> u32 {
    0
}

fn run() -> u32 {
    // Bare create() resolves to the LOCAL shadow.
    let _local = create();
    // Qualified worker::create() must resolve to the MODULE function.
    worker::create(7)
}
