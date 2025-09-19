# Test fixture: Python scope hierarchy and variable resolution

# Module-level scope
module_var = "module"
_private_module_var = "private"

def module_function():
    """Module-level function."""
    return module_var

class ModuleClass:
    """Module-level class."""
    class_var = "class"

# Function scope
def outer_function(outer_param):
    """Outer function with nested scopes."""
    outer_var = "outer"

    def inner_function(inner_param):
        """Inner function accessing outer scope."""
        inner_var = "inner"

        def deeply_nested():
            """Deeply nested function."""
            deep_var = "deep"
            # Accessing all outer scopes
            return f"{module_var}-{outer_var}-{inner_var}-{deep_var}"

        # Using nonlocal to modify outer variable
        nonlocal outer_var
        outer_var = "modified_outer"

        return deeply_nested()

    def another_inner():
        """Another inner function."""
        # Accessing outer parameter
        return outer_param + "_processed"

    # Local class definition
    class LocalClass:
        """Class defined within function."""

        def method(self):
            """Method accessing outer scope."""
            return outer_var

    return inner_function, another_inner, LocalClass

# Class scope hierarchy
class OuterClass:
    """Outer class with nested definitions."""
    outer_class_var = "outer_class"

    def __init__(self):
        self.instance_var = "instance"

    class InnerClass:
        """Inner class with its own scope."""
        inner_class_var = "inner_class"

        def __init__(self):
            self.inner_instance = "inner_instance"

        def access_outer(self):
            """Try to access outer class (requires instance)."""
            # Note: Can't directly access OuterClass variables
            return self.inner_instance

        class DeeplyNestedClass:
            """Deeply nested class."""
            deep_var = "deep"

    def create_closure(self):
        """Method creating a closure."""
        method_var = "method_local"

        def closure():
            """Closure accessing instance and local variables."""
            return f"{self.instance_var}-{method_var}"

        return closure

# Comprehension scopes
list_comp = [x for x in range(10) if x % 2 == 0]
dict_comp = {k: v for k, v in enumerate(range(5))}
set_comp = {x * 2 for x in range(5)}
gen_exp = (x ** 2 for x in range(10))

# Nested comprehensions
matrix = [[i * j for j in range(3)] for i in range(3)]

# Comprehension with outer variable access
factor = 10
scaled_list = [x * factor for x in range(5)]

# Loop scopes
for i in range(3):
    loop_var = f"iteration_{i}"
    # i and loop_var exist after loop in Python

while True:
    while_var = "while_scope"
    break
# while_var exists after loop

# Exception handling scopes
try:
    try_var = "try_block"
    risky_operation = 10 / 2
except Exception as e:
    except_var = "except_block"
    # e is scoped to except block
else:
    else_var = "else_block"
finally:
    finally_var = "finally_block"

# All block variables exist after blocks in Python
accessible = [try_var, except_var, else_var, finally_var]

# With statement scope
class ContextManager:
    """Custom context manager."""

    def __enter__(self):
        return "context_value"

    def __exit__(self, exc_type, exc_val, exc_tb):
        pass

with ContextManager() as ctx:
    with_var = "with_scope"
    context_value = ctx

# with_var and context_value exist after with block

# Global and nonlocal keywords
global_var = "global"

def modify_global():
    """Function modifying global variable."""
    global global_var
    global_var = "modified_global"
    local_var = "local"

    def modify_nonlocal():
        """Nested function modifying enclosing scope."""
        nonlocal local_var
        local_var = "modified_local"

        def modify_global_nested():
            """Deeply nested function modifying global."""
            global global_var
            global_var = "deeply_modified_global"

        modify_global_nested()
        return local_var

    return modify_nonlocal()

# Lambda scope
lambda_in_loop = []
for i in range(3):
    # Classic closure problem - i is captured by reference
    lambda_in_loop.append(lambda: i)

# Fixed version with default parameter
lambda_fixed = []
for i in range(3):
    lambda_fixed.append(lambda x=i: x)

# Class scope special cases
class ScopeDemo:
    """Class demonstrating scope edge cases."""

    x = 10
    # List comprehension in class body doesn't see class variables
    # This would fail: squares = [x ** 2 for _ in range(3)]

    # But this works (using parameter)
    squares = (lambda x: [x ** 2 for _ in range(3)])(x)

    def method(self):
        """Method can access class variables through self."""
        return self.x

# Conditional scope (variables leak out)
if True:
    conditional_var = "exists"

# conditional_var is accessible here
result = conditional_var

# Match statement scope (Python 3.10+)
value = ("point", 10, 20)

# match value:
#     case ("point", x, y):
#         match_var = f"Point at {x}, {y}"
#     case _:
#         match_var = "Unknown"

# match_var would exist after match statement

# Decorator scope
def decorator_with_params(param):
    """Decorator with parameters."""
    decorator_var = f"decorator_{param}"

    def decorator(func):
        """Actual decorator."""
        def wrapper(*args, **kwargs):
            """Wrapper function."""
            # Can access decorator_var and param
            print(f"Decorated with {decorator_var}")
            return func(*args, **kwargs)
        return wrapper
    return decorator

@decorator_with_params("test")
def decorated_function():
    """Function with parameterized decorator."""
    return "decorated"

# Complex scope chain
def create_scope_chain():
    """Create a complex scope chain."""
    level1 = "L1"

    def level2():
        level2_var = "L2"

        def level3():
            level3_var = "L3"

            def level4():
                level4_var = "L4"
                # Access all levels
                return [level1, level2_var, level3_var, level4_var]

            return level4

        return level3

    return level2

# Execute the chain
chain = create_scope_chain()()()()

# Scope in generators
def generator_with_scope():
    """Generator maintaining its own scope."""
    gen_var = 0

    while gen_var < 5:
        # Yield creates suspension point but maintains scope
        received = yield gen_var
        if received is not None:
            gen_var = received
        else:
            gen_var += 1

gen = generator_with_scope()

# Async scope
async def async_scope():
    """Async function with its own scope."""
    async_var = "async"

    async def nested_async():
        """Nested async function."""
        return async_var

    return await nested_async()