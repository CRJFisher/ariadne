//! Edge cases and corner cases for module and visibility system testing

// ==============================================================================
// COMPLEX IMPORT PATTERNS
// ==============================================================================

// Deeply nested imports
use std::collections::hash_map::DefaultHasher;
use std::sync::atomic::Ordering::{Relaxed, SeqCst, AcqRel};

// Multiple self imports
use std::fmt::{self, Display as Fmt, Debug as DbgFmt};
use std::io::{self as io_ops, Read as ReadTrait, Write as WriteTrait};

// Complex mixed imports with renaming
use std::{
    collections::{HashMap as HMap, BTreeMap, hash_map::Entry},
    sync::{Arc, Mutex, atomic::{AtomicBool, AtomicU64}},
    thread::{self, JoinHandle}
};

// Import with unusual patterns
use crate::{*, self as root};

// ==============================================================================
// COMPLEX EXTERN CRATE WITH UNUSUAL PATTERNS
// ==============================================================================

extern crate alloc;
extern crate core as core_lib;

// Using extern crate items
use alloc::vec::Vec as AllocVec;
use core_lib::marker::PhantomData;

// ==============================================================================
// COMPLEX VISIBILITY PATTERNS
// ==============================================================================

// Nested path visibility
pub(in crate::deep::nested::module) struct DeepRestricted;
pub(in super::parent::sibling) fn complex_path_visibility() {}

// Mixed visibility on trait items
pub trait ComplexVisibilityTrait {
    type PublicAssocType;

    fn public_method(&self);

    fn default_impl(&self) -> i32 {
        42
    }
}

// Implementation with mixed visibility methods
impl ComplexVisibilityTrait for DeepRestricted {
    type PublicAssocType = i32;

    fn public_method(&self) {}
}

// ==============================================================================
// COMPLEX PUB USE PATTERNS
// ==============================================================================

// Multiple levels of re-exports with different visibility
mod level1 {
    pub mod level2 {
        pub(crate) mod level3 {
            pub fn deeply_nested_function() -> &'static str {
                "deep"
            }

            pub struct DeepStruct {
                pub field: i32,
            }
        }

        // Re-export from level3 with different visibility
        pub use level3::deeply_nested_function;
        pub(crate) use level3::DeepStruct as Level2Struct;
    }

    // Re-export from level2
    pub use level2::deeply_nested_function as level1_fn;
    pub(super) use level2::Level2Struct;
}

// Final re-exports at crate root with various visibility levels
pub use level1::level1_fn;
pub(crate) use level1::Level2Struct as CrateStruct;

// Complex list re-exports with mixed visibility and aliases
pub use level1::level2::{
    deeply_nested_function as public_deep,
    Level2Struct as PublicLevel2
};

pub(crate) use level1::level2::level3::{
    deeply_nested_function as crate_deep,
    DeepStruct as CrateDeep
};

// Wildcard re-export with restricted visibility
pub(super) use level1::level2::*;

// ==============================================================================
// COMPLEX MODULE PATTERNS
// ==============================================================================

// Module with complex attributes
#[cfg(any(feature = "std", feature = "alloc"))]
#[path = "complex/path.rs"]
pub(crate) mod complex_attributed_module {
    pub fn attributed_function() {}
}

// Nested modules with different visibility
pub mod public_parent {
    pub(crate) mod crate_child {
        pub(super) mod super_grandchild {
            pub(in crate::public_parent) fn restricted_function() {}
        }

        // Re-export with visibility change
        pub use super_grandchild::restricted_function as child_fn;
    }

    // Re-export with different visibility
    pub use crate_child::child_fn as parent_fn;
}

// ==============================================================================
// EDGE CASE: MULTIPLE EXTERN CRATE ALIASES
// ==============================================================================

extern crate serde_json as json;
extern crate serde_derive as derive;

use json::{Value, Map as JsonMap};
use derive::{Serialize as SerTrait, Deserialize as DesTrait};

// ==============================================================================
// EDGE CASE: CONDITIONAL RE-EXPORTS
// ==============================================================================

#[cfg(feature = "experimental")]
pub use level1::level2::level3::DeepStruct as ExperimentalStruct;

#[cfg(not(feature = "std"))]
pub use core_lib::marker::PhantomData as NoStdPhantom;

#[cfg(all(unix, target_arch = "x86_64"))]
pub use std::os::unix::fs::PermissionsExt;

// ==============================================================================
// EDGE CASE: MACRO RE-EXPORTS WITH VISIBILITY
// ==============================================================================

macro_rules! internal_macro {
    () => { "internal" };
}

// Re-export internal macro with pub
pub use internal_macro as public_internal_macro;

// ==============================================================================
// EDGE CASE: TYPE ALIAS CHAINS WITH VISIBILITY
// ==============================================================================

