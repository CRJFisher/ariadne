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