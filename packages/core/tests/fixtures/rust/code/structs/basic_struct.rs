// Basic struct definitions
// Tests: struct declarations, methods, associated functions

struct User {
    name: String,
    email: String,
    age: u32,
}

impl User {
    fn new(name: String, email: String, age: u32) -> Self {
        User { name, email, age }
    }

    fn greet(&self) -> String {
        format!("Hello, I'm {}", self.name)
    }

    fn get_age(&self) -> u32 {
        self.age
    }

    fn set_age(&mut self, age: u32) {
        self.age = age;
    }
}

struct Point {
    x: f64,
    y: f64,
}

impl Point {
    fn new(x: f64, y: f64) -> Self {
        Point { x, y }
    }

    fn distance_from_origin(&self) -> f64 {
        (self.x * self.x + self.y * self.y).sqrt()
    }
}

pub fn main() {
    let user = User::new(
        String::from("Alice"),
        String::from("alice@example.com"),
        30,
    );
    println!("{}", user.greet());
}
