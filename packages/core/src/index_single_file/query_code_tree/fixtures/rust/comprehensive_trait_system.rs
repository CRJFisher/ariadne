// Comprehensive trait system testing for semantic index
// Tests all trait system features: definitions, implementations, associated items, bounds, etc.

use std::fmt::{Debug, Display};
use std::ops::{Add, Deref, Index};
use std::marker::PhantomData;
use std::collections::HashMap;

// ============================================================================
// BASIC TRAIT DEFINITIONS
// ============================================================================

// Simple trait with method signature
pub trait Drawable {
    fn draw(&self);
    fn area(&self) -> f64;
}

// Trait with default implementation
pub trait Describable {
    fn name(&self) -> &str;

    // Default implementation
    fn description(&self) -> String {
        format!("This is a {}", self.name())
    }
}

// Trait with associated type
pub trait Iterator {
    type Item;

    fn next(&mut self) -> Option<Self::Item>;

    // Default method using associated type
    fn collect_vec(mut self) -> Vec<Self::Item>
    where
        Self: Sized
    {
        let mut vec = Vec::new();
        while let Some(item) = self.next() {
            vec.push(item);
        }
        vec
    }
}

// Trait with associated constant
pub trait Numeric {
    const ZERO: Self;
    const ONE: Self;

    fn add(self, other: Self) -> Self;
    fn is_zero(&self) -> bool;
}

// ============================================================================
// GENERIC TRAITS
// ============================================================================

// Generic trait with type parameter
pub trait Container<T> {
    fn insert(&mut self, item: T);
    fn get(&self, index: usize) -> Option<&T>;
    fn len(&self) -> usize;

    fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

// Generic trait with multiple type parameters and bounds
pub trait Converter<From, To>
where
    From: Clone,
    To: Default,
{
    type Error;

    fn convert(&self, from: From) -> Result<To, Self::Error>;

    fn try_convert_many(&self, items: Vec<From>) -> Result<Vec<To>, Self::Error> {
        items.into_iter().map(|item| self.convert(item)).collect()
    }
}

// Generic trait with lifetime parameters
pub trait Parser<'a> {
    type Output;
    type Error;

    fn parse(&self, input: &'a str) -> Result<Self::Output, Self::Error>;
}

// ============================================================================
// SUPERTRAIT RELATIONSHIPS
// ============================================================================

// Trait with supertrait
pub trait Shape: Drawable + Describable {
    fn perimeter(&self) -> f64;

    // Override default from supertrait
    fn description(&self) -> String {
        format!("{} with area {} and perimeter {}",
                self.name(), self.area(), self.perimeter())
    }
}

// Multiple supertraits
pub trait PrintableShape: Shape + Display + Debug {
    fn print_info(&self) {
        println!("{}", self);
        println!("Debug: {:?}", self);
        self.draw();
    }
}

// ============================================================================
// COMPLEX ASSOCIATED TYPES AND CONSTANTS
// ============================================================================

// Trait with multiple associated types
pub trait Database {
    type Connection;
    type Transaction;
    type Error;
    type Row: Iterator<Item = String>;

    const MAX_CONNECTIONS: usize = 100;
    const TIMEOUT_SECONDS: u64 = 30;

    fn connect(&self) -> Result<Self::Connection, Self::Error>;
    fn begin_transaction(&self, conn: &Self::Connection) -> Result<Self::Transaction, Self::Error>;
    fn query(&self, sql: &str) -> Result<Self::Row, Self::Error>;
}

// Trait with associated type bounds
pub trait Processor {
    type Input: Clone + Debug;
    type Output: Display + Send;
    type Error: std::error::Error + Send + Sync + 'static;

    fn process(&self, input: Self::Input) -> Result<Self::Output, Self::Error>;

    // Associated type in method signature
    fn batch_process(&self, inputs: Vec<Self::Input>) -> Vec<Result<Self::Output, Self::Error>> {
        inputs.into_iter().map(|input| self.process(input)).collect()
    }
}

// ============================================================================
// TRAIT IMPLEMENTATIONS
// ============================================================================

// Basic struct for implementations
#[derive(Debug, Clone)]
pub struct Circle {
    pub radius: f64,
}

#[derive(Debug, Clone)]
pub struct Rectangle {
    pub width: f64,
    pub height: f64,
}

// Simple trait implementation
impl Drawable for Circle {
    fn draw(&self) {
        println!("Drawing circle with radius {}", self.radius);
    }

