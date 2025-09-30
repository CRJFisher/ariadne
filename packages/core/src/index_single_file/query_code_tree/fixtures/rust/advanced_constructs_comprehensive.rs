// Advanced Rust Constructs - Comprehensive Testing Fixture
// Tests const generics, associated types, unsafe blocks, loop constructs, and method calls

use std::collections::{HashMap, HashSet};
use std::marker::PhantomData;
use std::ops::{Deref, DerefMut};
use std::sync::{Arc, Mutex, RwLock};

// ============================================================================
// CONST GENERICS SECTION
// ============================================================================

/// Fixed-size array with const generics
pub struct FixedArray<T, const N: usize> {
    data: [T; N],
    len: usize,
}

impl<T, const N: usize> FixedArray<T, N> {
    /// Creates a new fixed array with default values
    pub const fn new() -> Self
    where
        T: Default + Copy,
    {
        Self {
            data: [T::default(); N],
            len: 0,
        }
    }

    /// Creates array from slice, panics if slice is too large
    pub const fn from_slice(slice: &[T]) -> Self
    where
        T: Copy,
    {
        assert!(slice.len() <= N);
        let mut data = [slice[0]; N]; // Using first element as default
        let mut i = 0;
        while i < slice.len() {
            data[i] = slice[i];
            i += 1;
        }
        Self {
            data,
            len: slice.len(),
        }
    }

    pub const fn capacity(&self) -> usize {
        N
    }

    pub const fn len(&self) -> usize {
        self.len
    }

    pub const fn is_empty(&self) -> bool {
        self.len == 0
    }
}

/// Matrix with const generic dimensions
pub struct Matrix<T, const ROWS: usize, const COLS: usize> {
    data: [[T; COLS]; ROWS],
}

impl<T, const ROWS: usize, const COLS: usize> Matrix<T, ROWS, COLS> {
    pub const fn new() -> Self
    where
        T: Default + Copy,
    {
        Self {
            data: [[T::default(); COLS]; ROWS],
        }
    }

    pub const fn rows(&self) -> usize {
        ROWS
    }

    pub const fn cols(&self) -> usize {
        COLS
    }

    pub const fn size(&self) -> (usize, usize) {
        (ROWS, COLS)
    }
}

/// Generic function with const parameters
pub const fn calculate_buffer_size<const N: usize, const M: usize>() -> usize {
    N * M + 1
}

/// Conditional compilation with const generics
impl<T, const N: usize> FixedArray<T, N> {
    pub const fn is_small_array(&self) -> bool {
        N <= 10
    }

    pub const fn is_medium_array(&self) -> bool {
        N > 10 && N <= 100
    }

    pub const fn is_large_array(&self) -> bool {
        N > 100
    }
}

// Complex const generic constraints
pub fn process_arrays<T, const N: usize, const M: usize>(
    a: &FixedArray<T, N>,
    b: &FixedArray<T, M>,
) -> usize
where
    T: Clone,
{
    calculate_buffer_size::<N, M>() + a.len() + b.len()
}

// ============================================================================
// ASSOCIATED TYPES SECTION
// ============================================================================

/// Container trait with associated types and constants
pub trait Container {
    type Item;
    type Iterator: Iterator<Item = Self::Item>;
    type IntoIter: IntoIterator<Item = Self::Item>;

    const DEFAULT_CAPACITY: usize;
    const MAX_CAPACITY: usize;

    fn len(&self) -> usize;
    fn is_empty(&self) -> bool;
    fn capacity(&self) -> usize;
    fn iter(&self) -> Self::Iterator;
    fn into_iter(self) -> Self::IntoIter;
}

/// Storage trait with multiple associated types
pub trait Storage {
    type Key;
    type Value;
    type Error;
    type Entry<'a> where Self: 'a;

    fn get<'a>(&'a self, key: &Self::Key) -> Result<Option<&'a Self::Value>, Self::Error>;
    fn insert(&mut self, key: Self::Key, value: Self::Value) -> Result<Option<Self::Value>, Self::Error>;
    fn remove(&mut self, key: &Self::Key) -> Result<Option<Self::Value>, Self::Error>;
    fn entry<'a>(&'a mut self, key: Self::Key) -> Self::Entry<'a>;
}

