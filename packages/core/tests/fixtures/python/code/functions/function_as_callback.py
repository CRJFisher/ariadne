def apply_fn(callback, value):
    return callback(value)

def doubler(x):
    return x * 2

def main():
    result = apply_fn(doubler, 21)
