// Comprehensive ownership, borrowing, and smart pointer examples
// This file tests all the ownership patterns implemented in the semantic index

use std::rc::Rc;
use std::cell::RefCell;
use std::sync::{Arc, Mutex, RwLock, Weak};
use std::collections::HashMap;

// ============================================================================
// BASIC BORROWING AND REFERENCES
// ============================================================================

pub struct Data {
    value: i32,
    name: String,
}

pub fn basic_borrowing_examples() {
    let data = Data { value: 42, name: "test".to_string() };

    // Immutable references
    let ref1 = &data;
    let ref2 = &data.value;
    let ref3 = &data.name;

    // Function taking reference
    process_data(&data);

    // Multiple references
    let refs = vec![&data.value, &data.value, &data.value];

    // Reference in pattern matching
    match &data {
        Data { value, .. } => println!("Value: {}", value),
    }
}

pub fn mutable_borrowing_examples() {
    let mut data = Data { value: 42, name: "test".to_string() };

    // Mutable references
    let mut_ref1 = &mut data;
    modify_data(&mut data);

    // Mutable reference to field
    let mut_ref2 = &mut data.value;
    *mut_ref2 += 10;

    // Mutable reference in function parameter
    update_name(&mut data.name, "updated");
}

pub fn dereferencing_examples() {
    let x = 42;
    let ref_x = &x;
    let ref_ref_x = &ref_x;

    // Basic dereference
    let value1 = *ref_x;

    // Multiple dereference
    let value2 = **ref_ref_x;

    // Dereference in expressions
    let sum = *ref_x + 10;
    let comparison = *ref_x > 30;

    // Dereference of mutable reference
    let mut y = 100;
    let mut_ref_y = &mut y;
    *mut_ref_y = 200;

    // Dereference in assignments
    let z = &x;
    let dereferenced = *z;
}

// Helper functions
fn process_data(data: &Data) {
    println!("Processing: {}", data.name);
}

fn modify_data(data: &mut Data) {
    data.value *= 2;
}

fn update_name(name: &mut String, new_name: &str) {
    name.clear();
    name.push_str(new_name);
}

// ============================================================================
// REFERENCE TYPES IN SIGNATURES
// ============================================================================

// Function with reference parameters
pub fn compare_strings(s1: &str, s2: &str) -> bool {
    s1 == s2
}

// Function returning reference (with lifetime)
pub fn longest<'a>(s1: &'a str, s2: &'a str) -> &'a str {
    if s1.len() > s2.len() { s1 } else { s2 }
}

// Function with mutable reference return
pub fn get_first_mut<T>(vec: &mut Vec<T>) -> Option<&mut T> {
    vec.get_mut(0)
}

// Struct with reference fields
pub struct BorrowedData<'a> {
    name: &'a str,
    values: &'a [i32],
}

impl<'a> BorrowedData<'a> {
    pub fn new(name: &'a str, values: &'a [i32]) -> Self {
        Self { name, values }
    }

    pub fn get_name(&self) -> &str {
        self.name
    }

    pub fn get_values(&self) -> &[i32] {
        self.values
    }
}

// ============================================================================
// SMART POINTERS - BOX
// ============================================================================

pub fn box_examples() {
    // Basic Box allocation
    let boxed_int = Box::new(42);
    let boxed_string = Box::new(String::from("boxed"));
    let boxed_vec = Box::new(vec![1, 2, 3, 4, 5]);

    // Dereferencing Box
    let value = *boxed_int;
    let length = boxed_string.len(); // Auto-deref

    // Box with custom types
    let boxed_data = Box::new(Data {
        value: 100,
        name: "boxed_data".to_string()
    });

    // Box in function calls
    process_boxed(boxed_data);

    // Box for recursive types
    let list = Box::new(List::Cons(1, Box::new(List::Cons(2, Box::new(List::Nil)))));
}

pub enum List {
    Cons(i32, Box<List>),
    Nil,
}

fn process_boxed(data: Box<Data>) {
    println!("Boxed data: {}", data.name);
}

// ============================================================================
// SMART POINTERS - RC (REFERENCE COUNTING)
// ============================================================================

