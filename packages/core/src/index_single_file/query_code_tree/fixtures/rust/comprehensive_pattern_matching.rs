// Comprehensive pattern matching examples for testing
// This file demonstrates all pattern matching constructs supported by the semantic index

use std::collections::HashMap;

// Basic enum for pattern matching
#[derive(Debug, Clone)]
pub enum Message {
    Quit,
    Move { x: i32, y: i32 },
    Write(String),
    ChangeColor(Color),
}

// Color enum with tuple variants
#[derive(Debug, Clone)]
pub enum Color {
    Rgb(u8, u8, u8),
    Hsv(u8, u8, u8),
}

// Point struct for destructuring
#[derive(Debug, Clone)]
pub struct Point {
    pub x: i32,
    pub y: i32,
}

// Person struct with optional fields
#[derive(Debug)]
pub struct Person {
    pub name: String,
    pub age: Option<u32>,
    pub address: Option<String>,
}

// 1. BASIC MATCH EXPRESSIONS
pub fn basic_match_example(value: i32) -> &'static str {
    match value {
        1 => "one",
        2 => "two",
        3 => "three",
        _ => "other",
    }
}

// 2. MATCH WITH RANGE PATTERNS
pub fn match_with_ranges(value: i32) -> &'static str {
    match value {
        1..=10 => "small",
        11..=50 => "medium",
        51..=100 => "large",
        _ => "out of range",
    }
}

// 3. MATCH WITH OR PATTERNS
pub fn match_with_or_patterns(value: char) -> &'static str {
    match value {
        'a' | 'e' | 'i' | 'o' | 'u' => "vowel",
        'A' | 'E' | 'I' | 'O' | 'U' => "uppercase vowel",
        _ => "consonant",
    }
}

// 4. MATCH WITH GUARDS
pub fn match_with_guards(x: Option<i32>) -> String {
    match x {
        Some(n) if n > 0 => format!("positive: {}", n),
        Some(n) if n < 0 => format!("negative: {}", n),
        Some(n) => format!("zero: {}", n),
        None => "no value".to_string(),
    }
}

// 5. ENUM PATTERN MATCHING
pub fn handle_message(msg: Message) -> String {
    match msg {
        Message::Quit => "Quitting".to_string(),
        Message::Move { x, y } => format!("Moving to ({}, {})", x, y),
        Message::Write(text) => format!("Writing: {}", text),
        Message::ChangeColor(Color::Rgb(r, g, b)) => {
            format!("Changing to RGB({}, {}, {})", r, g, b)
        }
        Message::ChangeColor(Color::Hsv(h, s, v)) => {
            format!("Changing to HSV({}, {}, {})", h, s, v)
        }
    }
}

// 6. STRUCT PATTERN DESTRUCTURING
pub fn analyze_point(point: Point) -> String {
    match point {
        Point { x: 0, y: 0 } => "Origin".to_string(),
        Point { x: 0, y } => format!("On Y-axis at {}", y),
        Point { x, y: 0 } => format!("On X-axis at {}", x),
        Point { x, y } => format!("Point at ({}, {})", x, y),
    }
}

// 7. TUPLE PATTERN DESTRUCTURING
pub fn process_tuple(data: (i32, String, bool)) -> String {
    match data {
        (0, _, _) => "First element is zero".to_string(),
        (_, ref text, true) if text.len() > 5 => format!("Long text: {}", text),
        (num, text, flag) => format!("Data: {}, {}, {}", num, text, flag),
    }
}

// 8. SLICE PATTERN MATCHING
pub fn analyze_slice(data: &[i32]) -> String {
    match data {
        [] => "Empty slice".to_string(),
        [x] => format!("Single element: {}", x),
        [x, y] => format!("Two elements: {}, {}", x, y),
        [first, .., last] => format!("First: {}, Last: {}", first, last),
        [first, rest @ ..] if rest.len() > 2 => {
            format!("First: {}, Rest has {} elements", first, rest.len())
        }
        _ => "Complex slice".to_string(),
    }
}

// 9. REF AND MUT PATTERNS
pub fn ref_and_mut_patterns(data: &mut Option<String>) {
    match data {
        Some(ref mut text) => {
            text.push_str(" (modified)");
            println!("Modified text: {}", text);
        }
        None => println!("No text to modify"),
    }
}

