"""
Deeply nested module for testing aliased imports.
This module is imported via `import subpkg.nested.deep as deep_mod`
"""


def deep_analysis():
    """Perform deep analysis."""
    return "analysis"
