// Advanced generics and lifetimes for comprehensive testing

use std::fmt::{Debug, Display};
use std::marker::PhantomData;
use std::collections::HashMap;

// ============================================================================
// ADVANCED GENERICS
// ============================================================================

// Generic struct with multiple type parameters and where clause
pub struct AdvancedContainer<T, U, V>
where
    T: Clone + Debug + Send + Sync,
    U: Display + PartialEq,
    V: Default + Into<String>,
{
    primary: T,
    secondary: U,
    metadata: V,
    phantom: PhantomData<(T, U, V)>,
}

// Generic enum with complex constraints
pub enum ComplexResult<T, E, M>
where
    T: Clone + Debug,
    E: std::error::Error + Send + Sync + 'static,
    M: Default + Clone,
{
    Success(T, M),
    Error(E),
    Partial(T, E, M),
    Empty,
}

// Const generics with complex expressions
pub struct Matrix<T, const ROWS: usize, const COLS: usize>
where
    T: Copy + Default + std::ops::Add<Output = T>,
{
    data: [[T; COLS]; ROWS],
}

impl<T, const ROWS: usize, const COLS: usize> Matrix<T, ROWS, COLS>
where
    T: Copy + Default + std::ops::Add<Output = T> + std::ops::Mul<Output = T>,
{
    pub fn new() -> Self {
        Matrix {
            data: [[T::default(); COLS]; ROWS],
        }
    }

    pub fn multiply<const OTHER_COLS: usize>(
        &self,
        other: &Matrix<T, COLS, OTHER_COLS>,
    ) -> Matrix<T, ROWS, OTHER_COLS> {
        Matrix::new()
    }
}

// Generic trait with associated types and complex bounds
pub trait AdvancedIterator<Item>
where
    Item: Clone + Debug,
{
    type Error: std::error::Error;
    type State: Default + Clone;

    fn try_next(&mut self) -> Result<Option<Item>, Self::Error>;
    fn state(&self) -> &Self::State;
    fn reset(&mut self);

    // Default implementation with where clause
    fn collect_all<C>(&mut self) -> Result<C, Self::Error>
    where
        C: Default + Extend<Item>,
        Item: Clone,
    {
        let mut collection = C::default();
        while let Some(item) = self.try_next()? {
            collection.extend(std::iter::once(item));
        }
        Ok(collection)
    }
}

// Higher-ranked trait bounds (HRTB)
pub fn process_with_closure<F, T>(data: Vec<T>, processor: F) -> Vec<String>
where
    F: for<'a> Fn(&'a T) -> &'a str,
    T: Debug,
{
    data.iter().map(|item| processor(item).to_string()).collect()
}

// Self-referential generic types
pub struct SelfRef<T>
where
    T: Clone,
{
    value: T,
    reference: Option<Box<SelfRef<T>>>,
}

impl<T> SelfRef<T>
where
    T: Clone + Debug,
{
    pub fn new(value: T) -> Self {
        SelfRef {
            value,
            reference: None,
        }
    }

    pub fn link(&mut self, other: SelfRef<T>) {
        self.reference = Some(Box::new(other));
    }
}

// Generic function with complex where clause and multiple type parameters
pub fn complex_generic_function<T, U, V, W>(
    input: T,
    transformer: U,
    validator: V,
) -> Result<W, Box<dyn std::error::Error>>
where
    T: Clone + Debug + Send,
    U: Fn(T) -> Result<V::Output, V::Error>,
    V: Validator<Input = T>,
    V::Output: Into<W>,
    V::Error: std::error::Error + 'static,
    W: Debug + Clone,
{
    let validated = validator.validate(input.clone())?;
    let result = transformer(input)?;
    Ok(result.into())
}

// Generic trait with associated types
pub trait Validator {
    type Input;
    type Output;
    type Error: std::error::Error;

    fn validate(&self, input: Self::Input) -> Result<Self::Output, Self::Error>;
}

// ============================================================================
// ADVANCED LIFETIMES
// ============================================================================

// Multiple lifetime parameters with constraints
pub struct MultiLifetime<'a, 'b, T>
where
    'a: 'b,  // lifetime bound: 'a outlives 'b
    T: 'a,   // type bound: T must live at least as long as 'a
{
    primary: &'a T,
    secondary: &'b str,
    backup: Option<&'a T>,
}

impl<'a, 'b, T> MultiLifetime<'a, 'b, T>
where
    'a: 'b,
    T: 'a + Clone + Debug,
{
    pub fn new(primary: &'a T, secondary: &'b str) -> Self {
        MultiLifetime {
            primary,
            secondary,
            backup: None,
        }
    }

    pub fn with_backup(mut self, backup: &'a T) -> Self {
        self.backup = Some(backup);
        self
    }

    // Method with lifetime parameters
    pub fn compare<'c>(&self, other: &'c T) -> bool
    where
        'a: 'c,
        T: PartialEq,
    {
        self.primary == other
    }
}

// Struct with lifetime bounds in where clause
pub struct BoundedLifetime<'a, T>
where
    T: 'a + Clone,
{
    data: &'a [T],
    cache: HashMap<usize, T>,
}

