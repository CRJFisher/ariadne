"""
Dotted subpackage module for testing aliased imports.
This module is imported via `import subpkg.processor as proc`
"""


def process_batch():
    """Process a batch of items."""
    return "processed"


def validate_input():
    """Validate input data."""
    return "validated"
