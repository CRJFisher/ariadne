// Traits and generics

use std::fmt::{self, Display};
use std::ops::Add;

// Simple trait
pub trait Drawable {
    fn draw(&self);
}

// Trait with associated type
pub trait Iterator {
    type Item;

    fn next(&mut self) -> Option<Self::Item>;
}

// Trait with generic parameters
pub trait Container<T> {
    fn contains(&self, item: &T) -> bool;
    fn add(&mut self, item: T);
}

// Trait with default implementation
pub trait Greet {
    fn name(&self) -> &str;

    fn hello(&self) {
        println!("Hello, {}", self.name());
    }
}

// Trait with lifetime parameters
pub trait Parser<'a> {
    type Output;

    fn parse(&self, input: &'a str) -> Self::Output;
}

// Struct for trait implementation
pub struct Circle {
    pub radius: f64,
}

// Implementing a trait
impl Drawable for Circle {
    fn draw(&self) {
        println!("Drawing circle with radius {}", self.radius);
    }
}

// Generic struct with trait bounds
pub struct Stack<T: Clone> {
    items: Vec<T>,
}

impl<T: Clone> Stack<T> {
    pub fn new() -> Self {
        Stack { items: Vec::new() }
    }

    pub fn push(&mut self, item: T) {
        self.items.push(item);
    }

    pub fn pop(&mut self) -> Option<T> {
        self.items.pop()
    }
}

// Function with trait bounds
pub fn print_it<T: Display>(item: T) {
    println!("{}", item);
}

// Multiple trait bounds
pub fn compare_and_print<T: Display + PartialOrd>(a: T, b: T) {
    if a < b {
        println!("{} is less than {}", a, b);
    }
}

// Where clause
pub fn process<T, U>(t: T, u: U) -> i32
where
    T: Display + Clone,
    U: Clone + Debug,
{
    println!("Processing: {}", t);
    42
}

// Generic type alias
pub type Result<T> = std::result::Result<T, String>;

// Const generics
pub struct Array<T, const N: usize> {
    data: [T; N],
}

impl<T: Default, const N: usize> Array<T, N> {
    pub fn new() -> Self {
        Array {
            data: [(); N].map(|_| T::default()),
        }
    }
}

// Higher-ranked trait bounds (HRTB)
pub fn apply<F>(f: F) -> i32
where
    F: for<'a> Fn(&'a str) -> i32,
{
    f("hello")
}

// Associated types in use
pub struct Counter {
    count: usize,
}

impl Iterator for Counter {
    type Item = usize;

    fn next(&mut self) -> Option<Self::Item> {
        self.count += 1;
        Some(self.count)
    }
}

// Trait objects
pub fn draw_all(drawables: &[Box<dyn Drawable>]) {
    for drawable in drawables {
        drawable.draw();
    }
}

// Implementing external traits
impl Display for Circle {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Circle(radius: {})", self.radius)
    }
}

// Operator overloading
impl Add for Circle {
    type Output = Circle;

    fn add(self, other: Circle) -> Circle {
        Circle {
            radius: self.radius + other.radius,
        }
    }
}