pub fn rc_examples() {
    // Basic Rc allocation
    let rc_int = Rc::new(42);
    let rc_string = Rc::new(String::from("shared"));
    let rc_data = Rc::new(Data { value: 200, name: "shared_data".to_string() });

    // Rc cloning (increment reference count)
    let rc_clone1 = Rc::clone(&rc_int);
    let rc_clone2 = Rc::clone(&rc_int);
    let rc_clone3 = rc_int.clone(); // Alternative syntax

    // Multiple references to same data
    let shared_vec = Rc::new(vec![1, 2, 3, 4]);
    let ref1 = Rc::clone(&shared_vec);
    let ref2 = Rc::clone(&shared_vec);
    let ref3 = Rc::clone(&shared_vec);

    // Rc with custom types
    let shared_map = Rc::new(HashMap::new());
    let map_ref1 = Rc::clone(&shared_map);
    let map_ref2 = Rc::clone(&shared_map);

    // Rc strong/weak count checking
    println!("Strong count: {}", Rc::strong_count(&rc_int));
    println!("Weak count: {}", Rc::weak_count(&rc_int));
}

// ============================================================================
// SMART POINTERS - ARC (ATOMIC REFERENCE COUNTING)
// ============================================================================

pub fn arc_examples() {
    // Basic Arc allocation (for thread safety)
    let arc_int = Arc::new(42);
    let arc_string = Arc::new(String::from("thread_safe"));
    let arc_data = Arc::new(Data { value: 300, name: "thread_safe_data".to_string() });

    // Arc cloning
    let arc_clone1 = Arc::clone(&arc_int);
    let arc_clone2 = Arc::clone(&arc_int);
    let arc_clone3 = arc_int.clone();

    // Arc with collections
    let shared_vec = Arc::new(vec![10, 20, 30]);
    let vec_ref1 = Arc::clone(&shared_vec);
    let vec_ref2 = Arc::clone(&shared_vec);

    // Arc for thread communication
    let counter = Arc::new(std::sync::atomic::AtomicI32::new(0));
    let counter_clone = Arc::clone(&counter);
}

// ============================================================================
// SMART POINTERS - REFCELL (INTERIOR MUTABILITY)
// ============================================================================

pub fn refcell_examples() {
    // Basic RefCell allocation
    let cell_int = RefCell::new(42);
    let cell_string = RefCell::new(String::from("mutable"));
    let cell_vec = RefCell::new(vec![1, 2, 3]);

    // Borrowing from RefCell
    {
        let borrowed = cell_int.borrow();
        println!("Value: {}", *borrowed);
    }

    // Mutable borrowing from RefCell
    {
        let mut borrowed_mut = cell_int.borrow_mut();
        *borrowed_mut += 10;
    }

    // Try borrowing (fallible)
    if let Ok(borrowed) = cell_string.try_borrow() {
        println!("String: {}", borrowed);
    }

    if let Ok(mut borrowed_mut) = cell_vec.try_borrow_mut() {
        borrowed_mut.push(4);
    }

    // RefCell methods
    let replaced = cell_int.replace(100);
    let swapped = cell_string.replace_with(|old| old.to_uppercase());
}

// ============================================================================
// SMART POINTERS - COMBINED PATTERNS
// ============================================================================

pub fn combined_smart_pointer_examples() {
    // Rc<RefCell<T>> pattern - shared mutable data
    let shared_mutable = Rc::new(RefCell::new(vec![1, 2, 3]));
    let clone1 = Rc::clone(&shared_mutable);
    let clone2 = Rc::clone(&shared_mutable);

    // Modifying through different clones
    clone1.borrow_mut().push(4);
    clone2.borrow_mut().push(5);

    // Arc<Mutex<T>> pattern - thread-safe shared mutable data
    let thread_safe_data = Arc::new(Mutex::new(HashMap::new()));
    let data_clone = Arc::clone(&thread_safe_data);

    // Mutex operations
    {
        let mut locked = thread_safe_data.lock().unwrap();
        locked.insert("key1", "value1");
    }

    if let Ok(mut locked) = data_clone.try_lock() {
        locked.insert("key2", "value2");
    }

    // Arc<RwLock<T>> pattern - readers-writer lock
    let rw_data = Arc::new(RwLock::new(vec![10, 20, 30]));
    let rw_clone = Arc::clone(&rw_data);

    // Read operations
    {
        let reader = rw_data.read().unwrap();
        println!("Length: {}", reader.len());
    }

    // Write operations
    {
        let mut writer = rw_clone.write().unwrap();
        writer.push(40);
    }

    // Weak references
    let strong_ref = Rc::new(42);
    let weak_ref = Rc::downgrade(&strong_ref);

    if let Some(upgraded) = weak_ref.upgrade() {
        println!("Still alive: {}", *upgraded);
    }
}

