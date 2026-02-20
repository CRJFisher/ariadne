/*!
 * Comprehensive Rust definitions test fixture
 * Tests all symbol definition types and Rust-specific behaviors
 */

// Module-level constants and static items
const MODULE_CONSTANT: &str = "constant";
static STATIC_VARIABLE: i32 = 42;
static mut MUTABLE_STATIC: i32 = 0;

// Basic functions
fn simple_function() -> String {
    "hello".to_string()
}

fn function_with_params(param1: &str, param2: i32) -> String {
    format!("{}: {}", param1, param2)
}

// Generic functions
fn generic_function<T>(param: T) -> T {
    param
}

fn constrained_generic<T: Clone + std::fmt::Display>(param: T) -> T {
    println!("{}", param);
    param.clone()
}

// Async function
async fn async_function() -> String {
    "async".to_string()
}

// Unsafe function
unsafe fn unsafe_function() -> *const i32 {
    &42 as *const i32
}

// External function declaration
extern "C" {
    fn external_function(x: i32) -> i32;
}

// Basic struct
struct SimpleStruct {
    name: String,
    age: u32,
    email: String,
}

impl SimpleStruct {
    // Associated function (constructor-like)
    fn new(name: String, age: u32, email: String) -> Self {
        Self { name, age, email }
    }

    // Instance method
    fn get_name(&self) -> &str {
        &self.name
    }

    // Mutable instance method
    fn set_age(&mut self, age: u32) {
        self.age = age;
    }

    // Associated function (static method)
    fn default() -> Self {
        Self {
            name: "Default".to_string(),
            age: 0,
            email: "default@example.com".to_string(),
        }
    }
}

// Generic struct
struct GenericStruct<T, U> {
    data: T,
    metadata: U,
}

impl<T, U> GenericStruct<T, U> {
    fn new(data: T, metadata: U) -> Self {
        Self { data, metadata }
    }

    fn get_data(&self) -> &T {
        &self.data
    }

    fn get_metadata(&self) -> &U {
        &self.metadata
    }
}

// Struct with lifetime parameters
struct LifetimeStruct<'a> {
    data: &'a str,
}

impl<'a> LifetimeStruct<'a> {
    fn new(data: &'a str) -> Self {
        Self { data }
    }

    fn get_data(&self) -> &str {
        self.data
    }
}

// Tuple struct
struct TupleStruct(String, i32, bool);

impl TupleStruct {
    fn new(s: String, i: i32, b: bool) -> Self {
        TupleStruct(s, i, b)
    }

    fn get_string(&self) -> &str {
        &self.0
    }
}

// Unit struct
struct UnitStruct;

impl UnitStruct {
    fn new() -> Self {
        UnitStruct
    }
}

// Enums
enum SimpleEnum {
    Variant1,
    Variant2,
    Variant3,
}

enum EnumWithData {
    StringVariant(String),
    NumberVariant(i32),
    StructVariant { name: String, value: i32 },
    TupleVariant(String, i32, bool),
}

// Generic enum
enum GenericEnum<T> {
    Some(T),
    None,
}

// C-like enum
#[repr(C)]
enum CLikeEnum {
    First = 1,
    Second = 2,
    Third = 3,
}

// Traits
trait BasicTrait {
    // Associated type
    type Output;

    // Required methods
    fn required_method(&self) -> Self::Output;

    // Default implementation
    fn default_method(&self) -> String {
        "default".to_string()
    }
}

// Generic trait
trait GenericTrait<T> {
    fn process(&self, input: T) -> T;
}

// Trait with where clause
trait ComplexTrait<T>
where
    T: Clone + std::fmt::Display,
{
    fn complex_method(&self, input: T) -> T;
}

// Trait implementation
impl BasicTrait for SimpleStruct {
    type Output = String;

    fn required_method(&self) -> Self::Output {
        self.name.clone()
    }
}

// Generic trait implementation
impl<T: Clone> GenericTrait<T> for SimpleStruct {
    fn process(&self, input: T) -> T {
        input.clone()
    }
}

// Union (unsafe)
union SimpleUnion {
    int_value: i32,
    float_value: f32,
}

// Type aliases
type StringAlias = String;
type GenericAlias<T> = Vec<T>;
type ComplexAlias = Result<String, Box<dyn std::error::Error>>;

// Constants with complex types
const COMPLEX_CONSTANT: (i32, &str, bool) = (42, "hello", true);

