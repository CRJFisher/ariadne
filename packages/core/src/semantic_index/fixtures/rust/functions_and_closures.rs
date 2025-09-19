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