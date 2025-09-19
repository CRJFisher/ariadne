// Advanced generics, lifetimes, and type constraints

use std::fmt::{Debug, Display};
use std::marker::PhantomData;

// Generic struct with lifetime and constraints
pub struct Container<'a, T, U>
where
    T: Clone + Debug,
    U: Display,
{
    data: &'a T,
    metadata: U,
    _phantom: PhantomData<T>,
}

// Multiple lifetime parameters
pub struct BorrowChecker<'a, 'b, 'c> {
    first: &'a str,
    second: &'b mut String,
    third: &'c [u8],
}

// Higher-rank trait bounds (HRTB)
pub fn higher_rank<F>(f: F) -> String
where
    F: for<'a> Fn(&'a str) -> &'a str,
{
    f("test").to_string()
}

// Associated types in generics
pub trait Iterator<T> {
    type Item;
    type Error = String;

    fn next(&mut self) -> Result<Option<Self::Item>, Self::Error>;
}

// Generic implementation with where clause
impl<'a, T, U> Container<'a, T, U>
where
    T: Clone + Debug + Send + Sync,
    U: Display + Default,
{
    pub fn new(data: &'a T) -> Self {
        Container {
            data,
            metadata: U::default(),
            _phantom: PhantomData,
        }
    }

    pub fn get_data(&self) -> &T {
        self.data
    }

    pub fn transform<V, F>(&self, f: F) -> V
    where
        F: Fn(&T) -> V,
        V: Debug,
    {
        f(self.data)
    }
}

// Const generics
pub struct FixedArray<T, const N: usize> {
    data: [T; N],
}

impl<T: Default + Copy, const N: usize> FixedArray<T, N> {
    pub fn new() -> Self {
        FixedArray {
            data: [T::default(); N],
        }
    }

    pub fn get(&self, index: usize) -> Option<&T> {
        self.data.get(index)
    }
}

// Type aliases with generics
pub type Result<T> = std::result::Result<T, Box<dyn std::error::Error>>;
pub type HashMap<K, V> = std::collections::HashMap<K, V>;

// Trait objects and dynamic dispatch
pub trait Drawable {
    fn draw(&self);
}

pub struct Canvas {
    objects: Vec<Box<dyn Drawable + Send + Sync>>,
}

impl Canvas {
    pub fn new() -> Self {
        Canvas {
            objects: Vec::new(),
        }
    }

    pub fn add_object(&mut self, obj: Box<dyn Drawable + Send + Sync>) {
        self.objects.push(obj);
    }

    pub fn render(&self) {
        for obj in &self.objects {
            obj.draw();
        }
    }
}

// Generic enum with associated data
pub enum Either<L, R> {
    Left(L),
    Right(R),
}

impl<L, R> Either<L, R> {
    pub fn is_left(&self) -> bool {
        matches!(self, Either::Left(_))
    }

    pub fn map_left<T, F>(self, f: F) -> Either<T, R>
    where
        F: FnOnce(L) -> T,
    {
        match self {
            Either::Left(l) => Either::Left(f(l)),
            Either::Right(r) => Either::Right(r),
        }
    }
}

// Lifetime bounds in generics
pub fn longest<'a, T>(x: &'a T, y: &'a T) -> &'a T
where
    T: PartialOrd,
{
    if x > y { x } else { y }
}

// Self type in traits
pub trait Builder {
    type Output;

    fn new() -> Self;
    fn build(self) -> Self::Output;
    fn chain(self) -> Self
    where
        Self: Sized;
}

// Generic functions with multiple constraints
pub fn complex_function<T, U, V>(
    input: T,
    converter: U,
    processor: V,
) -> String
where
    T: Clone + Debug + Send,
    U: Fn(T) -> String + Send + Sync,
    V: Fn(String) -> String + 'static,
{
    let converted = converter(input);
    processor(converted)
}

// Async trait (requires async_trait crate in practice)
#[async_trait::async_trait]
pub trait AsyncProcessor {
    type Item;
    type Error;

    async fn process(&mut self, item: Self::Item) -> Result<(), Self::Error>;
}

// GAT (Generic Associated Types) - Rust 1.65+
pub trait LendingIterator {
    type Item<'a> where Self: 'a;

    fn next(&mut self) -> Option<Self::Item<'_>>;
}

// Complex type bounds with lifetimes
pub fn process_with_bounds<'a, 'b, T, F>(
    data: &'a mut T,
    processor: F,
) -> &'a T
where
    T: Debug + Clone + 'b,
    F: for<'c> Fn(&'c mut T) -> &'c T,
    'b: 'a,
{
    processor(data)
}