// Static items with initialization
static INITIALIZED_STATIC: Vec<i32> = Vec::new();

// Modules
mod inner_module {
    pub struct ModuleStruct {
        pub data: String,
    }

    pub fn module_function() -> String {
        "module".to_string()
    }

    pub const MODULE_CONST: i32 = 100;

    // Nested module
    pub mod nested {
        pub fn nested_function() -> i32 {
            42
        }
    }
}

// Use statements
use std::collections::HashMap;
use std::fmt::{Display, Debug};
use inner_module::ModuleStruct;

// Macro definitions
macro_rules! simple_macro {
    ($x:expr) => {
        println!("Value: {}", $x);
    };
}

macro_rules! complex_macro {
    ($name:ident, $type:ty) => {
        struct $name {
            value: $type,
        }

        impl $name {
            fn new(value: $type) -> Self {
                Self { value }
            }
        }
    };
}

// Use the macro
complex_macro!(GeneratedStruct, i32);

// Function-like macro
macro_rules! function_like {
    ($($x:expr),*) => {
        vec![$($x),*]
    };
}

// Closures assigned to variables
let closure_variable = |x: i32| x * 2;
let complex_closure = |x: i32, y: i32| -> i32 { x + y };

// Variables with different patterns
let simple_variable = 42;
let mut mutable_variable = "mutable";
let (tuple_a, tuple_b) = (1, 2);
let SimpleStruct { name, age, email } = SimpleStruct::default();

// Reference and pointer variables
let reference_var = &simple_variable;
let mutable_reference = &mut mutable_variable;

// Arrays and slices
let array_variable: [i32; 5] = [1, 2, 3, 4, 5];
let slice_variable: &[i32] = &array_variable[1..3];

// Function pointers
let function_pointer: fn(i32) -> i32 = |x| x * 2;

// Complex nested structures
struct OuterStruct {
    inner: InnerStruct,
}

struct InnerStruct {
    value: i32,
}

impl OuterStruct {
    fn complex_method(&self) -> i32 {
        // Local struct
        struct LocalStruct {
            data: String,
        }

        impl LocalStruct {
            fn new(data: String) -> Self {
                Self { data }
            }

            fn process(&self) -> String {
                self.data.clone()
            }
        }

        // Local function
        fn local_function() -> i32 {
            let local_var = 10;
            local_var * 2
        }

        // Local closure
        let local_closure = |x: i32| x + self.inner.value;

        let local_struct = LocalStruct::new("test".to_string());
        let result = local_function();
        local_closure(result)
    }
}

// Error types
#[derive(Debug)]
struct CustomError {
    message: String,
}

impl std::fmt::Display for CustomError {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(f, "CustomError: {}", self.message)
    }
}

impl std::error::Error for CustomError {}

// Async structures
struct AsyncStruct;

impl AsyncStruct {
    async fn async_method(&self) -> Result<String, CustomError> {
        Ok("async result".to_string())
    }
}

// Attribute decorations
#[derive(Debug, Clone, PartialEq)]
struct DecoratedStruct {
    #[serde(rename = "custom_name")]
    field: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_function() {
        assert_eq!(simple_function(), "hello");
    }

    #[async_test]
    async fn async_test_function() {
        let result = async_function().await;
        assert_eq!(result, "async");
    }
}

// Foreign function interface
extern "C" fn c_function(x: i32) -> i32 {
    x * 2
}

// Unsafe blocks with variables
fn unsafe_function_with_locals() {
    unsafe {
        let unsafe_variable = 42;
        let unsafe_pointer = &unsafe_variable as *const i32;
        println!("Unsafe value: {}", *unsafe_pointer);
    }
}

// Pattern matching in functions
fn pattern_matching_function(input: EnumWithData) -> String {
    match input {
        EnumWithData::StringVariant(s) => s,
        EnumWithData::NumberVariant(n) => n.to_string(),
        EnumWithData::StructVariant { name, value } => format!("{}: {}", name, value),
        EnumWithData::TupleVariant(s, i, b) => format!("{} {} {}", s, i, b),
    }
}

// Const generic function
fn const_generic_function<const N: usize>(arr: [i32; N]) -> [i32; N] {
    arr
}

// Higher-ranked trait bounds
fn higher_ranked_function<F>(f: F) -> i32
where
    F: for<'a> Fn(&'a str) -> i32,
{
    f("test")
}