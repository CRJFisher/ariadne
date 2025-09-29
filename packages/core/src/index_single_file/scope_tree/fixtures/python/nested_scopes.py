"""
Complex Python file with nested scopes for testing
"""

# Module scope - global level
MODULE_CONSTANT = "test"

class OuterClass:
    """Class scope"""

    def __init__(self, param: str):
        """Constructor/method scope"""
        self.field = param

        # Block scope within constructor
        if param:
            local_var = "local"
            print(local_var)

    async def process_data(self, items: list[str]) -> None:
        """Method scope"""

        # Block scope - for loop
        for item in items:
            # Block scope - if statement
            if len(item) > 0:
                processed = item.upper()

                # Block scope - try-except
                try:
                    await self._handle_item(processed)
                except Exception as error:
                    print(f"Error: {error}")

                    # Block scope - nested if
                    if isinstance(error, ValueError):
                        raise RuntimeError(f"Failed to process: {error}")

    def _handle_item(self, item: str) -> None:
        """Private method scope"""

        # Nested function scope
        def helper(x: str) -> str:
            # Function scope within method
            if x.startswith("test"):
                return x.upper()
            else:
                return x.lower()

        result = helper(item)
        print(result)

    @staticmethod
    def create_default() -> 'OuterClass':
        """Static method scope"""
        return OuterClass("default")

    @classmethod
    def create_from_config(cls, config: dict) -> 'OuterClass':
        """Class method scope"""
        return cls(config.get("param", "default"))

def module_function(param: int) -> str:
    """Function scope at module level"""

    # Nested function
    def format_number(num: int) -> str:
        """Nested function scope"""

        # Block scope - match statement (Python 3.10+)
        if num == 1:
            result = "one"
            return result
        elif num == 2:
            result = "two"
            return result
        else:
            result = str(num)
            return result

    return format_number(param)

class InnerProcessor:
    """Nested class scope"""

    async def process(self, data) -> None:
        """Method scope in nested class"""

        # Block scope - while loop
        counter = 0
        while counter < 10:
            # Block scope within while
            if counter % 2 == 0:
                await self._process_even(counter)
            else:
                await self._process_odd(counter)
            counter += 1

    async def _process_even(self, num: int) -> None:
        """Method scope"""

        # Lambda function
        helper = lambda x: x * 2
        print(helper(num))

    async def _process_odd(self, num: int) -> None:
        """Method scope"""

        # Nested function with closure
        def helper(x: int) -> int:
            multiplier = 3  # Closure variable
            return x * multiplier

        print(helper(num))

# Generator function scope
def number_generator(start: int, end: int):
    """Generator function scope"""
    for i in range(start, end):
        # Block scope within generator
        if i % 2 == 0:
            yield i * 2
        else:
            yield i * 3

# Decorator function scope
def timing_decorator(func):
    """Decorator function scope"""
    import time

    def wrapper(*args, **kwargs):
        """Wrapper function scope"""
        start_time = time.time()

        try:
            result = func(*args, **kwargs)
            return result
        finally:
            end_time = time.time()
            print(f"Function took {end_time - start_time} seconds")

    return wrapper

# Context manager scope
class CustomContext:
    """Context manager class scope"""

    def __enter__(self):
        """Enter method scope"""
        print("Entering context")
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Exit method scope"""

        # Block scope - if statement
        if exc_type is not None:
            print(f"Exception occurred: {exc_val}")
            return False

        print("Exiting context normally")
        return True

# List comprehension (creates its own scope)
squared_numbers = [x**2 for x in range(10) if x % 2 == 0]

# Dictionary comprehension scope
number_map = {str(x): x**2 for x in range(5)}

# With statement creates block scope
with CustomContext() as ctx:
    # Block scope within with
    temp_var = "temporary"
    print(f"Inside context: {temp_var}")