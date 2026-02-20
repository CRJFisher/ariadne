// Cross-module class usage - uses_user.rs
// Tests: Rust struct imports, associated function calls, method calls across modules

mod user_mod;

use user_mod::{User, UserManager};

fn main() {
    // Associated function call (constructor) and type binding
    let mut user = User::new(
        String::from("Alice Smith"),
        String::from("alice@example.com"),
    );

    // Method calls on imported struct instance
    let user_name = user.get_name();
    let user_email = user.get_email();
    let is_active = user.is_active();

    // Method call with mutation
    user.update_name(String::from("Alice Johnson"));

    // Method chaining
    let _chained_user = user.activate().deactivate();

    // Method call that returns owned value
    let user_info = user.format_info();

    // Using additional struct from module
    let mut manager = UserManager::new();
    manager.add_user(user.clone());
    let user_count = manager.get_user_count();

    println!("Name: {}", user_name);
    println!("Email: {}", user_email);
    println!("Active: {}", is_active);
    println!("Info: {}", user_info);
    println!("User count: {}", user_count);
}

// Function that creates and manipulates users
fn create_test_user() -> User {
    let mut user = User::new(
        String::from("Test User"),
        String::from("test@example.com"),
    );

    // Method calls in function scope
    let _name = user.get_name();
    user.activate();

    user
}