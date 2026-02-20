fn apply(callback: fn(i32) -> i32, value: i32) -> i32 {
    callback(value)
}

fn main() {
    let doubler = |x: i32| -> i32 { x * 2 };
    let result = apply(doubler, 21);
}
