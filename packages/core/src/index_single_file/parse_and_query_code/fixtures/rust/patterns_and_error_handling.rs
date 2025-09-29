// Advanced pattern matching and error handling

use std::collections::HashMap;
use std::error::Error;
use std::fmt;

// Custom error types
#[derive(Debug)]
pub enum CustomError {
    IoError(std::io::Error),
    ParseError(String),
    NetworkError { code: u16, message: String },
    ValidationError(Vec<String>),
}

impl fmt::Display for CustomError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            CustomError::IoError(err) => write!(f, "IO error: {}", err),
            CustomError::ParseError(msg) => write!(f, "Parse error: {}", msg),
            CustomError::NetworkError { code, message } => {
                write!(f, "Network error {}: {}", code, message)
            }
            CustomError::ValidationError(errors) => {
                write!(f, "Validation errors: {}", errors.join(", "))
            }
        }
    }
}

impl Error for CustomError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            CustomError::IoError(err) => Some(err),
            _ => None,
        }
    }
}

// From implementations for error conversion
impl From<std::io::Error> for CustomError {
    fn from(err: std::io::Error) -> Self {
        CustomError::IoError(err)
    }
}

impl From<std::num::ParseIntError> for CustomError {
    fn from(err: std::num::ParseIntError) -> Self {
        CustomError::ParseError(err.to_string())
    }
}

// Result type alias
pub type Result<T> = std::result::Result<T, CustomError>;

// Complex enums for pattern matching
#[derive(Debug, Clone)]
pub enum JsonValue {
    Null,
    Bool(bool),
    Number(f64),
    String(String),
    Array(Vec<JsonValue>),
    Object(HashMap<String, JsonValue>),
}

// Nested pattern matching
pub fn analyze_json(value: &JsonValue) -> String {
    match value {
        JsonValue::Null => "null value".to_string(),
        JsonValue::Bool(true) => "boolean true".to_string(),
        JsonValue::Bool(false) => "boolean false".to_string(),
        JsonValue::Number(n) if *n > 0.0 => format!("positive number: {}", n),
        JsonValue::Number(n) if *n < 0.0 => format!("negative number: {}", n),
        JsonValue::Number(n) => format!("zero or special number: {}", n),
        JsonValue::String(s) if s.is_empty() => "empty string".to_string(),
        JsonValue::String(s) if s.len() > 100 => "long string".to_string(),
        JsonValue::String(s) => format!("string: {}", s),
        JsonValue::Array(arr) if arr.is_empty() => "empty array".to_string(),
        JsonValue::Array(arr) if arr.len() == 1 => "single-item array".to_string(),
        JsonValue::Array(arr) => format!("array with {} items", arr.len()),
        JsonValue::Object(obj) if obj.is_empty() => "empty object".to_string(),
        JsonValue::Object(obj) => format!("object with {} keys", obj.len()),
    }
}

// Pattern matching with destructuring
pub fn process_coordinates(coords: &[(i32, i32)]) -> Vec<String> {
    coords
        .iter()
        .map(|coord| match coord {
            (0, 0) => "origin".to_string(),
            (x, 0) => format!("on x-axis at {}", x),
            (0, y) => format!("on y-axis at {}", y),
            (x, y) if x == y => format!("diagonal at ({}, {})", x, y),
            (x, y) if x.abs() == y.abs() => format!("anti-diagonal at ({}, {})", x, y),
            (x, y) => format!("point at ({}, {})", x, y),
        })
        .collect()
}

// Complex struct patterns
#[derive(Debug)]
pub struct Person {
    name: String,
    age: u32,
    email: Option<String>,
    address: Address,
}

#[derive(Debug)]
pub struct Address {
    street: String,
    city: String,
    country: String,
}

pub fn analyze_person(person: &Person) -> String {
    match person {
        Person {
            name,
            age: 0..=17,
            email: None,
            address: Address { country, .. },
        } => format!("Minor {} from {} with no email", name, country),

        Person {
            name,
            age: 18..=64,
            email: Some(email),
            address: Address { city, country, .. },
        } => format!("Adult {} from {}, {} ({})", name, city, country, email),

        Person {
            name,
            age: 65..,
            address: Address { country, .. },
            ..
        } => format!("Senior {} from {}", name, country),

        _ => "Unknown person category".to_string(),
    }
}

// Range patterns and guards
pub fn categorize_number(n: i32) -> &'static str {
    match n {
        i32::MIN..=-1000 => "very negative",
        -999..=-100 => "negative",
        -99..=-1 => "small negative",
        0 => "zero",
        1..=99 => "small positive",
        100..=999 => "positive",
        1000..=i32::MAX => "very positive",
    }
}

