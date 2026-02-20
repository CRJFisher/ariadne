// Shadowing scenario - shadowing.rs
// Tests: Local function definition shadows imported function

mod utils;

use utils::{helper, process_data};

// Local function with same name as imported function - shadows the import
fn helper() -> &'static str {
    "local helper"
}

fn main() {
    // This call should resolve to LOCAL helper, not imported one
    let result = helper();

    // Use a different imported function to verify imports still work
    let processed = process_data("test data");

    println!("Result: {}", result);
    println!("Processed: {}", processed);
}

// Function that also uses the shadowed function
fn test_shadowing() -> &'static str {
    // This should also resolve to local helper
    helper()
}

// Function that explicitly uses module path to access original
fn use_original_helper() -> &'static str {
    utils::helper()
}