// Worker module - worker.rs
// Tests: module-qualified function call target (worker::create)

pub fn create(id: u32) -> u32 {
    id + 1
}

pub fn spawn() -> u32 {
    create(0)
}
