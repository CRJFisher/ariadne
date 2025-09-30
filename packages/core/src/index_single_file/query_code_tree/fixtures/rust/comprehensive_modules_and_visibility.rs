//! Comprehensive test fixture for Rust module and visibility system
//! This file tests all aspects of the module system implementation

// ==============================================================================
// EXTERN CRATE DECLARATIONS
// ==============================================================================

// Simple extern crate
extern crate serde;
extern crate tokio;

// Aliased extern crates
extern crate regex as re;
extern crate clap as command_line_parser;

// ==============================================================================
// USE STATEMENTS AND IMPORTS
// ==============================================================================

// Simple scoped use statements
use std::collections::HashMap;
use std::io::Result;
use std::fmt::Display;

// Aliased imports
use std::collections::HashMap as Map;
use std::io::Result as IoResult;
use std::collections::BTreeMap as OrderedMap;

// Wildcard imports
use std::collections::*;
use std::io::prelude::*;

// Self imports
use std::fmt::{self, Debug, Formatter};
use std::io::{self, Read, Write, BufRead};

// Complex nested imports
use std::{
    collections::{HashMap, HashSet, BTreeMap},
    fmt::{Display, Debug},
    io::{self, Read, Write},
    fs::File,
    path::{Path, PathBuf}
};

// Mixed imports with aliases in lists
use std::collections::{
    HashMap,
    BTreeMap as OrderedMap,
    HashSet as Set
};

// External crate usage after extern declaration
use serde::{Serialize, Deserialize};
use re::{Regex, RegexBuilder};

// ==============================================================================
// MODULE DECLARATIONS
// ==============================================================================

// Simple external module
mod utils;
mod helpers;

// Public external modules
pub mod public_utils;
pub mod api;

// Inline modules with different visibility
mod private_inline {
    pub fn internal_function() -> i32 { 42 }

    pub(crate) fn crate_function() -> i32 { 24 }

    pub(super) fn parent_function() -> i32 { 12 }

    fn private_function() -> i32 { 6 }
}

pub mod public_inline {
    pub fn public_function() -> &'static str {
        "public"
    }

    pub(crate) struct CrateStruct {
        pub field: i32,
        pub(crate) crate_field: String,
        pub(super) super_field: bool,
        private_field: f64,
    }
}

// Module with restricted visibility
pub(crate) mod crate_module {
    pub fn crate_visible_function() {}

    pub(super) mod nested {
        pub fn nested_function() {}
    }
}

pub(super) mod super_module {
    pub fn super_visible_function() {}
}

// Path-restricted module
pub(in crate::api) mod restricted_module {
    pub fn restricted_function() {}
}

// Module with path attribute
#[path = "custom_path.rs"]
mod custom_path_module;

#[path = "another/custom.rs"]
pub mod public_custom_module;

// Conditional modules
#[cfg(feature = "advanced")]
pub mod advanced_features {
    pub fn advanced_function() -> String {
        "advanced".to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_module_function() {
        assert_eq!(private_inline::internal_function(), 42);
    }
}

// ==============================================================================
// PUB USE RE-EXPORTS
// ==============================================================================

// Simple pub use re-exports
pub use private_inline::internal_function;
pub use public_inline::public_function;

// Aliased pub use re-exports
pub use private_inline::crate_function as exposed_crate_function;
pub use public_inline::CrateStruct as PublicStruct;

// List pub use re-exports
pub use private_inline::{
    internal_function as internal_fn,
    parent_function,
    crate_function
};

// Wildcard pub use re-exports
pub use public_inline::*;

// Re-exports with different visibility levels
pub(crate) use private_inline::parent_function as crate_parent;
pub(super) use private_inline::crate_function as super_crate;

// Re-exports from external modules
pub use utils::utility_function;
pub use helpers::{helper1, helper2};

// Re-exports with path restrictions
pub(in crate::api) use private_inline::internal_function as api_function;

// Self re-exports
pub use self::private_inline::internal_function as self_internal;

// Crate-relative re-exports
pub use crate::public_inline::public_function as crate_public;

// ==============================================================================
// ITEMS WITH VARIOUS VISIBILITY MODIFIERS
// ==============================================================================

// Public items
pub struct PublicStruct {
    pub public_field: i32,
    pub(crate) crate_field: String,
    pub(super) super_field: bool,
    pub(in crate::api) restricted_field: f64,
    pub(self) self_field: u8,
    private_field: Vec<String>,
}

pub enum PublicEnum {
    Variant1,
    Variant2(i32),
    Variant3 { field: String },
}

pub trait PublicTrait {
    fn public_method(&self) -> i32;

