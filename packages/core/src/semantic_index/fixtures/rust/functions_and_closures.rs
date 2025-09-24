// Functions and closures

use std::thread;
use std::sync::Arc;

// Simple function
pub fn add(a: i32, b: i32) -> i32 {
    a + b
}

// Function with references
pub fn first_word(s: &str) -> &str {
    let bytes = s.as_bytes();

    for (i, &item) in bytes.iter().enumerate() {
        if item == b' ' {
            return &s[0..i];
        }
    }

    &s[..]
}

// Function with mutable references
pub fn push_string(s: &mut String, suffix: &str) {
    s.push_str(suffix);
}

// Function with lifetimes
pub fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() > y.len() {
        x
    } else {
        y
    }
}

// Function with multiple lifetimes
pub fn split_at_comma<'a, 'b>(input: &'a str, sep: &'b str) -> (&'a str, &'a str) {
    if let Some(index) = input.find(sep) {
        (&input[..index], &input[index + sep.len()..])
    } else {
        (input, "")
    }
}

// Generic function
pub fn swap<T>(a: &mut T, b: &mut T) {
    std::mem::swap(a, b);
}

// Async function
pub async fn fetch_data(url: &str) -> Result<String, reqwest::Error> {
    let response = reqwest::get(url).await?;
    response.text().await
}

// Const function
pub const fn max(a: i32, b: i32) -> i32 {
    if a > b {
        a
    } else {
        b
    }
}

// Unsafe function
pub unsafe fn dangerous() {
    // Unsafe operations here
}

// Function with patterns
pub fn print_coordinates(&(x, y): &(i32, i32)) {
    println!("Current location: ({}, {})", x, y);
}

// Closures
pub fn closures_example() {
    // Simple closure
    let add_one = |x| x + 1;

    // Closure with type annotations
    let add_two = |x: i32| -> i32 { x + 2 };

    // Closure capturing environment
    let num = 5;
    let plus_num = |x| x + num;

    // Move closure
    let nums = vec![1, 2, 3];
    let move_closure = move || {
        println!("nums: {:?}", nums);
    };

    // Mutable closure
    let mut count = 0;
    let mut inc_count = || {
        count += 1;
        count
    };
}

// Higher-order functions
pub fn apply_twice<F>(f: F, arg: i32) -> i32
where
    F: Fn(i32) -> i32,
{
    f(f(arg))
}

// Function returning closure
pub fn make_adder(x: i32) -> impl Fn(i32) -> i32 {
    move |y| x + y
}

// Function accepting closure
pub fn do_twice<F>(mut f: F)
where
    F: FnMut(),
{
    f();
    f();
}

// Diverging function
pub fn panic_function() -> ! {
    panic!("This function never returns");
}

// Recursive function
pub fn factorial(n: u32) -> u32 {
    match n {
        0 => 1,
        _ => n * factorial(n - 1),
    }
}

// Method-like function using self types
pub struct Calculator;

impl Calculator {
    pub fn add(&self, a: i32, b: i32) -> i32 {
        a + b
    }

    pub fn multiply(self, a: i32, b: i32) -> i32 {
        a * b
    }

    pub fn divide(&mut self, a: i32, b: i32) -> Option<i32> {
        if b != 0 {
            Some(a / b)
        } else {
            None
        }
    }
}

// Function with impl Trait in argument position
pub fn notify(item: &impl std::fmt::Display) {
    println!("Breaking news! {}", item);
}

// Function with impl Trait in return position
pub fn returns_closure() -> impl Fn(i32) -> i32 {
    |x| x + 1
}

// Variadic function using slice
pub fn sum_all(numbers: &[i32]) -> i32 {
    numbers.iter().sum()
}

// Function with default type parameters
pub fn parse_or_default<T: std::str::FromStr + Default>(s: &str) -> T {
    s.parse().unwrap_or_default()
}

// ============================================================================
// NEW ADVANCED FUNCTION AND CLOSURE FEATURES
// ============================================================================

// Function pointer types - explicit fn() type annotations
pub fn call_function(func: fn(i32, i32) -> i32, a: i32, b: i32) -> i32 {
    func(a, b)
}

// Function that returns a function pointer
pub fn get_operation(add: bool) -> fn(i32, i32) -> i32 {
    if add {
        add_numbers
    } else {
        multiply_numbers
    }
}

fn add_numbers(a: i32, b: i32) -> i32 { a + b }
fn multiply_numbers(a: i32, b: i32) -> i32 { a * b }

// More const function examples
pub const fn factorial_const(n: u32) -> u32 {
    match n {
        0 => 1,
        _ => n * factorial_const(n - 1),
    }
}

pub const fn is_power_of_two(n: u32) -> bool {
    n != 0 && (n & (n - 1)) == 0
}

