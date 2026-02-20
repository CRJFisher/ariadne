// Cross-module imports - main.rs
// Tests: Rust use statements, cross-module function calls

mod utils;

use utils::{helper, process_data, calculate_total, validate_email};

fn main() {
    // Cross-module function calls
    let greeting = helper();
    let processed = process_data("hello world");

    // Using imported function with data
    let prices = vec![10.99, 20.50, 5.25];
    let total = calculate_total(&prices);

    // Boolean function call
    let is_valid = validate_email("test@example.com");

    println!("Greeting: {}", greeting);
    println!("Processed: {}", processed);
    println!("Total: {}", total);
    println!("Valid email: {}", is_valid);
}

// Function that uses imported utilities
fn process_user_data() -> (String, f64, bool) {
    let name = process_data("john doe");
    let balance = calculate_total(&[100.0, 50.0, 25.0]);
    let email_valid = validate_email("john@example.com");

    (name, balance, email_valid)
}