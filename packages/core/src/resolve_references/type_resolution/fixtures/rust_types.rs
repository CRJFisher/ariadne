// Test fixture for Rust type resolution with traits and implementations

use std::collections::HashMap;
use std::fmt::{self, Display};

/// Base trait with associated types and methods
pub trait Service {
    type Input;
    type Output;

    fn process(&self, input: Self::Input) -> Self::Output;
    fn status(&self) -> &str;
}

/// Another trait for composition
pub trait Logger {
    fn log(&self, message: &str);

    fn log_error(&self, error: &str) {
        self.log(&format!("ERROR: {}", error));
    }
}

/// Base struct with generic type parameter
pub struct BaseProcessor<T> {
    pub name: String,
    pub value: T,
    internal_state: i32,
}

impl<T> BaseProcessor<T> {
    /// Constructor
    pub fn new(name: String, value: T) -> Self {
        Self {
            name,
            value,
            internal_state: 0,
        }
    }

    /// Method with reference
    pub fn get_name(&self) -> &str {
        &self.name
    }

    /// Method with mutable reference
    pub fn increment_state(&mut self) {
        self.internal_state += 1;
    }

    /// Generic method
    pub fn transform<F, U>(&self, f: F) -> U
    where
        F: FnOnce(&T) -> U,
    {
        f(&self.value)
    }
}

/// Derived struct with multiple generic parameters
pub struct DerivedProcessor<T, U> {
    base: BaseProcessor<T>,
    extra: U,
    cache: HashMap<String, String>,
}

impl<T, U> DerivedProcessor<T, U> {
    pub fn new(name: String, value: T, extra: U) -> Self {
        Self {
            base: BaseProcessor::new(name, value),
            extra,
            cache: HashMap::new(),
        }
    }

    pub fn get_extra(&self) -> &U {
        &self.extra
    }
}

/// Implementation of Service trait for DerivedProcessor
impl<T: Display, U> Service for DerivedProcessor<T, U> {
    type Input = String;
    type Output = Result<String, String>;

    fn process(&self, input: Self::Input) -> Self::Output {
        Ok(format!("{}: {}", self.base.name, input))
    }

    fn status(&self) -> &str {
        "ready"
    }
}

/// Implementation of Logger trait
impl<T, U> Logger for DerivedProcessor<T, U> {
    fn log(&self, message: &str) {
        println!("[{}] {}", self.base.name, message);
    }
}

/// Enum with variants
pub enum ProcessorState {
    Idle,
    Processing { task_id: u64 },
    Complete(String),
    Error { code: i32, message: String },
}

impl ProcessorState {
    pub fn is_active(&self) -> bool {
        matches!(self, ProcessorState::Processing { .. })
    }
}

/// Struct with lifetime parameters
pub struct BorrowedData<'a> {
    data: &'a str,
    owner: &'a BaseProcessor<String>,
}

impl<'a> BorrowedData<'a> {
    pub fn new(data: &'a str, owner: &'a BaseProcessor<String>) -> Self {
        Self { data, owner }
    }

    pub fn get_data(&self) -> &str {
        self.data
    }
}

/// Associated functions (static methods)
impl BaseProcessor<String> {
    /// Associated function (no self)
    pub fn default() -> Self {
        Self::new("default".to_string(), String::new())
    }

    /// Associated constant
    pub const MAX_SIZE: usize = 1024;
}

/// Type alias
pub type StringProcessor = BaseProcessor<String>;
pub type ProcessorResult<T> = Result<T, ProcessorError>;

/// Custom error type
#[derive(Debug)]
pub struct ProcessorError {
    pub code: i32,
    pub message: String,
}

impl Display for ProcessorError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "ProcessorError({}): {}", self.code, self.message)
    }
}

impl std::error::Error for ProcessorError {}

/// Generic function with trait bounds
pub fn process_items<T, P>(items: Vec<T>, processor: &P) -> Vec<String>
where
    P: Service<Input = T, Output = String>,
{
    items.into_iter().map(|item| processor.process(item)).collect()
}

/// Macro for testing (macros create types too)
macro_rules! create_processor {
    ($name:expr) => {
        BaseProcessor::new($name.to_string(), 0)
    };
}