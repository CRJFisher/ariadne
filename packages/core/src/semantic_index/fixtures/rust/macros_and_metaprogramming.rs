// Macros and metaprogramming features

// Simple declarative macro
macro_rules! say_hello {
    () => {
        println!("Hello!");
    };
    ($name:expr) => {
        println!("Hello, {}!", $name);
    };
    ($name:expr, $count:expr) => {
        for _ in 0..$count {
            println!("Hello, {}!", $name);
        }
    };
}

// Complex macro with multiple patterns
macro_rules! create_struct {
    ($name:ident) => {
        pub struct $name;
    };
    ($name:ident, $($field:ident: $type:ty),*) => {
        pub struct $name {
            $(pub $field: $type,)*
        }
    };
}

// Macro for generating impl blocks
macro_rules! impl_display {
    ($type:ty, $format:expr) => {
        impl std::fmt::Display for $type {
            fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                write!(f, $format, self)
            }
        }
    };
}

// Recursive macro
macro_rules! count {
    () => (0usize);
    ($x:tt $($xs:tt)*) => (1usize + count!($($xs)*));
}

// Macro with repetition and separators
macro_rules! hash_map {
    ($($key:expr => $value:expr),* $(,)?) => {
        {
            let mut map = std::collections::HashMap::new();
            $(
                map.insert($key, $value);
            )*
            map
        }
    };
}

// Using the macros
create_struct!(EmptyStruct);
create_struct!(Point, x: f64, y: f64);

impl_display!(Point, "Point({}, {})");

pub fn test_macros() {
    say_hello!();
    say_hello!("World");
    say_hello!("Rust", 3);

    let point = Point { x: 1.0, y: 2.0 };
    println!("{}", point);

    let items_count = count!(a b c d e);
    println!("Count: {}", items_count);

    let map = hash_map! {
        "key1" => "value1",
        "key2" => "value2",
    };
    println!("{:?}", map);
}

// Procedural macro attributes (would be in separate crate normally)
#[derive(Debug, Clone, PartialEq)]
pub struct Derived {
    pub field: String,
}

// Custom derive example (conceptual)
#[derive(Debug)]
pub enum Status {
    Active,
    Inactive,
    Pending(String),
}

// Function-like procedural macro usage
pub fn use_function_macro() {
    // This would be a custom function-like macro
    // custom_macro!(input);
}

// Attribute macro usage
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_macros() {
        test_macros();
    }

    #[should_panic]
    #[test]
    fn test_panic() {
        panic!("Expected panic");
    }
}

// Built-in macros
pub fn builtin_macros() {
    println!("Debug: {:?}", 42);
    eprintln!("Error message");

    let v = vec![1, 2, 3, 4, 5];
    println!("Vector: {:?}", v);

    let file = file!();
    let line = line!();
    let column = column!();
    println!("Location: {}:{}:{}", file, line, column);

    // Compile-time assertions
    const_assert!(std::mem::size_of::<u64>() == 8);

    // Environment variables at compile time
    let version = env!("CARGO_PKG_VERSION");
    println!("Version: {}", version);
}

// Macro for creating enums
macro_rules! create_enum {
    ($name:ident { $($variant:ident),* }) => {
        #[derive(Debug, Clone, PartialEq)]
        pub enum $name {
            $($variant,)*
        }
    };
    ($name:ident { $($variant:ident($type:ty)),* }) => {
        #[derive(Debug, Clone, PartialEq)]
        pub enum $name {
            $($variant($type),)*
        }
    };
}

create_enum!(Color { Red, Green, Blue });
create_enum!(Value { Integer(i32), Text(String), Boolean(bool) });

// Macro with conditional compilation
macro_rules! debug_print {
    ($($arg:tt)*) => {
        #[cfg(debug_assertions)]
        println!($($arg)*);
    };
}

// Using debug macro
pub fn conditional_debug() {
    debug_print!("This only prints in debug builds");
}

// Complex macro with hygiene and scoping
macro_rules! with_temporary {
    ($temp:ident = $init:expr; $body:expr) => {
        {
            let $temp = $init;
            $body
        }
    };
}

pub fn test_hygiene() {
    let result = with_temporary!(temp = 42; temp * 2);
    println!("Result: {}", result);
}

// Macro for generating getters and setters
macro_rules! property {
    ($name:ident: $type:ty) => {
        paste::paste! {
            pub fn [<get_ $name>](&self) -> &$type {
                &self.$name
            }

            pub fn [<set_ $name>](&mut self, value: $type) {
                self.$name = value;
            }
        }
    };
}

pub struct PropertyExample {
    name: String,
    age: u32,
}

impl PropertyExample {
    pub fn new(name: String, age: u32) -> Self {
        Self { name, age }
    }

    property!(name: String);
    property!(age: u32);
}