// 10. @ BINDINGS (CAPTURED PATTERNS)
pub fn captured_patterns(msg: Message) -> String {
    match msg {
        Message::ChangeColor(color @ Color::Rgb(r, g, b)) if r > 200 => {
            format!("Bright color: {:?}", color)
        }
        Message::Move { x: coord @ 10..=20, y } => {
            format!("X coordinate {} in range, Y: {}", coord, y)
        }
        other => format!("Other message: {:?}", other),
    }
}

// 11. IF-LET EXPRESSIONS
pub fn if_let_examples() {
    let some_value = Some(42);
    let some_text = Some("hello".to_string());
    let some_point = Some(Point { x: 10, y: 20 });

    // Basic if-let
    if let Some(value) = some_value {
        println!("Got value: {}", value);
    }

    // If-let with else
    if let Some(text) = some_text {
        println!("Got text: {}", text);
    } else {
        println!("No text");
    }

    // If-let with destructuring
    if let Some(Point { x, y }) = some_point {
        println!("Point coordinates: ({}, {})", x, y);
    }

    // If-let with guard-like condition
    let number = Some(-5);
    if let Some(n) = number {
        if n > 0 {
            println!("Positive number: {}", n);
        } else {
            println!("Non-positive number: {}", n);
        }
    }
}

// 12. WHILE-LET EXPRESSIONS
pub fn while_let_examples() {
    let mut stack = vec![1, 2, 3, 4, 5];
    let mut iterator = vec!["a", "b", "c"].into_iter();

    // Basic while-let with stack
    while let Some(value) = stack.pop() {
        println!("Popped: {}", value);
    }

    // While-let with iterator
    while let Some(item) = iterator.next() {
        println!("Iterator item: {}", item);
        if item == "b" {
            break;
        }
    }

    // While-let with complex pattern
    let mut pairs = vec![Some((1, 2)), Some((3, 4)), None, Some((5, 6))];
    while let Some(Some((x, y))) = pairs.pop() {
        println!("Pair: ({}, {})", x, y);
    }
}

// 13. NESTED PATTERN MATCHING
pub fn nested_patterns(data: Vec<Option<Result<i32, String>>>) {
    for item in data {
        match item {
            Some(Ok(value)) if value > 0 => {
                println!("Positive success: {}", value);
            }
            Some(Ok(value)) => {
                println!("Non-positive success: {}", value);
            }
            Some(Err(ref error)) => {
                println!("Error: {}", error);
            }
            None => {
                println!("No value");
            }
        }
    }
}

// 14. FUNCTION PARAMETER PATTERNS
pub fn parameter_destructuring(Point { x, y }: Point) -> i32 {
    x + y
}

pub fn tuple_parameter_destructuring((a, b, c): (i32, i32, i32)) -> i32 {
    a + b + c
}

// 15. LET PATTERN DESTRUCTURING
pub fn let_pattern_examples() {
    // Tuple destructuring
    let (x, y, z) = (1, 2, 3);
    println!("Tuple: {}, {}, {}", x, y, z);

    // Struct destructuring
    let Point { x: px, y: py } = Point { x: 10, y: 20 };
    println!("Point: ({}, {})", px, py);

    // Array/slice destructuring
    let [first, second, third] = [1, 2, 3];
    println!("Array: {}, {}, {}", first, second, third);

    // Ref patterns in let
    let data = Some("hello");
    let Some(ref text) = data else {
        return;
    };
    println!("Text: {}", text);
}

// 16. MATCH IN CLOSURES AND HIGHER-ORDER FUNCTIONS
pub fn functional_patterns() {
    let data = vec![
        Some(1), None, Some(2), None, Some(3)
    ];

    // Filter map with pattern matching
    let values: Vec<i32> = data.iter()
        .filter_map(|item| match item {
            Some(val) if *val > 1 => Some(*val * 2),
            Some(val) => Some(*val),
            None => None,
        })
        .collect();

    println!("Processed values: {:?}", values);

    // Map with destructuring
    let points = vec![Point { x: 1, y: 2 }, Point { x: 3, y: 4 }];
    let distances: Vec<f64> = points.iter()
        .map(|Point { x, y }| ((*x as f64).powi(2) + (*y as f64).powi(2)).sqrt())
        .collect();

    println!("Distances: {:?}", distances);
}

