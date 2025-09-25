// Modules and visibility

// Public module
pub mod math {
    // Public function
    pub fn add(a: i32, b: i32) -> i32 {
        a + b
    }

    // Private function
    fn subtract(a: i32, b: i32) -> i32 {
        a - b
    }

    // Nested module
    pub mod advanced {
        pub fn power(base: i32, exp: u32) -> i32 {
            base.pow(exp)
        }
    }

    // Re-export
    pub use self::advanced::power;
}

// Private module
mod utils {
    pub(crate) fn helper() -> i32 {
        42
    }

    // Super visibility
    pub(super) fn parent_visible() -> i32 {
        100
    }
}

// Module with restricted visibility
pub(crate) mod internal {
    pub fn internal_function() -> &'static str {
        "internal"
    }
}

// Use declarations
use std::collections::HashMap;
use std::fmt::{self, Display, Formatter};
use std::io::{self, Read, Write};

// Aliased imports
use std::collections::HashMap as Map;
use std::io::Result as IoResult;

// Glob imports
use std::collections::*;

// Nested imports
use std::{
    cmp::Ordering,
    collections::{BTreeMap, HashSet},
    fs::File,
};

// External crate imports
extern crate serde;
use serde::{Deserialize, Serialize};

// Module defined in separate file (declaration)
pub mod config;
mod helpers;

// Inline module
mod tests {
    use super::*;

    #[test]
    fn test_math() {
        assert_eq!(math::add(2, 2), 4);
    }
}

// Path attributes
#[path = "custom_module.rs"]
mod custom;

// Conditional compilation
#[cfg(feature = "advanced")]
pub mod advanced_features {
    pub fn special_function() -> i32 {
        999
    }
}

// Public struct with private fields
pub struct User {
    pub username: String,
    email: String, // private
    age: Option<u32>, // private
}

impl User {
    // Public constructor
    pub fn new(username: String, email: String) -> Self {
        User {
            username,
            email,
            age: None,
        }
    }

    // Public getter for private field
    pub fn email(&self) -> &str {
        &self.email
    }

    // Private method
    fn validate_email(&self) -> bool {
        self.email.contains('@')
    }
}

// Re-exports at crate root
pub use math::add as add_numbers;
pub use utils::helper as util_helper;

// Module with macro
pub mod macros {
    #[macro_export]
    macro_rules! say_hello {
        () => {
            println!("Hello!");
        };
        ($name:expr) => {
            println!("Hello, {}!", $name);
        };
    }
}

// Use of crate keyword
pub fn crate_relative() {
    crate::math::add(1, 2);
    self::utils::helper();
    super::module_function();
}

// Module-level function referenced above
fn module_function() -> i32 {
    0
}

// Prelude-like module
pub mod prelude {
    pub use super::math::{add, power};
    pub use super::User;
    pub use std::collections::{HashMap, HashSet};
}