// ============================================================================
// ADVANCED REFERENCE PATTERNS
// ============================================================================

pub fn advanced_reference_patterns() {
    let data = Data { value: 500, name: "advanced".to_string() };

    // Reference in match patterns
    match &data {
        Data { value: v, name } if *v > 100 => {
            println!("High value: {} with name: {}", v, name);
        }
        _ => {}
    }

    // Reference in closure capture
    let reference = &data;
    let closure = |x: i32| -> i32 {
        x + reference.value
    };
    let result = closure(10);

    // References in iterators
    let vec = vec![1, 2, 3, 4, 5];
    let refs: Vec<&i32> = vec.iter().collect();
    let doubled: Vec<i32> = vec.iter().map(|&x| x * 2).collect();

    // Mutable references in iterators
    let mut vec_mut = vec![1, 2, 3];
    for item in vec_mut.iter_mut() {
        *item *= 2;
    }

    // Reference slicing
    let array = [1, 2, 3, 4, 5];
    let slice = &array[1..4];
    let slice_ref = &slice;
}

// ============================================================================
// FUNCTION POINTERS AND REFERENCES
// ============================================================================

pub fn function_pointer_examples() {
    // Function that takes a reference and returns a reference
    fn identity<T>(x: &T) -> &T { x }

    // Function pointer with references
    let func: fn(&i32) -> &i32 = identity;
    let value = 42;
    let result = func(&value);

    // Function that takes mutable reference
    fn increment(x: &mut i32) {
        *x += 1;
    }

    let mut_func: fn(&mut i32) = increment;
    let mut val = 100;
    mut_func(&mut val);
}

// ============================================================================
// GENERIC FUNCTIONS WITH REFERENCES
// ============================================================================

pub fn generic_reference_functions() {
    // Generic function with reference
    fn process<T: std::fmt::Debug>(item: &T) {
        println!("Processing: {:?}", item);
    }

    let value = 42;
    process(&value);

    let string = String::from("test");
    process(&string);

    // Generic function with mutable reference
    fn modify<T: Default>(item: &mut T) {
        *item = T::default();
    }

    let mut num = 100;
    modify(&mut num);

    let mut text = String::from("old");
    modify(&mut text);
}

// ============================================================================
// SMART POINTER METHOD CHAINS
// ============================================================================

pub fn smart_pointer_method_chains() {
    // Box method chaining
    let boxed = Box::new(String::from("test"))
        .as_ref()
        .len();

    // Rc method chaining
    let rc_vec = Rc::new(vec![1, 2, 3]);
    let length = rc_vec.as_ref().len();

    // RefCell method chaining
    let cell = RefCell::new(vec![1, 2, 3]);
    cell.borrow_mut().push(4);
    cell.borrow_mut().extend_from_slice(&[5, 6, 7]);

    // Arc<Mutex<T>> method chaining
    let locked_data = Arc::new(Mutex::new(HashMap::new()));
    locked_data.lock().unwrap().insert("key", "value");

    // Complex chaining
    let complex = Rc::new(RefCell::new(vec![Box::new(1), Box::new(2)]));
    complex.borrow_mut().push(Box::new(3));
}

// ============================================================================
// ERROR HANDLING WITH SMART POINTERS
// ============================================================================

pub fn error_handling_with_smart_pointers() -> Result<(), Box<dyn std::error::Error>> {
    // Box<dyn Error> for error handling
    let data = Box::new("some data");

    // Rc with error propagation
    let shared = Rc::new(RefCell::new(vec![1, 2, 3]));
    if shared.try_borrow_mut().is_err() {
        return Err("Failed to borrow mutably".into());
    }

    // Arc<Mutex<T>> with error handling
    let thread_data = Arc::new(Mutex::new(42));
    if let Ok(mut guard) = thread_data.try_lock() {
        *guard += 10;
    } else {
        return Err("Failed to acquire lock".into());
    }

    Ok(())
}