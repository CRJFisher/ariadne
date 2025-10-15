// User module - user_mod.rs
// Tests: Rust module with struct and impl block for cross-module class resolution

#[derive(Debug, Clone)]
pub struct User {
    pub name: String,
    pub email: String,
    active: bool,
}

impl User {
    // Associated function - constructor
    pub fn new(name: String, email: String) -> Self {
        User {
            name,
            email,
            active: true,
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

    // Method with &self
    pub fn is_active(&self) -> bool {
        self.active
    }

    // Method with &mut self
    pub fn update_name(&mut self, new_name: String) {
        self.name = new_name;
    }

    // Method with &mut self that returns &mut Self for chaining
    pub fn activate(&mut self) -> &mut Self {
        self.active = true;
        self
    }

    // Method with &mut self that returns &mut Self for chaining
    pub fn deactivate(&mut self) -> &mut Self {
        self.active = false;
        self
    }

    // Method that returns owned String
    pub fn format_info(&self) -> String {
        format!("{} <{}>", self.name, self.email)
    }
}

// Additional struct for testing
pub struct UserManager {
    users: Vec<User>,
}

impl UserManager {
    pub fn new() -> Self {
        UserManager { users: Vec::new() }
    }

    pub fn add_user(&mut self, user: User) {
        self.users.push(user);
    }

    pub fn get_user_count(&self) -> usize {
        self.users.len()
    }
}