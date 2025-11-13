# Callback patterns for testing callback detection

# Lambda callbacks with built-in functions
numbers = [1, 2, 3, 4, 5]

# Map callback
doubled = list(map(lambda x: x * 2, numbers))

# Filter callback
evens = list(filter(lambda x: x % 2 == 0, numbers))

# Sorted with key callback
sorted_by_negative = sorted(numbers, key=lambda x: -x)

# Internal callbacks - user-defined higher-order function
def run_callback(cb):
    cb()

run_callback(lambda: print("internal callback"))

# List comprehension (not a callback - for comparison)
doubled_comp = [x * 2 for x in numbers]
evens_comp = [x for x in numbers if x % 2 == 0]

# Reduce callback (from functools)
from functools import reduce
sum_result = reduce(lambda acc, x: acc + x, numbers, 0)

# Lambda as default argument (not a callback)
def with_default(func=lambda: "default"):
    return func()

# Lambda in variable assignment (not a callback)
standalone_lambda = lambda x: x + 1
