# Test fixture: Implicit exports in Python

# Public function (implicitly exportable)
def public_function():
    return "public"

# Private function (by convention, starts with underscore)
def _private_function():
    return "private"

# Public class
class PublicClass:
    def method(self):
        pass

# Private class
class _PrivateClass:
    pass

# Public variable
PUBLIC_CONSTANT = 42

# Private variable
_private_variable = "hidden"

# Magic/dunder names
__version__ = "1.0.0"

# Explicit exports via __all__ (when present, controls from module import *)
__all__ = ["public_function", "PublicClass", "PUBLIC_CONSTANT"]