impl<'a, T> BoundedLifetime<'a, T>
where
    T: 'a + Clone + Debug + std::hash::Hash + Eq,
{
    pub fn new(data: &'a [T]) -> Self {
        BoundedLifetime {
            data,
            cache: HashMap::new(),
        }
    }

    pub fn get_cached(&mut self, index: usize) -> Option<&T> {
        if !self.cache.contains_key(&index) {
            if let Some(item) = self.data.get(index) {
                self.cache.insert(index, item.clone());
            }
        }
        self.cache.get(&index)
    }
}

// Function with complex lifetime relationships
pub fn complex_lifetime_function<'a, 'b, T>(
    primary: &'a T,
    secondary: &'b T,
    condition: bool,
) -> &'a T
where
    'b: 'a,  // 'b outlives 'a
    T: Clone + Debug,
{
    if condition {
        primary
    } else {
        // This is safe because 'b: 'a
        unsafe { std::mem::transmute(secondary) }
    }
}

// Higher-ranked lifetime bounds in trait
pub trait LifetimeProcessor {
    fn process<'a>(&self, input: &'a str) -> &'a str;

    // Method with HRTB
    fn process_all<F>(&self, inputs: Vec<String>, processor: F) -> Vec<String>
    where
        F: for<'a> Fn(&'a str) -> &'a str;
}

// Implementation with lifetime parameters
impl<'data> LifetimeProcessor for BoundedLifetime<'data, String> {
    fn process<'a>(&self, input: &'a str) -> &'a str {
        &input[..std::cmp::min(input.len(), 10)]
    }

    fn process_all<F>(&self, inputs: Vec<String>, processor: F) -> Vec<String>
    where
        F: for<'a> Fn(&'a str) -> &'a str,
    {
        inputs.iter().map(|s| processor(s).to_string()).collect()
    }
}

// Struct with phantom lifetime
pub struct PhantomLifetime<'a, T> {
    data: T,
    _phantom: PhantomData<&'a ()>,
}

impl<'a, T> PhantomLifetime<'a, T>
where
    T: Clone + 'a,
{
    pub fn new(data: T) -> Self {
        PhantomLifetime {
            data,
            _phantom: PhantomData,
        }
    }

    pub fn with_lifetime_bound<'b>(self) -> PhantomLifetime<'b, T>
    where
        'a: 'b,
    {
        PhantomLifetime {
            data: self.data,
            _phantom: PhantomData,
        }
    }
}

// ============================================================================
// COMBINED GENERICS AND LIFETIMES
// ============================================================================

// Generic struct with both type parameters and lifetimes
pub struct GenericLifetimeStruct<'a, 'b, T, U>
where
    'a: 'b,
    T: 'a + Clone + Debug,
    U: 'b + Display + PartialEq,
{
    primary_data: &'a [T],
    secondary_data: &'b U,
    processor: Box<dyn Fn(&T) -> String + 'a>,
}

impl<'a, 'b, T, U> GenericLifetimeStruct<'a, 'b, T, U>
where
    'a: 'b,
    T: 'a + Clone + Debug + Send + Sync,
    U: 'b + Display + PartialEq + Clone,
{
    pub fn new(
        primary_data: &'a [T],
        secondary_data: &'b U,
        processor: Box<dyn Fn(&T) -> String + 'a>,
    ) -> Self {
        GenericLifetimeStruct {
            primary_data,
            secondary_data,
            processor,
        }
    }

    pub fn process_with_lifetime<'c, V>(&self, external: &'c V) -> Vec<String>
    where
        'a: 'c,
        V: Debug + Clone,
    {
        self.primary_data
            .iter()
            .map(|item| (self.processor)(item))
            .collect()
    }
}

// Generic trait with lifetime parameters and associated types
pub trait GenericLifetimeTrait<'a, T>
where
    T: 'a + Clone,
{
    type Output: 'a + Clone + Debug;
    type Error: std::error::Error + Send + Sync + 'static;

    fn process(&self, input: &'a T) -> Result<Self::Output, Self::Error>;

    fn batch_process<I>(&self, inputs: I) -> Vec<Result<Self::Output, Self::Error>>
    where
        I: IntoIterator<Item = &'a T>;
}

// Complex implementation with where clauses
impl<'a, T, U> GenericLifetimeTrait<'a, T> for GenericLifetimeStruct<'a, '_, T, U>
where
    T: 'a + Clone + Debug + Send + Sync + std::hash::Hash,
    U: Display + PartialEq + Clone,
{
    type Output = String;
    type Error = Box<dyn std::error::Error + Send + Sync>;

    fn process(&self, input: &'a T) -> Result<Self::Output, Self::Error> {
        Ok((self.processor)(input))
    }

    fn batch_process<I>(&self, inputs: I) -> Vec<Result<Self::Output, Self::Error>>
    where
        I: IntoIterator<Item = &'a T>,
    {
        inputs
            .into_iter()
            .map(|input| self.process(input))
            .collect()
    }
}

// Function with complex generic and lifetime constraints
pub fn ultimate_generic_function<'a, 'b, T, U, V, F>(
    data: &'a [T],
    context: &'b U,
    transformer: F,
) -> Result<Vec<V>, Box<dyn std::error::Error + Send + Sync>>
where
    'a: 'b,
    T: 'a + Clone + Debug + Send + Sync + std::hash::Hash + Eq,
    U: 'b + Display + Clone + Send + Sync,
    V: Clone + Debug + Send + Sync,
    F: Fn(&'a T, &'b U) -> Result<V, Box<dyn std::error::Error + Send + Sync>> + Send + Sync,
{
    data.iter()
        .map(|item| transformer(item, context))
        .collect()
}