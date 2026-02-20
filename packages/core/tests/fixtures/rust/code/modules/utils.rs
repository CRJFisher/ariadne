// Module utilities - utils.rs
// Tests: Rust module function definitions for cross-module resolution

pub fn helper() -> &'static str {
    "from utils"
}

pub fn process_data(input: &str) -> String {
    input.to_uppercase()
}

pub fn calculate_total(prices: &[f64]) -> f64 {
    prices.iter().sum()
}

pub fn validate_email(email: &str) -> bool {
    email.contains('@') && email.contains('.')
}

// Private function (not exported)
fn internal_helper() -> &'static str {
    "internal"
}