type PrivateAlias = HashMap<String, i32>;
pub(crate) type CrateAlias = PrivateAlias;
pub type PublicAlias = CrateAlias;

// Re-export type aliases
pub use std::collections::HashMap as PublicHashMap;
pub(crate) use std::collections::BTreeMap as CrateBTreeMap;

// ==============================================================================
// EDGE CASE: CONST AND STATIC VISIBILITY PATTERNS
// ==============================================================================

const PRIVATE_CONST: i32 = 1;
pub(self) const SELF_CONST: i32 = 2;
pub(crate) const CRATE_CONST: i32 = 3;
pub(super) const SUPER_CONST: i32 = 4;
pub(in crate::public_parent) const RESTRICTED_CONST: i32 = 5;
pub const PUBLIC_CONST: i32 = 6;

static PRIVATE_STATIC: &str = "private";
pub(crate) static CRATE_STATIC: &str = "crate";
pub static PUBLIC_STATIC: &str = "public";

// Re-export constants with different visibility
pub use self::CRATE_CONST as PUBLIC_CRATE_CONST;

// ==============================================================================
// EDGE CASE: IMPL BLOCKS WITH COMPLEX VISIBILITY
// ==============================================================================

pub struct VisibilityStruct {
    pub public_field: i32,
    pub(crate) crate_field: String,
    pub(super) super_field: bool,
    pub(in crate::public_parent) restricted_field: f64,
    pub(self) self_field: u8,
    private_field: Vec<String>,
}

impl VisibilityStruct {
    pub fn public_new() -> Self {
        Self {
            public_field: 0,
            crate_field: String::new(),
            super_field: false,
            restricted_field: 0.0,
            self_field: 0,
            private_field: Vec::new(),
        }
    }

    pub(crate) fn crate_new() -> Self {
        Self::public_new()
    }

    pub(super) fn super_new() -> Self {
        Self::crate_new()
    }

    pub(in crate::public_parent) fn restricted_new() -> Self {
        Self::super_new()
    }

    pub(self) fn self_new() -> Self {
        Self::restricted_new()
    }

    // Methods with different visibility accessing different fields
    pub fn get_public(&self) -> i32 {
        self.public_field
    }

    pub(crate) fn get_crate(&self) -> &str {
        &self.crate_field
    }

    pub(super) fn get_super(&self) -> bool {
        self.super_field
    }

    pub(in crate::public_parent) fn get_restricted(&self) -> f64 {
        self.restricted_field
    }

    pub(self) fn get_self(&self) -> u8 {
        self.self_field
    }
}

// ==============================================================================
// EDGE CASE: TRAIT WITH COMPLEX VISIBILITY BOUNDS
// ==============================================================================

pub trait ComplexTrait<T>
where
    T: Send + Sync + 'static,
{
    type Output: Send;

    const TRAIT_CONST: i32 = 100;

    fn required_method(&self, input: T) -> Self::Output;

    fn default_method(&self) -> i32 {
        Self::TRAIT_CONST
    }
}

// Implementation with visibility restrictions
impl<T> ComplexTrait<T> for VisibilityStruct
where
    T: Send + Sync + 'static + Default,
{
    type Output = T;

    fn required_method(&self, _input: T) -> Self::Output {
        T::default()
    }
}

// ==============================================================================
// EDGE CASE: RE-EXPORTS OF TRAIT IMPLEMENTATIONS
// ==============================================================================

pub use self::ComplexTrait as PublicTrait;
pub(crate) use std::fmt::Debug as CrateDebugTrait;

// ==============================================================================
// EDGE CASE: EMPTY MODULES AND RE-EXPORTS
// ==============================================================================

mod empty_private {}
pub mod empty_public {}

// Re-export empty modules (edge case)
pub use empty_public as AliasedEmpty;

// ==============================================================================
// EDGE CASE: CIRCULAR-LOOKING RE-EXPORTS (NOT ACTUALLY CIRCULAR)
// ==============================================================================

mod a {
    pub fn function_a() -> i32 { 1 }
}

mod b {
    pub use super::a::function_a as b_function;
    pub fn function_b() -> i32 { 2 }
}

pub use b::b_function as final_a_function;
pub use b::function_b;

// ==============================================================================
// EDGE CASE: GENERIC ITEMS WITH VISIBILITY
// ==============================================================================

pub struct GenericStruct<T, U = i32> {
    pub field: T,
    pub(crate) default_field: U,
}

pub(crate) enum GenericEnum<T> {
    Variant1(T),
    Variant2 { field: T },
}

impl<T, U> GenericStruct<T, U> {
    pub fn new(field: T, default_field: U) -> Self {
        Self { field, default_field }
    }

    pub(crate) fn get_default(&self) -> &U {
        &self.default_field
    }
}

// Re-export generic types
pub use GenericStruct as PublicGeneric;
pub(crate) use GenericEnum as CrateGeneric;