    fn default_method(&self) -> String {
        "default".to_string()
    }
}

pub fn public_function() -> i32 { 1 }

// Crate-visible items
pub(crate) struct CrateStruct {
    pub field: i32,
}

pub(crate) enum CrateEnum {
    CrateVariant,
}

pub(crate) trait CrateTrait {
    fn crate_method(&self);
}

pub(crate) fn crate_function() -> i32 { 2 }

// Super-visible items
pub(super) struct SuperStruct {
    pub field: String,
}

pub(super) fn super_function() -> i32 { 3 }

// Path-restricted items
pub(in crate::api) struct RestrictedStruct {
    pub field: bool,
}

pub(in crate::api::handlers) fn path_restricted_function() -> i32 { 4 }

// Self-visible items (equivalent to private)
pub(self) struct SelfStruct {
    field: i32,
}

pub(self) fn self_function() -> i32 { 5 }

// Private items (for comparison)
struct PrivateStruct {
    field: i32,
}

fn private_function() -> i32 { 0 }

// ==============================================================================
// IMPLEMENTATION BLOCKS WITH VISIBILITY
// ==============================================================================

impl PublicStruct {
    pub fn new() -> Self {
        Self {
            public_field: 0,
            crate_field: String::new(),
            super_field: false,
            restricted_field: 0.0,
            self_field: 0,
            private_field: Vec::new(),
        }
    }

    pub fn public_method(&self) -> i32 {
        self.public_field
    }

    pub(crate) fn crate_method(&self) -> &str {
        &self.crate_field
    }

    pub(super) fn super_method(&self) -> bool {
        self.super_field
    }

    pub(in crate::api) fn restricted_method(&self) -> f64 {
        self.restricted_field
    }

    pub(self) fn self_method(&self) -> u8 {
        self.self_field
    }

    fn private_method(&self) -> usize {
        self.private_field.len()
    }
}

impl PublicTrait for PublicStruct {
    fn public_method(&self) -> i32 {
        self.public_field
    }
}

// ==============================================================================
// COMPLEX MODULE STRUCTURE WITH NESTED RE-EXPORTS
// ==============================================================================

pub mod complex {
    pub mod nested {
        pub fn deeply_nested() -> &'static str {
            "deep"
        }

        pub struct DeepStruct {
            pub field: i32,
        }
    }

    // Re-export from nested module
    pub use nested::deeply_nested;
    pub use nested::DeepStruct as PublicDeepStruct;

    // Re-export with alias
    pub use nested::{deeply_nested as deep_fn, DeepStruct};

    pub fn complex_function() -> String {
        format!("complex: {}", nested::deeply_nested())
    }
}

// Re-export from complex nested structure
pub use complex::nested::deeply_nested as root_deep_fn;
pub use complex::{complex_function, PublicDeepStruct};

// ==============================================================================
// MACRO DEFINITIONS AND EXPORTS
// ==============================================================================

// Public macro
#[macro_export]
macro_rules! public_macro {
    () => {
        println!("Public macro called");
    };
    ($msg:expr) => {
        println!("Public macro: {}", $msg);
    };
}

// Crate-visible macro
macro_rules! crate_macro {
    ($value:expr) => {
        $value * 2
    };
}

pub(crate) use crate_macro;

// ==============================================================================
// CONSTANTS AND STATICS WITH VISIBILITY
// ==============================================================================

pub const PUBLIC_CONSTANT: i32 = 100;
pub(crate) const CRATE_CONSTANT: i32 = 200;
pub(super) const SUPER_CONSTANT: i32 = 300;
pub(in crate::api) const RESTRICTED_CONSTANT: i32 = 400;
const PRIVATE_CONSTANT: i32 = 500;

pub static PUBLIC_STATIC: &str = "public";
pub(crate) static CRATE_STATIC: &str = "crate";
pub(super) static SUPER_STATIC: &str = "super";
static PRIVATE_STATIC: &str = "private";

// ==============================================================================
// TYPE ALIASES WITH VISIBILITY
// ==============================================================================

pub type PublicAlias = HashMap<String, i32>;
pub(crate) type CrateAlias = Vec<String>;
pub(super) type SuperAlias = Result<i32, String>;
pub(in crate::api) type RestrictedAlias = Option<bool>;
type PrivateAlias = BTreeMap<i32, String>;

// ==============================================================================
// PRELUDE MODULE PATTERN
// ==============================================================================

pub mod prelude {
    // Re-export commonly used items
    pub use super::{
        PublicStruct, PublicEnum, PublicTrait,
        public_function, PUBLIC_CONSTANT,
        PublicAlias
    };

    // Re-export from nested modules
    pub use super::complex::{complex_function, PublicDeepStruct};

    // Re-export external items
    pub use std::collections::{HashMap, Vec};
    pub use serde::{Serialize, Deserialize};
}

// ==============================================================================
// FEATURE-GATED EXPORTS
// ==============================================================================

#[cfg(feature = "experimental")]
pub mod experimental {
    pub fn experimental_function() -> &'static str {
        "experimental"
    }

    pub use super::private_function as exposed_private;
}

#[cfg(all(feature = "async", feature = "networking"))]
pub mod async_networking {
    pub async fn async_network_function() -> Result<String, Box<dyn std::error::Error>> {
        Ok("async networking".to_string())
    }
}

// ==============================================================================
// DOCUMENTATION AND ATTRIBUTES
// ==============================================================================

/// Public function with documentation
pub fn documented_function() -> i32 {
    42
}

#[doc = "Function with attribute documentation"]
pub fn attribute_documented_function() -> String {
    "documented".to_string()
}

#[deprecated(since = "1.0.0", note = "Use new_function instead")]
pub fn deprecated_function() -> i32 {
    0
}

#[must_use]
pub fn must_use_function() -> Result<i32, &'static str> {
    Ok(42)
}