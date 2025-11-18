/// Trait with multiple implementations
/// Tests: polymorphic method resolution, trait method calls resolve to all implementations

pub trait Handler {
    fn process(&self);
    fn get_name(&self) -> &str;
}

pub struct HandlerA {
    name: String,
}

impl HandlerA {
    pub fn new() -> Self {
        HandlerA {
            name: String::from("Handler A"),
        }
    }
}

impl Handler for HandlerA {
    fn process(&self) {
        println!("Handler A processing");
    }

    fn get_name(&self) -> &str {
        &self.name
    }
}

pub struct HandlerB {
    name: String,
}

impl HandlerB {
    pub fn new() -> Self {
        HandlerB {
            name: String::from("Handler B"),
        }
    }
}

impl Handler for HandlerB {
    fn process(&self) {
        println!("Handler B processing");
    }

    fn get_name(&self) -> &str {
        &self.name
    }
}

pub struct HandlerC {
    name: String,
}

impl HandlerC {
    pub fn new() -> Self {
        HandlerC {
            name: String::from("Handler C"),
        }
    }
}

impl Handler for HandlerC {
    fn process(&self) {
        println!("Handler C processing");
    }

    fn get_name(&self) -> &str {
        &self.name
    }
}

/// Polymorphic function that calls trait methods
/// These calls should resolve to ALL three implementations
pub fn execute_handler(handler: &dyn Handler) {
    handler.process();
    let name = handler.get_name();
    println!("Executed: {}", name);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_polymorphic_handlers() {
        let a = HandlerA::new();
        let b = HandlerB::new();
        let c = HandlerC::new();

        execute_handler(&a);
        execute_handler(&b);
        execute_handler(&c);
    }
}