// 17. ERROR HANDLING WITH PATTERN MATCHING
pub fn error_handling_patterns(result: Result<Person, String>) -> Option<u32> {
    match result {
        Ok(Person { age: Some(age), .. }) if age >= 18 => Some(age),
        Ok(Person { age: Some(age), .. }) => {
            println!("Person is underage: {}", age);
            None
        }
        Ok(Person { age: None, name, .. }) => {
            println!("Unknown age for person: {}", name);
            None
        }
        Err(error) => {
            println!("Error getting person: {}", error);
            None
        }
    }
}

// 18. COMPLEX NESTED DESTRUCTURING
pub fn complex_nested_example() {
    let data = HashMap::from([
        ("users", vec![
            Some(Person {
                name: "Alice".to_string(),
                age: Some(30),
                address: Some("123 Main St".to_string())
            }),
            Some(Person {
                name: "Bob".to_string(),
                age: None,
                address: None
            }),
            None,
        ]),
    ]);

    if let Some(users) = data.get("users") {
        for user in users {
            match user {
                Some(Person { name, age: Some(user_age), address: Some(addr) }) => {
                    println!("Complete user: {} (age {}) at {}", name, user_age, addr);
                }
                Some(Person { name, age: Some(user_age), address: None }) => {
                    println!("User with age: {} (age {})", name, user_age);
                }
                Some(Person { name, age: None, .. }) => {
                    println!("User without age: {}", name);
                }
                None => {
                    println!("Empty user slot");
                }
            }
        }
    }
}

// 19. PATTERN MATCHING WITH LIFETIMES
pub fn lifetime_patterns<'a>(data: &'a [Option<&'a str>]) -> Vec<&'a str> {
    let mut result = Vec::new();

    for item in data {
        match item {
            Some(text) if text.len() > 3 => {
                result.push(*text);
            }
            Some(_) => {
                // Short text, skip
            }
            None => {
                // No text, skip
            }
        }
    }

    result
}

// 20. EXHAUSTIVE PATTERN COVERAGE EXAMPLE
#[derive(Debug)]
pub enum CompleteEnum {
    UnitVariant,
    TupleVariant(i32, String),
    StructVariant { field1: bool, field2: f64 },
}

pub fn exhaustive_match(value: CompleteEnum) -> String {
    match value {
        CompleteEnum::UnitVariant => "Unit".to_string(),
        CompleteEnum::TupleVariant(num, ref text) => {
            format!("Tuple({}, {})", num, text)
        }
        CompleteEnum::StructVariant { field1: true, field2 } => {
            format!("Struct with true field1: {}", field2)
        }
        CompleteEnum::StructVariant { field1: false, field2 } => {
            format!("Struct with false field1: {}", field2)
        }
    }
}

// Test function that exercises all patterns
pub fn test_all_patterns() {
    println!("=== Pattern Matching Test Suite ===");

    // Test basic patterns
    println!("Basic match: {}", basic_match_example(2));
    println!("Range match: {}", match_with_ranges(25));
    println!("Or patterns: {}", match_with_or_patterns('e'));
    println!("Guards: {}", match_with_guards(Some(-5)));

    // Test enum patterns
    let msg = Message::Move { x: 10, y: 20 };
    println!("Message: {}", handle_message(msg));

    // Test struct patterns
    let point = Point { x: 0, y: 5 };
    println!("Point: {}", analyze_point(point));

    // Test tuple patterns
    let tuple_data = (42, "hello".to_string(), true);
    println!("Tuple: {}", process_tuple(tuple_data));

    // Test slice patterns
    let slice_data = &[1, 2, 3, 4, 5];
    println!("Slice: {}", analyze_slice(slice_data));

    // Test if-let and while-let
    if_let_examples();
    while_let_examples();

    // Test parameter destructuring
    let test_point = Point { x: 3, y: 4 };
    println!("Parameter destructuring: {}", parameter_destructuring(test_point));

    // Test let patterns
    let_pattern_examples();

    // Test functional patterns
    functional_patterns();

    // Test complex patterns
    complex_nested_example();

    println!("=== Pattern Matching Test Complete ===");
}