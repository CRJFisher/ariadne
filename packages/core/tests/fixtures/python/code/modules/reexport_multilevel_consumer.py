"""Consumer that imports through multi-level re-export chain."""

from .reexport_top import get_retail_months


def use_deep_reexport():
    """Calls function that went through multiple re-export levels."""
    months = get_retail_months()
    return months
