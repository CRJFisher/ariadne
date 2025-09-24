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

// Additional comprehensive macro patterns for testing
pub mod advanced_macro_patterns {
    // Macro with complex token tree patterns
    macro_rules! implement_trait {
        ($trait_name:ident for $type_name:ty {
            $($method_name:ident($($param:ident: $param_type:ty),*) -> $ret:ty $body:block)*
        }) => {
            impl $trait_name for $type_name {
                $(
                    fn $method_name($($param: $param_type),*) -> $ret $body
                )*
            }
        };
    }

    // Testing scoped macro invocations
    pub mod utils {
        macro_rules! log_debug {
            ($msg:expr) => {
                eprintln!("[DEBUG] {}", $msg);
            };
        }

        pub use log_debug;
    }

    // Using scoped macro
    pub fn test_scoped_macros() {
        utils::log_debug!("This is a scoped macro call");
    }

    // Macro that generates other macros
    macro_rules! create_macro {
        ($name:ident, $value:expr) => {
            macro_rules! $name {
                () => {
                    $value
                };
            }
        };
    }

    create_macro!(get_answer, 42);

    pub fn test_generated_macro() {
        let answer = get_answer!();
        println!("The answer is: {}", answer);
    }

    // More built-in macro usage
    pub fn extensive_builtin_usage() {
        // Standard output macros
        print!("Print without newline");
        println!("Print with newline");
        eprint!("Error print without newline");
        eprintln!("Error print with newline");

        // Format macros
        let formatted = format!("Hello {name}!", name = "World");
        println!("{}", formatted);

        // Assertion macros
        assert!(true, "This should pass");
        assert_eq!(2 + 2, 4, "Math should work");
        assert_ne!(1, 2, "These should be different");
        debug_assert!(cfg!(debug_assertions), "Debug assertions enabled");
        debug_assert_eq!(1 + 1, 2, "Debug math check");
        debug_assert_ne!(0, 1, "Debug inequality check");

        // Panic macros
        if false {
            panic!("This would panic");
            unreachable!("This code is unreachable");
            unimplemented!("This feature is not implemented yet");
            todo!("Implement this later");
        }

        // Collection macros
        let numbers = vec![1, 2, 3, 4, 5];
        println!("Numbers: {:?}", numbers);

        // Compile-time information
        println!("File: {}", file!());
        println!("Line: {}", line!());
        println!("Column: {}", column!());
        println!("Module path: {}", module_path!());

        // String manipulation
        let concatenated = concat!("Hello", " ", "World");
        let stringified = stringify!(some_expression);
        println!("{} - {}", concatenated, stringified);

        // Environment and configuration
        if let Ok(var) = std::env::var("PATH") {
            println!("PATH exists");
        }

        #[cfg(target_os = "linux")]
        println!("Running on Linux");

        #[cfg(target_os = "macos")]
        println!("Running on macOS");

        #[cfg(target_os = "windows")]
        println!("Running on Windows");

        // Include macros (conceptual - would include file contents)
        // let source = include_str!("../some_file.txt");
        // let bytes = include_bytes!("../some_file.bin");

        // Compiler intrinsics
        let size = std::mem::size_of::<i32>();
        println!("i32 size: {}", size);

        // Pattern matching helpers
        let value = Some(42);
        let matched = matches!(value, Some(x) if x > 0);
        println!("Matched: {}", matched);

        // Debug printing
        let debug_value = (1, "hello", vec![1, 2, 3]);
        dbg!(&debug_value);

        // Write macros for formatting
        use std::fmt::Write;
        let mut buffer = String::new();
        write!(&mut buffer, "Formatted: {}", 42).unwrap();
        writeln!(&mut buffer, " with newline").unwrap();
        println!("{}", buffer);

        // Try macro (would be used with ? operator)
        fn might_fail() -> Result<i32, &'static str> {
            Ok(42)
        }

        if let Ok(result) = might_fail() {
            println!("Result: {}", result);
        }
    }
}

// Procedural-like macro usage patterns
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct ComplexStruct {
    pub id: u64,
    pub name: String,
    pub active: bool,
}

// Multiple attribute usage
#[derive(Debug)]
#[derive(Clone)]
#[cfg(feature = "serde")]
pub struct ConditionalStruct {
    field: String,
}

// Custom attribute-like patterns (conceptual)
#[allow(dead_code)]
#[warn(unused_variables)]
pub fn attributed_function() {
    #[allow(unused_variables)]
    let unused = 42;
}

// Test module with various attributes
#[cfg(test)]
pub mod comprehensive_tests {
    use super::*;

    #[test]
    fn test_all_macros() {
        // Test simple macros
        say_hello!();
        say_hello!("Tester");

        // Test generated structs
        let point = Point { x: 1.0, y: 2.0 };
        println!("{}", point);

        // Test collection macros
        let map = hash_map! {
            "test" => "value",
            "another" => "entry",
        };
        assert_eq!(map.len(), 2);

        // Test count macro
        let count = count!(a b c);
        assert_eq!(count, 3);
    }

    #[test]
    #[should_panic(expected = "test panic")]
    fn test_panic_macro() {
        panic!("test panic");
    }

    #[test]
    #[ignore = "long running test"]
    fn ignored_test() {
        println!("This test is ignored");
    }

    // Async test pattern (conceptual)
    #[tokio::test]
    async fn async_test() {
        tokio::time::sleep(std::time::Duration::from_millis(1)).await;
        assert_eq!(1, 1);
    }

    // Benchmarking pattern (conceptual)
    #[bench]
    fn bench_macro_expansion(b: &mut test::Bencher) {
        b.iter(|| {
            say_hello!("benchmark");
        });
    }
}