/// Implementation of Container for FixedArray
impl<T, const N: usize> Container for FixedArray<T, N>
where
    T: Clone,
{
    type Item = T;
    type Iterator = std::slice::Iter<'static, T>;
    type IntoIter = std::array::IntoIter<T, N>;

    const DEFAULT_CAPACITY: usize = N;
    const MAX_CAPACITY: usize = N;

    fn len(&self) -> usize {
        self.len
    }

    fn is_empty(&self) -> bool {
        self.len == 0
    }

    fn capacity(&self) -> usize {
        N
    }

    fn iter(&self) -> Self::Iterator {
        // This is a simplified implementation for testing
        unsafe { std::mem::transmute(self.data[..self.len].iter()) }
    }

    fn into_iter(self) -> Self::IntoIter {
        self.data.into_iter()
    }
}

/// Custom storage implementation
pub struct CustomHashMap<K, V> {
    inner: HashMap<K, V>,
}

impl<K, V> Storage for CustomHashMap<K, V>
where
    K: std::hash::Hash + Eq + Clone,
    V: Clone,
{
    type Key = K;
    type Value = V;
    type Error = String;
    type Entry<'a> = std::collections::hash_map::Entry<'a, K, V> where Self: 'a;

    fn get<'a>(&'a self, key: &Self::Key) -> Result<Option<&'a Self::Value>, Self::Error> {
        Ok(self.inner.get(key))
    }

    fn insert(&mut self, key: Self::Key, value: Self::Value) -> Result<Option<Self::Value>, Self::Error> {
        Ok(self.inner.insert(key, value))
    }

    fn remove(&mut self, key: &Self::Key) -> Result<Option<Self::Value>, Self::Error> {
        Ok(self.inner.remove(key))
    }

    fn entry<'a>(&'a mut self, key: Self::Key) -> Self::Entry<'a> {
        self.inner.entry(key)
    }
}

/// Generic processor with associated type bounds
pub fn process_container<C>(container: &C) -> usize
where
    C: Container,
    C::Item: Clone + std::fmt::Debug,
{
    let len = container.len();
    let capacity = container.capacity();
    len + capacity + C::DEFAULT_CAPACITY
}

/// Advanced trait with generic associated types (GATs)
pub trait Collect<T> {
    type Output<U>: IntoIterator<Item = U>;

    fn collect<U>(&self, items: impl Iterator<Item = U>) -> Self::Output<U>;
}

/// Implementation with concrete associated types
impl<T> Collect<T> for Vec<T> {
    type Output<U> = Vec<U>;

    fn collect<U>(&self, items: impl Iterator<Item = U>) -> Self::Output<U> {
        items.collect()
    }
}

// ============================================================================
// UNSAFE BLOCKS AND FUNCTIONS SECTION
// ============================================================================

/// Unsafe function for raw pointer operations
pub unsafe fn raw_pointer_ops<T>(ptr: *mut T, len: usize) -> *mut T {
    // Raw pointer arithmetic
    let offset_ptr = ptr.add(len);

    // Unsafe block within unsafe function
    unsafe {
        if !ptr.is_null() {
            std::ptr::write(ptr, std::ptr::read(offset_ptr));
        }
    }

    offset_ptr
}

/// Safe wrapper around unsafe operations
pub fn safe_pointer_wrapper<T>(data: &mut [T], index: usize) -> Option<*mut T> {
    if index < data.len() {
        Some(unsafe {
            // Unsafe block for getting raw pointer
            data.as_mut_ptr().add(index)
        })
    } else {
        None
    }
}

/// Union with unsafe access
pub union FloatIntUnion {
    pub float: f32,
    pub int: u32,
}

impl FloatIntUnion {
    pub fn new_float(val: f32) -> Self {
        Self { float: val }
    }

    pub fn new_int(val: u32) -> Self {
        Self { int: val }
    }

    pub unsafe fn as_float(&self) -> f32 {
        self.float
    }

    pub unsafe fn as_int(&self) -> u32 {
        self.int
    }

    pub fn safe_conversion(&self) -> (f32, u32) {
        unsafe { (self.float, self.int) }
    }
}

/// Unsafe trait implementation
pub unsafe trait UnsafeTrait {
    unsafe fn unsafe_method(&self);
    fn safe_method(&self);
}

pub struct UnsafeImpl {
    data: *mut u8,
}

unsafe impl UnsafeTrait for UnsafeImpl {
    unsafe fn unsafe_method(&self) {
        if !self.data.is_null() {
            unsafe {
                // Nested unsafe blocks
                *self.data = 42;
            }
        }
    }

    fn safe_method(&self) {
        unsafe {
            // Safe method with unsafe block
            self.unsafe_method();
        }
    }
}