// Complex closure examples with move and typed parameters
pub fn advanced_closures() {
    // Move closure with typed parameters
    let data = vec![1, 2, 3, 4, 5];
    let move_closure_typed = move |multiplier: i32| -> Vec<i32> {
        data.iter().map(|x| x * multiplier).collect()
    };

    // Async closure (when supported)
    let async_operation = || async {
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        42
    };

    // Closure with complex captures
    let mut counter = 0;
    let increment_and_return = |by: i32| {
        counter += by;
        counter
    };
}

// Function trait objects - Fn, FnMut, FnOnce examples
pub fn use_fn_trait<F>(func: F) -> i32
where
    F: Fn(i32) -> i32,
{
    func(42)
}

pub fn use_fn_mut_trait<F>(mut func: F) -> i32
where
    F: FnMut(i32) -> i32,
{
    func(42)
}

pub fn use_fn_once_trait<F>(func: F) -> i32
where
    F: FnOnce(i32) -> i32,
{
    func(42)
}

// Higher-order function call examples
pub fn higher_order_examples() {
    let numbers = vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    // Map operations
    let doubled: Vec<i32> = numbers.iter().map(|x| x * 2).collect();
    let stringified: Vec<String> = numbers.iter().map(|x| x.to_string()).collect();

    // Filter operations
    let evens: Vec<i32> = numbers.iter().filter(|&&x| x % 2 == 0).cloned().collect();
    let greater_than_five: Vec<i32> = numbers.iter().filter(|&&x| x > 5).cloned().collect();

    // Fold operations
    let sum = numbers.iter().fold(0, |acc, x| acc + x);
    let product = numbers.iter().fold(1, |acc, x| acc * x);

    // Other iterator methods
    let first_even = numbers.iter().find(|&&x| x % 2 == 0);
    let has_large = numbers.iter().any(|&x| x > 8);
    let all_positive = numbers.iter().all(|&x| x > 0);

    // Chained operations
    let result: Vec<i32> = numbers
        .iter()
        .filter(|&&x| x % 2 == 0)
        .map(|x| x * 3)
        .take(3)
        .collect();

    // FlatMap and filter_map
    let nested = vec![vec![1, 2], vec![3, 4], vec![5, 6]];
    let flattened: Vec<i32> = nested.iter().flat_map(|v| v.iter()).cloned().collect();

    let strings = vec!["1", "not_a_number", "3", "4"];
    let parsed: Vec<i32> = strings.iter().filter_map(|s| s.parse().ok()).collect();

    // Skip and take operations
    let middle: Vec<i32> = numbers.iter().skip(3).take(4).cloned().collect();
    let while_small: Vec<i32> = numbers.iter().take_while(|&&x| x < 6).cloned().collect();
    let after_large: Vec<i32> = numbers.iter().skip_while(|&&x| x < 6).cloned().collect();

    // For_each operation
    numbers.iter().for_each(|x| println!("Number: {}", x));
}

// Complex impl Trait scenarios
pub fn complex_impl_trait_parameter(processor: impl Fn(&str) -> String + Clone) -> String {
    let cloned = processor.clone();
    processor("Hello") + &cloned(" World")
}

pub fn multiple_impl_trait_params<T, U>(
    transformer: impl Fn(T) -> U,
    validator: impl Fn(&U) -> bool,
    input: T
) -> Option<U>
where
    T: Clone,
    U: Clone,
{
    let result = transformer(input);
    if validator(&result) {
        Some(result)
    } else {
        None
    }
}

// Function returning complex impl Trait
pub fn create_processor() -> impl Fn(i32) -> String + Clone {
    |x| format!("Processed: {}", x * 2)
}

pub fn create_validator() -> impl Fn(&str) -> bool {
    |s| s.len() > 5
}

// Async functions with impl Trait
pub async fn async_impl_trait_param(fetcher: impl Fn(&str) -> std::pin::Pin<Box<dyn std::future::Future<Output = String> + Send>>) -> String {
    fetcher("https://example.com").await
}

pub async fn async_returns_impl() -> impl std::future::Future<Output = i32> {
    async { 42 }
}

// Function with function pointer in complex scenarios
pub fn sort_with_comparator<T>(mut data: Vec<T>, cmp: fn(&T, &T) -> std::cmp::Ordering) -> Vec<T> {
    data.sort_by(cmp);
    data
}

pub fn create_callback_registry() -> Vec<fn() -> String> {
    vec![
        || "First callback".to_string(),
        || "Second callback".to_string(),
        || "Third callback".to_string(),
    ]
}

// Unsafe const function
pub const unsafe fn unsafe_const_operation(ptr: *const i32) -> i32 {
    *ptr
}

// Generic const function
pub const fn generic_const_max<T: ~const PartialOrd>(a: T, b: T) -> T {
    if a > b { a } else { b }
}