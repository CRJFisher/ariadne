// Ownership, lifetimes, and pattern matching

use std::rc::Rc;
use std::cell::RefCell;

// Ownership examples
pub fn ownership_examples() {
    // Move semantics
    let s1 = String::from("hello");
    let s2 = s1; // s1 is moved to s2

    // Clone
    let s3 = String::from("world");
    let s4 = s3.clone();

    // Borrowing
    let s5 = String::from("rust");
    let len = calculate_length(&s5);

    // Mutable borrowing
    let mut s6 = String::from("hello");
    change_string(&mut s6);
}

fn calculate_length(s: &String) -> usize {
    s.len()
}

fn change_string(s: &mut String) {
    s.push_str(", world");
}

// Lifetime examples
pub struct Book<'a> {
    title: &'a str,
    author: &'a str,
}

impl<'a> Book<'a> {
    pub fn new(title: &'a str, author: &'a str) -> Self {
        Book { title, author }
    }

    pub fn title(&self) -> &str {
        self.title
    }
}

// Multiple lifetimes
pub struct Context<'a, 'b> {
    data: &'a str,
    cache: &'b mut Vec<String>,
}

// Lifetime elision
pub fn first_word_elided(s: &str) -> &str {
    &s[..1]
}

// Static lifetime
pub fn static_string() -> &'static str {
    "I live forever!"
}

// Pattern matching
pub fn pattern_examples() {
    // Match expressions
    let x = 5;
    let result = match x {
        1 => "one",
        2 | 3 => "two or three",
        4..=10 => "four through ten",
        _ => "something else",
    };

    // If let
    let some_value = Some(10);
    if let Some(value) = some_value {
        println!("Got value: {}", value);
    }

    // While let
    let mut stack = vec![1, 2, 3];
    while let Some(top) = stack.pop() {
        println!("{}", top);
    }

    // Destructuring structs
    let point = Point { x: 0, y: 7 };
    let Point { x, y } = point;

    // Destructuring with ..
    let Point { x, .. } = point;

    // @ bindings
    let msg = Message::Hello { id: 5 };
    match msg {
        Message::Hello {
            id: id_variable @ 3..=7,
        } => println!("Found an id in range: {}", id_variable),
        _ => {}
    }

    // Guards
    let num = Some(4);
    match num {
        Some(x) if x < 5 => println!("less than five: {}", x),
        Some(x) => println!("{}", x),
        None => (),
    }
}

struct Point {
    x: i32,
    y: i32,
}

enum Message {
    Hello { id: i32 },
    Goodbye,
}

// Reference counting and interior mutability
pub fn smart_pointers() {
    // Rc (Reference Counting)
    let a = Rc::new(5);
    let b = Rc::clone(&a);
    let c = Rc::clone(&a);

    // RefCell (Interior Mutability)
    let data = RefCell::new(5);
    {
        let mut borrowed = data.borrow_mut();
        *borrowed += 1;
    }

    // Rc<RefCell<T>> pattern
    let shared_data = Rc::new(RefCell::new(vec![1, 2, 3]));
    let clone1 = Rc::clone(&shared_data);
    let clone2 = Rc::clone(&shared_data);

    clone1.borrow_mut().push(4);
}

// Box and recursive types
pub enum List {
    Cons(i32, Box<List>),
    Nil,
}

pub fn use_list() {
    let list = List::Cons(
        1,
        Box::new(List::Cons(
            2,
            Box::new(List::Cons(3, Box::new(List::Nil))),
        )),
    );
}

// Deref and Drop traits
pub struct MyBox<T>(T);

impl<T> MyBox<T> {
    pub fn new(x: T) -> MyBox<T> {
        MyBox(x)
    }
}

impl<T> std::ops::Deref for MyBox<T> {
    type Target = T;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl<T> Drop for MyBox<T> {
    fn drop(&mut self) {
        println!("Dropping MyBox!");
    }
}

// Match with different patterns
pub fn complex_patterns(x: Option<i32>) -> i32 {
    match x {
        None => 0,
        Some(i) if i > 0 => i,
        Some(i) => -i,
    }
}

// Destructuring in function parameters
pub fn print_point(&Point { x, y }: &Point) {
    println!("Point at ({}, {})", x, y);
}

// Loop labels and break with value
pub fn loop_examples() -> i32 {
    let mut counter = 0;

    let result = 'counting_up: loop {
        counter += 1;

        if counter == 10 {
            break 'counting_up counter * 2;
        }
    };

    result
}

// Unsafe and raw pointers
pub unsafe fn unsafe_examples() {
    let mut num = 5;

    let r1 = &num as *const i32;
    let r2 = &mut num as *mut i32;

    unsafe {
        println!("r1 is: {}", *r1);
        *r2 = 10;
    }
}