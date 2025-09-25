# Test fixture: Python functions, decorators, and generators

# Simple function
def simple_function():
    """A simple function with no parameters."""
    return "simple"

# Function with parameters
def function_with_params(a, b, c):
    """Function with multiple parameters."""
    return a + b + c

# Function with default parameters
def function_with_defaults(a, b=10, c=20):
    """Function with default parameter values."""
    return a + b + c

# Function with keyword-only parameters
def function_with_kwargs(a, b, *, keyword_only, another=None):
    """Function with keyword-only parameters."""
    return (a, b, keyword_only, another)

# Function with *args and **kwargs
def function_with_splats(*args, **kwargs):
    """Function accepting variable arguments."""
    return args, kwargs

# Function with mixed parameters
def complex_function(pos1, pos2, /, pos_or_kw, *, kw_only, **kwargs):
    """Function with all parameter types."""
    return {
        'positional': (pos1, pos2),
        'pos_or_kw': pos_or_kw,
        'kw_only': kw_only,
        'kwargs': kwargs
    }

# Lambda functions
simple_lambda = lambda x: x * 2
multi_param_lambda = lambda x, y: x + y
conditional_lambda = lambda x: "positive" if x > 0 else "non-positive"

# Nested functions and closures
def outer_function(x):
    """Outer function demonstrating closures."""

    def inner_function(y):
        """Inner function accessing outer scope."""
        return x + y

    def another_inner():
        """Another nested function."""
        nonlocal x
        x += 1
        return x

    return inner_function, another_inner

# Decorators
def my_decorator(func):
    """A simple decorator."""

    def wrapper(*args, **kwargs):
        print(f"Calling {func.__name__}")
        result = func(*args, **kwargs)
        print(f"Called {func.__name__}")
        return result

    return wrapper

@my_decorator
def decorated_function():
    """A decorated function."""
    return "decorated"

# Parameterized decorator
def repeat(times):
    """Decorator with parameters."""

    def decorator(func):
        def wrapper(*args, **kwargs):
            results = []
            for _ in range(times):
                results.append(func(*args, **kwargs))
            return results

        return wrapper

    return decorator

@repeat(3)
def repeated_function():
    """Function decorated with parameterized decorator."""
    return "repeated"

# Multiple decorators
@my_decorator
@repeat(2)
def multi_decorated():
    """Function with multiple decorators."""
    return "multi"

# Generator function
def simple_generator():
    """A simple generator function."""
    yield 1
    yield 2
    yield 3

def parameterized_generator(n):
    """Generator with parameters."""
    for i in range(n):
        yield i * 2

# Generator with return
def generator_with_return():
    """Generator that also returns a value."""
    yield 1
    yield 2
    return "done"

# Async functions
async def async_function():
    """An async function."""
    return "async"

async def async_with_await(other_coro):
    """Async function that awaits another coroutine."""
    result = await other_coro
    return f"awaited: {result}"

# Async generator
async def async_generator():
    """An async generator function."""
    for i in range(3):
        yield i

# Recursive function
def factorial(n):
    """Recursive factorial function."""
    if n <= 1:
        return 1
    return n * factorial(n - 1)

# Higher-order functions
def apply_twice(func):
    """Higher-order function that applies another function twice."""

    def wrapper(x):
        return func(func(x))

    return wrapper

def add_one(x):
    """Simple function to use with higher-order functions."""
    return x + 1

add_two = apply_twice(add_one)

# Function annotations
def annotated_function(x: int, y: str) -> str:
    """Function with type annotations."""
    return f"{y}: {x}"

def complex_annotations(
    items: list[int],
    mapping: dict[str, any],
    optional: int | None = None
) -> tuple[list, dict]:
    """Function with complex type annotations."""
    return items, mapping

# Partial functions using closures
def make_adder(n):
    """Factory function creating adder functions."""

    def adder(x):
        return x + n

    return adder

add_five = make_adder(5)
add_ten = make_adder(10)

# Function calls
result1 = simple_function()
result2 = function_with_params(1, 2, 3)
result3 = function_with_defaults(5)
result4 = function_with_kwargs(1, 2, keyword_only="required")

# Lambda calls
lambda_result = simple_lambda(10)
lambda_result2 = multi_param_lambda(5, 3)

# Generator usage
gen = simple_generator()
values = list(gen)

# Decorator usage
decorated_result = decorated_function()
repeated_result = repeated_function()

# Recursive call
fact_5 = factorial(5)