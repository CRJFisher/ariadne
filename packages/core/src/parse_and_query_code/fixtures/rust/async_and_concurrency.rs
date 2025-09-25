// Async/await and concurrency features

use std::future::Future;
use std::pin::Pin;
use std::sync::{Arc, Mutex, RwLock};
use std::thread;
use std::time::Duration;
use tokio::sync::{mpsc, Semaphore};

// Basic async function
pub async fn fetch_data(url: &str) -> Result<String, Box<dyn std::error::Error>> {
    // Simulated async work
    tokio::time::sleep(Duration::from_millis(100)).await;
    Ok(format!("Data from {}", url))
}

// Async function with generic return type
pub async fn process_async<T, F>(input: T, processor: F) -> T
where
    T: Send + 'static,
    F: FnOnce(T) -> T + Send + 'static,
{
    tokio::task::spawn_blocking(move || processor(input))
        .await
        .unwrap()
}

// Async trait implementation
#[async_trait::async_trait]
pub trait AsyncProcessor {
    type Item;
    type Error;

    async fn process(&self, item: Self::Item) -> Result<Self::Item, Self::Error>;
}

pub struct DataProcessor;

#[async_trait::async_trait]
impl AsyncProcessor for DataProcessor {
    type Item = String;
    type Error = String;

    async fn process(&self, item: Self::Item) -> Result<Self::Item, Self::Error> {
        tokio::time::sleep(Duration::from_millis(10)).await;
        Ok(item.to_uppercase())
    }
}

// Future trait implementation
pub struct CustomFuture {
    completed: bool,
}

impl Future for CustomFuture {
    type Output = i32;

