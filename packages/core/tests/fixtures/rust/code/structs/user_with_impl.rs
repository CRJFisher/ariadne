// Struct with impl block - user_with_impl.rs
// Tests: Rust struct definitions, impl blocks, methods, associated functions

pub struct User {
    pub name: String,
    pub email: String,
    pub active: bool,
}

impl User {
    // Associated function (constructor pattern)
    pub fn new(name: String, email: String) -> Self {
        User {
            name,
            email,
            active: true,
        }
    }

    // Associated function (default constructor)
    pub fn default() -> Self {
        User {
            name: String::from("Default User"),
            email: String::from("default@example.com"),
            active: false,
        }
    }

    // Method with &self
    pub fn get_name(&self) -> &str {
        &self.name
    }

    // Method with &self
    pub fn get_email(&self) -> &str {
        &self.email
    }

    // Method with &mut self
    pub fn update_name(&mut self, new_name: String) {
        self.name = new_name;
    }

    // Method with &mut self that returns self for chaining
    pub fn activate(&mut self) -> &mut Self {
        self.active = true;
        self
    }

    // Method with &mut self that returns self for chaining
    pub fn deactivate(&mut self) -> &mut Self {
        self.active = false;
        self
    }

    // Method that returns owned value
    pub fn get_info(&self) -> String {
        format!("User: {} ({})", self.name, self.email)
    }
}