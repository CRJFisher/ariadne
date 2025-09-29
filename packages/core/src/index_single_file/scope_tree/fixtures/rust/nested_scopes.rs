/**
 * Complex Rust file with nested scopes for testing
 */

// Module scope - global level
const MODULE_CONSTANT: &str = "test";

// Struct scope
pub struct OuterStruct {
    field: String,
}

impl OuterStruct {
    // Constructor/associated function scope
    pub fn new(param: String) -> Self {
        // Block scope within constructor
        let local_var = if !param.is_empty() {
            param.clone()
        } else {
            "default".to_string()
        };

        Self { field: local_var }
    }

    // Method scope
    pub async fn process_data(&self, items: Vec<String>) -> Result<(), Box<dyn std::error::Error>> {
        // Block scope - for loop
        for item in items {
            // Block scope - if let
            if let Some(processed) = self.process_item(&item) {
                // Block scope - match
                match self.handle_item(processed).await {
                    Ok(_) => println!("Item processed successfully"),
                    Err(e) => {
                        // Block scope within error handling
                        eprintln!("Error processing item: {}", e);

                        // Block scope - nested if
                        if e.to_string().contains("critical") {
                            return Err(e);
                        }
                    }
                }
            }
        }
        Ok(())
    }

    // Private method scope
    fn process_item(&self, item: &str) -> Option<String> {
        // Block scope - match expression
        match item.len() {
            0 => None,
            1..=10 => {
                // Block scope within match arm
                let processed = item.to_uppercase();
                Some(processed)
            },
            _ => {
                // Block scope - closure
                let transform = |s: &str| -> String {
                    // Closure scope
                    s.chars().take(10).collect()
                };
                Some(transform(item))
            }
        }
    }

    // Async method scope
    async fn handle_item(&self, item: String) -> Result<(), std::io::Error> {
        // Async block scope
        let result = async {
            // Block scope within async block
            if item.starts_with("error") {
                Err(std::io::Error::new(std::io::ErrorKind::Other, "Simulated error"))
            } else {
                Ok(())
            }
        }.await;

        result
    }
}

// Function scope at module level
fn module_function(param: i32) -> String {
    // Block scope - match
    match param {
        1 => {
            // Block scope within match arm
            let result = "one".to_string();
            result
        },
        2 => {
            let result = "two".to_string();
            result
        },
        _ => {
            // Block scope - closure
            let formatter = |x: i32| -> String {
                // Closure scope
                format!("number_{}", x)
            };
            formatter(param)
        }
    }
}

// Trait scope
pub trait DataProcessor {
    // Method signature (no scope)
    fn process(&self, data: &str) -> Result<String, String>;

    // Default implementation scope
    fn validate(&self, data: &str) -> bool {
        // Block scope - if let
        if let Ok(_) = data.parse::<i32>() {
            true
        } else {
            false
        }
    }
}

// Implementation scope
impl DataProcessor for OuterStruct {
    // Method scope
    fn process(&self, data: &str) -> Result<String, String> {
        // Block scope - if
        if data.is_empty() {
            return Err("Empty data".to_string());
        }

        // Block scope - loop
        let mut result = String::new();
        for (i, ch) in data.chars().enumerate() {
            // Block scope within loop
            if i > 0 {
                result.push('_');
            }
            result.push(ch);
        }

        Ok(result)
    }
}

// Generic function scope
fn generic_function<T, U>(input: T) -> U
where
    T: std::fmt::Display,
    U: std::str::FromStr,
    U::Err: std::fmt::Debug,
{
    // Block scope - let statement with pattern matching
    let string_repr = format!("{}", input);

    // Block scope - match
    match string_repr.parse::<U>() {
        Ok(value) => value,
        Err(e) => {
            // Block scope - panic with closure
            let error_formatter = || format!("Parse error: {:?}", e);
            panic!("{}", error_formatter());
        }
    }
}

// Enum scope
pub enum ProcessingState {
    Idle,
    Running(String),
    Completed { result: String, duration: u64 },
    Failed(String),
}

impl ProcessingState {
    // Method scope on enum
    pub fn is_active(&self) -> bool {
        // Block scope - match on self
        match self {
            ProcessingState::Idle => false,
            ProcessingState::Running(_) => true,
            ProcessingState::Completed { .. } => false,
            ProcessingState::Failed(_) => false,
        }
    }

    // Method with complex pattern matching
    pub fn get_info(&self) -> String {
        // Block scope - match with guards
        match self {
            ProcessingState::Running(task) if task.len() > 10 => {
                // Block scope with guard
                format!("Long running task: {}", &task[..10])
            },
            ProcessingState::Running(task) => format!("Running: {}", task),
            ProcessingState::Completed { result, duration } => {
                // Block scope - if expression
                let summary = if *duration > 1000 {
                    "Slow completion"
                } else {
                    "Fast completion"
                };
                format!("{}: {} (took {}ms)", summary, result, duration)
            },
            _ => "Other state".to_string(),
        }
    }
}

// Module with nested items
pub mod utils {
    // Nested module scope

    // Struct in nested module
    pub struct Helper {
        data: String,
    }

    impl Helper {
        // Method scope in nested module
        pub fn normalize(input: &str) -> String {
            // Block scope - iterator chain
            input.chars()
                .filter(|c| c.is_alphanumeric())
                .collect::<String>()
                .to_lowercase()
        }

        // Method with closure scope
        pub fn transform<F>(input: &str, transformer: F) -> String
        where
            F: Fn(&str) -> String,
        {
            // Block scope - let with complex expression
            let intermediate = input.split_whitespace()
                .map(|word| transformer(word))
                .collect::<Vec<_>>()
                .join(" ");

            intermediate
        }
    }

    // Nested function scope
    pub fn format_duration(millis: u64) -> String {
        // Block scope - match with ranges
        match millis {
            0..=999 => format!("{}ms", millis),
            1000..=59999 => {
                // Block scope - arithmetic
                let seconds = millis / 1000;
                let remaining_ms = millis % 1000;
                format!("{}.{}s", seconds, remaining_ms / 100)
            },
            _ => {
                // Block scope - complex calculation
                let minutes = millis / 60000;
                let seconds = (millis % 60000) / 1000;
                format!("{}m{}s", minutes, seconds)
            }
        }
    }
}

// Macro definition scope
macro_rules! debug_scope {
    ($expr:expr) => {
        {
            // Block scope within macro
            let result = $expr;
            println!("Debug: {} = {:?}", stringify!($expr), result);
            result
        }
    };
}

// Function using macro
fn test_macro() {
    // Block scope
    let value = debug_scope!(42 + 8);
    println!("Final value: {}", value);
}

// Tests module
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_outer_struct() {
        // Test function scope
        let instance = OuterStruct::new("test".to_string());
        let items = vec!["item1".to_string(), "item2".to_string()];

        // Block scope - match on Result
        match instance.process_data(items).await {
            Ok(_) => println!("Test passed"),
            Err(e) => panic!("Test failed: {}", e),
        }
    }

    #[test]
    fn test_processing_state() {
        // Test function scope
        let state = ProcessingState::Running("test_task".to_string());

        // Block scope - assertion
        assert!(state.is_active());

        // Block scope - let with pattern
        let info = state.get_info();
        assert!(info.contains("Running"));
    }
}