/// Complex unsafe function with multiple safety features
pub unsafe fn complex_unsafe_operations<T>(
    src: *const T,
    dst: *mut T,
    count: usize,
) -> Result<(), &'static str> {
    // Multiple unsafe blocks with different purposes
    if src.is_null() || dst.is_null() {
        return Err("Null pointer");
    }

    unsafe {
        // Unsafe memory copy
        std::ptr::copy_nonoverlapping(src, dst, count);
    }

    for i in 0..count {
        unsafe {
            // Unsafe pointer arithmetic in loop
            let src_elem = src.add(i);
            let dst_elem = dst.add(i);

            if src_elem.is_null() || dst_elem.is_null() {
                return Err("Invalid pointer in loop");
            }
        }
    }

    Ok(())
}

// ============================================================================
// LOOP CONSTRUCTS AND ITERATORS SECTION
// ============================================================================

/// Comprehensive loop examples with different patterns
pub fn comprehensive_loops() {
    let data = vec![1, 2, 3, 4, 5];
    let mut map = HashMap::new();
    map.insert("key1", "value1");
    map.insert("key2", "value2");

    // Basic for loop with range
    for i in 0..10 {
        println!("Index: {}", i);
    }

    // For loop with inclusive range
    for i in 0..=10 {
        println!("Inclusive: {}", i);
    }

    // For loop with step_by iterator
    for i in (0..20).step_by(2) {
        println!("Even: {}", i);
    }

    // For loop with vector iteration
    for item in &data {
        println!("Item: {}", item);
    }

    // For loop with enumeration
    for (index, value) in data.iter().enumerate() {
        println!("Index {}: {}", index, value);
    }

    // For loop with HashMap iteration (destructuring)
    for (key, value) in &map {
        println!("Key: {}, Value: {}", key, value);
    }

    // Complex for loop with filter and map
    for doubled in data.iter().filter(|&&x| x % 2 == 0).map(|x| x * 2) {
        println!("Filtered and doubled: {}", doubled);
    }

    // While loop with condition
    let mut counter = 0;
    while counter < 5 {
        println!("While counter: {}", counter);
        counter += 1;
    }

    // While let loop with iterator
    let mut iter = data.iter();
    while let Some(item) = iter.next() {
        println!("While let item: {}", item);
    }

    // While let with Option destructuring
    let mut opt_value = Some(42);
    while let Some(value) = opt_value {
        println!("Optional value: {}", value);
        opt_value = None; // Prevent infinite loop
    }

    // Loop with break and continue
    let mut loop_counter = 0;
    loop {
        loop_counter += 1;

        if loop_counter % 2 == 0 {
            continue;
        }

        if loop_counter > 10 {
            break;
        }

        println!("Loop counter: {}", loop_counter);
    }

    // Nested loops with labels
    'outer: for i in 0..3 {
        'inner: for j in 0..3 {
            if i == 1 && j == 1 {
                break 'outer;
            }
            println!("Nested: ({}, {})", i, j);
        }
    }
}

/// Advanced iterator patterns
pub fn advanced_iterators() {
    let numbers = vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    let strings = vec!["hello", "world", "rust", "programming"];

    // Chain multiple iterators
    for item in numbers.iter().chain(strings.iter()) {
        println!("Chained: {:?}", item);
    }

    // Zip iterators together
    for (num, text) in numbers.iter().zip(strings.iter()) {
        println!("Zipped: {} - {}", num, text);
    }

    // Complex iterator with multiple transformations
    let result: Vec<_> = numbers
        .iter()
        .filter(|&&x| x % 2 == 0)
        .map(|x| x * x)
        .take(3)
        .collect();

    for squared in result {
        println!("Processed: {}", squared);
    }

    // Fold operation with loop-like behavior
    let sum = numbers.iter().fold(0, |acc, &x| {
        // This closure acts like a loop body
        acc + x
    });
    println!("Sum: {}", sum);

    // For_each as an alternative to for loops
    numbers.iter().for_each(|&x| {
        if x % 2 == 0 {
            println!("Even number: {}", x);
        }
    });
}

/// Loop variables with different patterns
pub fn loop_variable_patterns() {
    let tuple_data = vec![(1, "one"), (2, "two"), (3, "three")];
    let struct_data = vec![
        Person { name: "Alice".to_string(), age: 30 },
        Person { name: "Bob".to_string(), age: 25 },
    ];

    // Destructuring tuples in for loop
    for (number, word) in tuple_data {
        println!("Number: {}, Word: {}", number, word);
    }

    // Destructuring structs in for loop
    for Person { name, age } in struct_data {
        println!("Person: {} ({})", name, age);
    }

    // Complex pattern matching in loops
    let mixed_data = vec![
        Some((1, "valid")),
        None,
        Some((2, "also valid")),
    ];

    for item in mixed_data {
        match item {
            Some((num, text)) => println!("Valid: {} - {}", num, text),
            None => println!("Invalid item"),
        }
    }
}