// Or patterns and binding
pub fn process_option_result(input: Option<Result<i32>>) -> String {
    match input {
        Some(Ok(n)) if n > 0 => format!("positive result: {}", n),
        Some(Ok(n)) if n < 0 => format!("negative result: {}", n),
        Some(Ok(0)) => "zero result".to_string(),
        Some(Err(CustomError::ParseError(msg))) => format!("parse error: {}", msg),
        Some(Err(CustomError::NetworkError { code, .. })) => {
            format!("network error: {}", code)
        }
        Some(Err(_)) => "other error".to_string(),
        None => "no value".to_string(),
    }
}

// Match guards with complex conditions
pub fn advanced_match_guards(value: &JsonValue, context: &str) -> bool {
    match (value, context) {
        (JsonValue::String(s), "url") if s.starts_with("https://") => true,
        (JsonValue::String(s), "email") if s.contains('@') && s.contains('.') => true,
        (JsonValue::Number(n), "percentage") if *n >= 0.0 && *n <= 100.0 => true,
        (JsonValue::Array(arr), "non_empty") if !arr.is_empty() => true,
        (JsonValue::Object(obj), "has_id") if obj.contains_key("id") => true,
        _ => false,
    }
}

// If-let and while-let patterns
pub fn process_optional_values(values: Vec<Option<i32>>) -> Vec<i32> {
    let mut results = Vec::new();

    for value in values {
        if let Some(n) = value {
            if let Ok(doubled) = n.checked_mul(2) {
                results.push(doubled);
            }
        }
    }

    results
}

pub fn drain_until_none(values: &mut Vec<Option<String>>) -> Vec<String> {
    let mut results = Vec::new();

    while let Some(Some(value)) = values.pop() {
        results.push(value);
    }

    results
}

// Chaining with ? operator
pub fn parse_and_process(input: &str) -> Result<String> {
    let number: i32 = input.trim().parse()?;
    let doubled = number.checked_mul(2)
        .ok_or_else(|| CustomError::ParseError("overflow".to_string()))?;
    Ok(format!("Result: {}", doubled))
}

// Custom try_from implementation
impl TryFrom<JsonValue> for String {
    type Error = CustomError;

    fn try_from(value: JsonValue) -> Result<String> {
        match value {
            JsonValue::String(s) => Ok(s),
            JsonValue::Number(n) => Ok(n.to_string()),
            JsonValue::Bool(b) => Ok(b.to_string()),
            JsonValue::Null => Ok("null".to_string()),
            _ => Err(CustomError::ParseError(
                "Cannot convert complex types to string".to_string(),
            )),
        }
    }
}

// Error propagation with different error types
pub fn complex_operation(input: &str) -> Result<JsonValue> {
    let trimmed = input.trim();

    if trimmed.is_empty() {
        return Err(CustomError::ValidationError(vec![
            "Input cannot be empty".to_string(),
        ]));
    }

    // Try parsing as number
    if let Ok(num) = trimmed.parse::<f64>() {
        return Ok(JsonValue::Number(num));
    }

    // Try parsing as boolean
    match trimmed.to_lowercase().as_str() {
        "true" => return Ok(JsonValue::Bool(true)),
        "false" => return Ok(JsonValue::Bool(false)),
        "null" => return Ok(JsonValue::Null),
        _ => {}
    }

    // Default to string
    Ok(JsonValue::String(trimmed.to_string()))
}

// Nested error handling
pub fn nested_error_handling() -> Result<Vec<JsonValue>> {
    let inputs = ["42", "true", "null", "hello", ""];
    let mut results = Vec::new();

    for input in inputs {
        match complex_operation(input) {
            Ok(value) => results.push(value),
            Err(CustomError::ValidationError(_)) => {
                // Skip empty inputs
                continue;
            }
            Err(e) => return Err(e),
        }
    }

    if results.is_empty() {
        Err(CustomError::ValidationError(vec![
            "No valid inputs found".to_string(),
        ]))
    } else {
        Ok(results)
    }
}

// Pattern matching in function parameters
pub fn destructure_in_params((x, y): (i32, i32), Person { name, age, .. }: Person) -> String {
    format!("Point ({}, {}) and person {} aged {}", x, y, name, age)
}

// Match expressions in various contexts
pub fn match_in_expressions() -> Vec<String> {
    let values = vec![
        JsonValue::Number(42.0),
        JsonValue::String("hello".to_string()),
        JsonValue::Bool(true),
    ];

    values
        .into_iter()
        .map(|v| match v {
            JsonValue::Number(n) => format!("num:{}", n),
            JsonValue::String(s) => format!("str:{}", s),
            JsonValue::Bool(b) => format!("bool:{}", b),
            _ => "other".to_string(),
        })
        .collect()
}