// Basic function definitions
// Tests: function declarations, parameters, return types

fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}

fn add(a: i32, b: i32) -> i32 {
    a + b
}

fn multiply(a: i32, b: i32) -> i32 {
    a * b
}

fn is_even(n: i32) -> bool {
    n % 2 == 0
}

fn call_chain() -> i32 {
    let data = fetch_data();
    transform_data(data)
}

fn fetch_data() -> i32 {
    42
}

fn transform_data(value: i32) -> i32 {
    value * 2
}

pub fn main() {
    let result = add(5, 3);
    println!("Result: {}", result);
}
