// Basic structs and enums

// Simple struct
pub struct Point {
    pub x: f64,
    pub y: f64,
}

// Struct with generics
pub struct Pair<T, U> {
    first: T,
    second: U,
}

// Tuple struct
pub struct Color(u8, u8, u8);

// Unit struct
pub struct Marker;

// Simple enum
pub enum Direction {
    North,
    South,
    East,
    West,
}

// Enum with data
pub enum Option<T> {
    Some(T),
    None,
}

// Enum with complex variants
pub enum Message {
    Quit,
    Move { x: i32, y: i32 },
    Write(String),
    ChangeColor(u8, u8, u8),
}

// Implementation blocks
impl Point {
    // Constructor (associated function)
    pub fn new(x: f64, y: f64) -> Self {
        Point { x, y }
    }

    // Method
    pub fn distance(&self) -> f64 {
        (self.x * self.x + self.y * self.y).sqrt()
    }

    // Mutable method
    pub fn translate(&mut self, dx: f64, dy: f64) {
        self.x += dx;
        self.y += dy;
    }
}

// Generic implementation
impl<T, U> Pair<T, U> {
    pub fn first(&self) -> &T {
        &self.first
    }

    pub fn second(&self) -> &U {
        &self.second
    }
}

// Implementation for specific type
impl Pair<i32, i32> {
    pub fn sum(&self) -> i32 {
        self.first + self.second
    }
}