    fn poll(
        mut self: Pin<&mut Self>,
        _cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<Self::Output> {
        if self.completed {
            std::task::Poll::Ready(42)
        } else {
            self.completed = true;
            std::task::Poll::Pending
        }
    }
}

// Async closure (experimental)
pub async fn async_closure_example() {
    let async_closure = |x: i32| async move {
        tokio::time::sleep(Duration::from_millis(x as u64)).await;
        x * 2
    };

    let result = async_closure(100).await;
    println!("Async closure result: {}", result);
}

// Channel communication
pub async fn channel_example() {
    let (tx, mut rx) = mpsc::channel(10);

    // Spawn sender task
    let sender = tokio::spawn(async move {
        for i in 0..5 {
            tx.send(i).await.unwrap();
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
    });

    // Spawn receiver task
    let receiver = tokio::spawn(async move {
        while let Some(value) = rx.recv().await {
            println!("Received: {}", value);
        }
    });

    // Wait for both tasks
    let _ = tokio::join!(sender, receiver);
}

// Concurrent processing with semaphore
pub async fn concurrent_processing() {
    let semaphore = Arc::new(Semaphore::new(3)); // Limit to 3 concurrent tasks
    let mut tasks = Vec::new();

    for i in 0..10 {
        let permit = semaphore.clone().acquire_owned().await.unwrap();
        let task = tokio::spawn(async move {
            // Simulate work
            tokio::time::sleep(Duration::from_millis(100)).await;
            println!("Task {} completed", i);
            drop(permit); // Release semaphore
        });
        tasks.push(task);
    }

    // Wait for all tasks
    for task in tasks {
        task.await.unwrap();
    }
}

// Shared state with Arc and Mutex
pub async fn shared_state_example() {
    let counter = Arc::new(Mutex::new(0));
    let mut handles = Vec::new();

    for _ in 0..10 {
        let counter = Arc::clone(&counter);
        let handle = tokio::spawn(async move {
            let mut num = counter.lock().unwrap();
            *num += 1;
        });
        handles.push(handle);
    }

    for handle in handles {
        handle.await.unwrap();
    }

    println!("Final counter value: {}", *counter.lock().unwrap());
}

// RwLock for reader-writer scenarios
pub async fn rwlock_example() {
    let data = Arc::new(RwLock::new(vec![1, 2, 3, 4, 5]));
    let mut handles = Vec::new();

    // Reader tasks
    for i in 0..3 {
        let data = Arc::clone(&data);
        let handle = tokio::spawn(async move {
            let reader = data.read().unwrap();
            println!("Reader {}: {:?}", i, *reader);
        });
        handles.push(handle);
    }

    // Writer task
    let data_clone = Arc::clone(&data);
    let writer_handle = tokio::spawn(async move {
        tokio::time::sleep(Duration::from_millis(50)).await;
        let mut writer = data_clone.write().unwrap();
        writer.push(6);
        println!("Writer: Added element 6");
    });
    handles.push(writer_handle);

    for handle in handles {
        handle.await.unwrap();
    }
}

// Timeout and cancellation
pub async fn timeout_example() {
    let future = async {
        tokio::time::sleep(Duration::from_secs(2)).await;
        "Completed"
    };

    match tokio::time::timeout(Duration::from_secs(1), future).await {
        Ok(result) => println!("Result: {}", result),
        Err(_) => println!("Timed out!"),
    }
}

// Select! macro for racing futures
pub async fn select_example() {
    let future1 = async {
        tokio::time::sleep(Duration::from_millis(100)).await;
        "Future 1"
    };

    let future2 = async {
        tokio::time::sleep(Duration::from_millis(200)).await;
        "Future 2"
    };

    tokio::select! {
        result = future1 => println!("First: {}", result),
        result = future2 => println!("Second: {}", result),
    }
}

// Stream processing
use futures::stream::{self, StreamExt};

pub async fn stream_example() {
    let stream = stream::iter(0..10)
        .map(|x| async move {
            tokio::time::sleep(Duration::from_millis(10)).await;
            x * 2
        })
        .buffer_unordered(3); // Process up to 3 items concurrently

    let results: Vec<i32> = stream.collect().await;
    println!("Stream results: {:?}", results);
}

// Pinning and unsafe futures
pub async fn pinning_example() {
    let mut future = CustomFuture { completed: false };
    let pinned = Pin::new(&mut future);

    // In practice, you'd use this with manual polling
    println!("Custom future ready");
}

// Async recursion (requires Box<Pin<>>)
pub fn async_recursive(n: u32) -> Pin<Box<dyn Future<Output = u32> + Send>> {
    Box::pin(async move {
        if n == 0 {
            1
        } else {
            n * async_recursive(n - 1).await
        }
    })
}

// Integration with blocking code
pub async fn blocking_integration() {
    let result = tokio::task::spawn_blocking(|| {
        // Simulate CPU-intensive work
        thread::sleep(Duration::from_millis(100));
        42
    }).await.unwrap();

    println!("Blocking result: {}", result);
}

// Main async function
#[tokio::main]
pub async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("Starting async examples...");

    let data = fetch_data("https://example.com").await?;
    println!("Fetched: {}", data);

    channel_example().await;
    concurrent_processing().await;
    shared_state_example().await;
    rwlock_example().await;
    timeout_example().await;
    select_example().await;
    stream_example().await;
    blocking_integration().await;

    let factorial = async_recursive(5).await;
    println!("Async factorial: {}", factorial);

    Ok(())
}

// Additional comprehensive async/await patterns for semantic index testing

// Async move blocks
pub async fn async_move_patterns() {
    let data = vec![1, 2, 3, 4, 5];

    // Basic async move block
    let future1 = async move {
        let sum: i32 = data.iter().sum();
        sum * 2
    };

    // Async move block with captured variables
    let multiplier = 10;
    let future2 = async move {
        let result = future1.await;
        result * multiplier
    };

    let final_result = future2.await;
    println!("Async move result: {}", final_result);
}

// Complex await expressions
pub async fn complex_await_expressions() {
    // Chained method calls after await
    let result1 = fetch_data("url").await.unwrap().to_uppercase();

    // Await with try operator
    let result2 = fetch_data("url").await?;

    // Nested await expressions
    let result3 = process_async(
        fetch_data("inner").await?,
        |x| async { x.len() }.await
    ).await;

    // Await on complex expressions
    let result4 = (async {
        tokio::time::sleep(Duration::from_millis(10)).await;
        42
    }).await;

    // Await with pattern matching
    match fetch_data("pattern").await {
        Ok(data) => println!("Got data: {}", data),
        Err(e) => eprintln!("Error: {:?}", e),
    }
}

// Try expressions with async/await
pub async fn try_with_await_patterns() -> Result<String, Box<dyn std::error::Error>> {
    // Try operator on await expression
    let data = fetch_data("test").await?;

    // Complex try-await chains
    let processed = process_async(data, |x| x.to_uppercase()).await?;

    // Try operator in async block
    let result = async {
        let step1 = fetch_data("step1").await?;
        let step2 = process_async(step1, |x| format!("processed: {}", x)).await?;
        Ok::<String, Box<dyn std::error::Error>>(step2)
    }.await?;

    Ok(result)
}

// Async closures (experimental feature)
pub async fn async_closure_patterns() {
    // Basic async closure
    let async_closure = |x: i32| async move {
        tokio::time::sleep(Duration::from_millis(x as u64)).await;
        x * 2
    };

    // Async closure with complex body
    let complex_async_closure = |data: Vec<i32>| async move {
        let mut results = Vec::new();
        for item in data {
            let processed = async { item * item }.await;
            results.push(processed);
        }
        results
    };

    // Using async closures
    let result1 = async_closure(100).await;
    let result2 = complex_async_closure(vec![1, 2, 3, 4]).await;

    println!("Async closure results: {}, {:?}", result1, result2);
}

// Nested async blocks
pub async fn nested_async_blocks() {
    let outer_result = async {
        let inner_result = async {
            tokio::time::sleep(Duration::from_millis(10)).await;
            "inner"
        }.await;

        let another_inner = async move {
            let data = vec![1, 2, 3];
            data.len()
        }.await;

        format!("{}-{}", inner_result, another_inner)
    }.await;

    println!("Nested async result: {}", outer_result);
}

// Async blocks in different contexts
pub async fn async_blocks_in_contexts() {
    // Async block as function argument
    tokio::spawn(async {
        println!("Spawned async block");
    });

    // Async block in match expression
    let value = 42;
    match value {
        42 => {
            let result = async {
                tokio::time::sleep(Duration::from_millis(1)).await;
                "matched"
            }.await;
            println!("Match result: {}", result);
        },
        _ => {}
    }

    // Async block in if condition (unusual but valid)
    if async { true }.await {
        println!("Async condition was true");
    }

    // Async block assigned to variable
    let future_var = async {
        let computation = async { 1 + 1 }.await;
        computation * 10
    };
    let var_result = future_var.await;
    println!("Variable async result: {}", var_result);
}

// Complex try-await-error patterns
pub async fn complex_error_handling() -> Result<(), Box<dyn std::error::Error>> {
    // Try with await in loop
    for i in 0..3 {
        let data = fetch_data(&format!("item-{}", i)).await?;
        println!("Loop item {}: {}", i, data);
    }

    // Try with await in iterator chain
    let results: Result<Vec<_>, _> = (0..5)
        .map(|i| async move {
            fetch_data(&format!("async-{}", i)).await
        })
        .collect::<Vec<_>>()
        .into_iter()
        .map(|f| async { f.await })
        .collect::<Vec<_>>()
        .into_iter()
        .map(|f| f)
        .collect();

    // Multiple ? operators in sequence
    let chain_result = fetch_data("first").await?
        .parse::<i32>()?
        .to_string();

    println!("Chain result: {}", chain_result);
    Ok(())
}

// Async function variations
pub async fn async_with_generics<T: Send + 'static>(item: T) -> T {
    tokio::task::spawn_blocking(move || item).await.unwrap()
}

pub async fn async_with_lifetimes<'a>(data: &'a str) -> &'a str {
    tokio::time::sleep(Duration::from_millis(1)).await;
    data
}

pub async fn async_with_where_clause<T>() -> T
where
    T: Default + Send + 'static,
{
    tokio::task::spawn_blocking(|| T::default()).await.unwrap()
}

// Async unsafe functions
pub async unsafe fn async_unsafe_function() -> i32 {
    tokio::time::sleep(Duration::from_millis(1)).await;
    // Unsafe operations would go here
    42
}

// Async extern functions
pub async extern "C" fn async_extern_function() -> i32 {
    tokio::time::sleep(Duration::from_millis(1)).await;
    42
}