#[derive(Debug)]
pub struct Person {
    pub name: String,
    pub age: u32,
}

// ============================================================================
// METHOD CALLS WITH RECEIVERS SECTION
// ============================================================================

/// Builder pattern with chained method calls
pub struct ConfigBuilder {
    host: String,
    port: u16,
    ssl: bool,
    timeout: u64,
}

impl ConfigBuilder {
    pub fn new() -> Self {
        Self {
            host: "localhost".to_string(),
            port: 8080,
            ssl: false,
            timeout: 30,
        }
    }

    pub fn host(mut self, host: &str) -> Self {
        self.host = host.to_string();
        self
    }

    pub fn port(mut self, port: u16) -> Self {
        self.port = port;
        self
    }

    pub fn enable_ssl(mut self) -> Self {
        self.ssl = true;
        self
    }

    pub fn timeout(mut self, seconds: u64) -> Self {
        self.timeout = seconds;
        self
    }

    pub fn build(self) -> Config {
        Config {
            host: self.host,
            port: self.port,
            ssl: self.ssl,
            timeout: self.timeout,
        }
    }
}

pub struct Config {
    pub host: String,
    pub port: u16,
    pub ssl: bool,
    pub timeout: u64,
}

impl Config {
    pub fn new() -> ConfigBuilder {
        ConfigBuilder::new()
    }

    pub fn connect(&self) -> Result<Connection, String> {
        Connection::new(&self.host, self.port, self.ssl)
    }
}

/// Connection with various method types
pub struct Connection {
    host: String,
    port: u16,
    ssl: bool,
    connected: bool,
}

impl Connection {
    // Associated function (static method)
    pub fn new(host: &str, port: u16, ssl: bool) -> Result<Self, String> {
        Ok(Self {
            host: host.to_string(),
            port,
            ssl,
            connected: false,
        })
    }

    // Mutable method with self
    pub fn connect(&mut self) -> Result<(), String> {
        self.connected = true;
        Ok(())
    }

    // Immutable method with &self
    pub fn is_connected(&self) -> bool {
        self.connected
    }

    // Method returning Self for chaining
    pub fn set_timeout(mut self, timeout: u64) -> Self {
        // Some timeout logic here
        self
    }

    // Method with multiple receivers in complex calls
    pub fn send_data(&mut self, data: &[u8]) -> Result<usize, String> {
        if self.connected {
            Ok(data.len())
        } else {
            Err("Not connected".to_string())
        }
    }

    // Method consuming self
    pub fn close(self) -> Result<(), String> {
        // Connection cleanup
        Ok(())
    }
}

/// Database with complex method call patterns
pub struct Database {
    connections: Vec<Connection>,
    pool_size: usize,
}

impl Database {
    pub fn new(pool_size: usize) -> Self {
        Self {
            connections: Vec::new(),
            pool_size,
        }
    }

    pub fn get_connection(&mut self) -> Option<&mut Connection> {
        self.connections.iter_mut().find(|conn| conn.is_connected())
    }

    pub fn execute_query(&mut self, query: &str) -> Result<Vec<String>, String> {
        if let Some(conn) = self.get_connection() {
            let data = query.as_bytes();
            conn.send_data(data)?;
            Ok(vec!["result".to_string()])
        } else {
            Err("No available connection".to_string())
        }
    }

    // Chained method calls with different receiver types
    pub fn batch_operations(&mut self) -> Result<(), String> {
        let queries = vec!["SELECT * FROM users", "UPDATE users SET active = true"];

        for query in queries {
            self.execute_query(query)?;
        }

        Ok(())
    }
}