    fn area(&self) -> f64 {
        std::f64::consts::PI * self.radius * self.radius
    }
}

impl Drawable for Rectangle {
    fn draw(&self) {
        println!("Drawing rectangle {}x{}", self.width, self.height);
    }

    fn area(&self) -> f64 {
        self.width * self.height
    }
}

// Implementation with default override
impl Describable for Circle {
    fn name(&self) -> &str {
        "circle"
    }

    // Override default implementation
    fn description(&self) -> String {
        format!("A {} with radius {:.2}", self.name(), self.radius)
    }
}

impl Describable for Rectangle {
    fn name(&self) -> &str {
        "rectangle"
    }
    // Uses default implementation
}

// Supertrait implementation
impl Shape for Circle {
    fn perimeter(&self) -> f64 {
        2.0 * std::f64::consts::PI * self.radius
    }
}

impl Shape for Rectangle {
    fn perimeter(&self) -> f64 {
        2.0 * (self.width + self.height)
    }
}

// ============================================================================
// GENERIC IMPLEMENTATIONS
// ============================================================================

// Generic struct for trait implementations
#[derive(Debug)]
pub struct Vec2D<T> {
    pub data: Vec<Vec<T>>,
}

impl<T> Container<T> for Vec2D<T>
where
    T: Clone,
{
    fn insert(&mut self, item: T) {
        if self.data.is_empty() {
            self.data.push(Vec::new());
        }
        self.data[0].push(item);
    }

    fn get(&self, index: usize) -> Option<&T> {
        self.data.get(0)?.get(index)
    }

    fn len(&self) -> usize {
        self.data.get(0).map_or(0, |row| row.len())
    }
}

// Implementation with associated types
pub struct NumberIterator {
    current: i32,
    max: i32,
}

impl Iterator for NumberIterator {
    type Item = i32;

    fn next(&mut self) -> Option<Self::Item> {
        if self.current < self.max {
            let result = self.current;
            self.current += 1;
            Some(result)
        } else {
            None
        }
    }
}

// ============================================================================
// TRAIT BOUNDS AND WHERE CLAUSES
// ============================================================================

// Function with simple trait bounds
pub fn draw_shapes<T: Drawable>(shapes: &[T]) {
    for shape in shapes {
        shape.draw();
    }
}

// Function with multiple trait bounds
pub fn print_shapes<T>(shapes: &[T])
where
    T: Drawable + Describable + Debug,
{
    for shape in shapes {
        println!("{:?}: {}", shape, shape.description());
        shape.draw();
    }
}

// Function with associated type bounds
pub fn process_iterator<I>(mut iter: I) -> Vec<String>
where
    I: Iterator,
    I::Item: Display,
{
    let mut results = Vec::new();
    while let Some(item) = iter.next() {
        results.push(item.to_string());
    }
    results
}

// Complex where clause with lifetime bounds
pub fn parse_and_process<'a, P, T>(parser: &P, input: &'a str) -> String
where
    P: Parser<'a, Output = T>,
    P::Error: Display,
    T: Display + Debug,
{
    match parser.parse(input) {
        Ok(result) => format!("Success: {}", result),
        Err(error) => format!("Error: {}", error),
    }
}

// ============================================================================
// TRAIT OBJECTS AND DYNAMIC DISPATCH
// ============================================================================

// Function using trait objects
pub fn draw_mixed_shapes(shapes: &[Box<dyn Drawable>]) {
    for shape in shapes {
        shape.draw();
        println!("Area: {}", shape.area());
    }
}

// Trait object with lifetime bounds
pub fn describe_shapes(shapes: &[&dyn Describable]) -> Vec<String> {
    shapes.iter().map(|shape| shape.description()).collect()
}

// ============================================================================
// OPERATOR OVERLOADING THROUGH TRAITS
// ============================================================================

impl Add for Circle {
    type Output = Circle;

    fn add(self, other: Circle) -> Circle {
        Circle {
            radius: self.radius + other.radius,
        }
    }
}

impl Index<usize> for Vec2D<String> {
    type Output = String;

    fn index(&self, index: usize) -> &Self::Output {
        &self.data[0][index]
    }
}

// ============================================================================
// BLANKET IMPLEMENTATIONS
// ============================================================================

// Blanket implementation for all types that implement certain traits
impl<T> Numeric for T
where
    T: Add<Output = T> + Copy + PartialEq + Default,
{
    const ZERO: Self = T::default();
    const ONE: Self = T::default(); // Simplified for testing

    fn add(self, other: Self) -> Self {
        self + other
    }

    fn is_zero(&self) -> bool {
        *self == Self::ZERO
    }
}

