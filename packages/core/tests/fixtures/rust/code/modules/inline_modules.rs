// Inline modules - inline_modules.rs
// Tests: Rust inline module declarations that work with current indexer

mod utils {
    pub fn helper() -> &'static str {
        "from inline utils"
    }

    pub fn process_data(input: &str) -> String {
        input.to_uppercase()
    }
}

use utils::{helper, process_data};

fn main() {
    // Cross-module function calls using inline modules
    let greeting = helper();
    let processed = process_data("hello world");

    println!("Greeting: {}", greeting);
    println!("Processed: {}", processed);
}

fn test_inline_modules() -> (String, String) {
    let result1 = helper().to_string();
    let result2 = process_data("test");
    (result1, result2)
}