/// Comprehensive method call examples
pub fn method_call_examples() {
    // Builder pattern with chained calls
    let config = Config::new()
        .host("example.com")
        .port(443)
        .enable_ssl()
        .timeout(60)
        .build();

    // Method calls on result of previous calls
    match config.connect() {
        Ok(mut conn) => {
            // Instance method calls
            let _ = conn.connect();
            let connected = conn.is_connected();

            if connected {
                // Method with data parameter
                let _ = conn.send_data(b"Hello, World!");
            }

            // Consuming method call
            let _ = conn.close();
        }
        Err(e) => println!("Connection failed: {}", e),
    }

    // Complex chained method calls
    let processed_data: Vec<_> = vec![1, 2, 3, 4, 5]
        .iter()
        .map(|x| x * 2)
        .filter(|&&x| x > 4)
        .collect();

    // Method calls on collection
    processed_data
        .iter()
        .enumerate()
        .for_each(|(i, &val)| println!("Index {}: {}", i, val));

    // Database operations with method chaining
    let mut db = Database::new(5);
    let _ = db.batch_operations();

    // Arc and Mutex method calls (thread-safety patterns)
    let shared_data = Arc::new(Mutex::new(vec![1, 2, 3]));
    if let Ok(mut data) = shared_data.lock() {
        data.push(4);
        data.retain(|&x| x > 1);
    }

    // RwLock method calls
    let rw_data = RwLock::new(HashMap::new());
    {
        let mut write_guard = rw_data.write().unwrap();
        write_guard.insert("key", "value");
    }
    {
        let read_guard = rw_data.read().unwrap();
        let _value = read_guard.get("key");
    }
}

/// Generic methods with associated function calls
impl<T, const N: usize> FixedArray<T, N>
where
    T: Clone + Default,
{
    // Associated function with complex generics
    pub fn with_default() -> Self {
        Self::new()
    }

    // Method with generic parameter
    pub fn transform<U, F>(&self, f: F) -> FixedArray<U, N>
    where
        F: Fn(&T) -> U,
        U: Clone + Default,
    {
        // This is a simplified implementation for testing
        FixedArray::new()
    }

    // Chained method with self consumption and return
    pub fn chain_transform(self) -> Self {
        self
    }

    // Method with multiple generic constraints
    pub fn complex_operation<U, V>(&mut self, mapper: impl Fn(&T) -> U, reducer: impl Fn(U, U) -> V) -> Option<V>
    where
        U: Clone,
        V: Default,
    {
        if self.is_empty() {
            None
        } else {
            Some(V::default())
        }
    }
}

/// Entry point function demonstrating all features
pub fn demonstrate_all_features() {
    // Const generics usage
    let mut array: FixedArray<i32, 10> = FixedArray::new();
    let matrix: Matrix<f64, 3, 3> = Matrix::new();
    let buffer_size = calculate_buffer_size::<5, 10>();

    println!("Array capacity: {}", array.capacity());
    println!("Matrix size: {:?}", matrix.size());
    println!("Buffer size: {}", buffer_size);

    // Associated types usage
    let mut custom_map: CustomHashMap<String, i32> = CustomHashMap { inner: HashMap::new() };
    let _ = custom_map.insert("test".to_string(), 42);
    let _value = custom_map.get(&"test".to_string());

    // Unsafe operations
    unsafe {
        let union_val = FloatIntUnion::new_float(3.14);
        let float_val = union_val.as_float();
        let int_val = union_val.as_int();
        println!("Union float: {}, int: {}", float_val, int_val);
    }

    // Loop constructs
    comprehensive_loops();
    advanced_iterators();
    loop_variable_patterns();

    // Method calls
    method_call_examples();

    // Generic method calls
    let transformed = array.chain_transform().transform(|x| x.to_string());
    println!("Transformed array capacity: {}", transformed.capacity());
}

// Test data structures for comprehensive testing
pub mod test_data {
    use super::*;

    pub fn create_test_scenarios() -> Vec<Box<dyn std::fmt::Debug>> {
        vec![
            Box::new(FixedArray::<i32, 5>::new()),
            Box::new(Matrix::<f32, 2, 2>::new()),
            Box::new(ConfigBuilder::new()),
            Box::new(Database::new(3)),
        ]
    }

    // Complex trait implementation for testing
    pub struct ComplexStruct<T, const N: usize> {
        data: FixedArray<T, N>,
        metadata: HashMap<String, String>,
    }

    impl<T, const N: usize> ComplexStruct<T, N>
    where
        T: Clone + Default + std::fmt::Debug,
    {
        pub fn new() -> Self {
            Self {
                data: FixedArray::new(),
                metadata: HashMap::new(),
            }
        }

        pub unsafe fn unsafe_access(&self) -> *const T {
            self.data.data.as_ptr()
        }

        pub fn process_all<F>(&mut self, processor: F)
        where
            F: Fn(&T) -> T,
        {
            // Simulated processing with loops
            for i in 0..self.data.len() {
                // Complex method call patterns would go here
                println!("Processing item {}", i);
            }
        }
    }
}