// ============================================================================
// COMPLEX TRAIT IMPLEMENTATIONS WITH GENERICS
// ============================================================================

// Generic converter implementation
pub struct StringToNumber;

impl<T> Converter<String, T> for StringToNumber
where
    T: std::str::FromStr + Default,
    T::Err: std::fmt::Display,
{
    type Error = String;

    fn convert(&self, from: String) -> Result<T, Self::Error> {
        from.parse().map_err(|e| format!("Parse error: {}", e))
    }
}

// ============================================================================
// ASSOCIATED CONST IMPLEMENTATIONS
// ============================================================================

pub struct MyDatabase;

impl Database for MyDatabase {
    type Connection = String;
    type Transaction = u64;
    type Error = String;
    type Row = NumberIterator;

    const MAX_CONNECTIONS: usize = 50; // Override default
    // Uses default TIMEOUT_SECONDS

    fn connect(&self) -> Result<Self::Connection, Self::Error> {
        Ok("connected".to_string())
    }

    fn begin_transaction(&self, _conn: &Self::Connection) -> Result<Self::Transaction, Self::Error> {
        Ok(12345)
    }

    fn query(&self, _sql: &str) -> Result<Self::Row, Self::Error> {
        Ok(NumberIterator { current: 0, max: 10 })
    }
}

// ============================================================================
// HIGHER-RANKED TRAIT BOUNDS (HRTB)
// ============================================================================

pub fn apply_to_str<F>(f: F, inputs: Vec<String>) -> Vec<String>
where
    F: for<'a> Fn(&'a str) -> String,
{
    inputs.iter().map(|s| f(s)).collect()
}

// ============================================================================
// MARKER TRAITS AND PHANTOM TYPES
// ============================================================================

pub trait Marker {}

pub struct PhantomContainer<T: Marker> {
    data: String,
    _phantom: PhantomData<T>,
}

impl<T: Marker> Describable for PhantomContainer<T> {
    fn name(&self) -> &str {
        "phantom_container"
    }
}

// ============================================================================
// ASYNC TRAITS (using async_trait crate simulation)
// ============================================================================

pub trait AsyncProcessor {
    type Item;
    type Error;

    // In real code this would be async fn, but for parsing we simulate
    fn process_async(&self, item: Self::Item) -> Result<Self::Item, Self::Error>;
}

pub struct AsyncStringProcessor;

impl AsyncProcessor for AsyncStringProcessor {
    type Item = String;
    type Error = String;

    fn process_async(&self, item: Self::Item) -> Result<Self::Item, Self::Error> {
        // Simulate async processing
        Ok(item.to_uppercase())
    }
}

// ============================================================================
// TRAIT ALIASES (when stable)
// ============================================================================

// This would be: trait StringProcessor = Processor<Input = String, Output = String>;
// For now we use a regular trait
pub trait StringProcessor: Processor<Input = String, Output = String> {}

// ============================================================================
// COMPLEX INTERACTION EXAMPLES
// ============================================================================

pub fn complex_trait_interaction() {
    // Create shapes
    let circle = Circle { radius: 5.0 };
    let rectangle = Rectangle { width: 3.0, height: 4.0 };

    // Use as trait objects
    let shapes: Vec<Box<dyn Drawable>> = vec![
        Box::new(circle.clone()),
        Box::new(rectangle.clone()),
    ];

    draw_mixed_shapes(&shapes);

    // Use with multiple trait bounds
    let describable_shapes = vec![&circle, &rectangle];
    print_shapes(&describable_shapes);

    // Use iterator with associated types
    let iter = NumberIterator { current: 0, max: 5 };
    let strings = process_iterator(iter);
    println!("Processed: {:?}", strings);

    // Use converter
    let converter = StringToNumber;
    let result: Result<i32, String> = converter.convert("42".to_string());
    println!("Converted: {:?}", result);

    // Use database
    let db = MyDatabase;
    if let Ok(conn) = db.connect() {
        println!("Connected: {}", conn);
        println!("Max connections: {}", MyDatabase::MAX_CONNECTIONS);
    }
}

// ============================================================================
// TEST HELPER IMPLEMENTATIONS
// ============================================================================

impl Display for Circle {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "Circle(r={})", self.radius)
    }
}

impl Display for Rectangle {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "Rectangle({}x{})", self.width, self.height)
    }
}

impl PrintableShape for Circle {}
impl PrintableShape for Rectangle {}

// Marker implementations
impl Marker for String {}
impl Marker for i32 {}