"""Consumer module that imports from re-export modules."""

from .reexport_middle import get_retail_months
from .reexport_middle import aliased_forecast


def use_retail_months():
    """Calls the re-exported function."""
    months = get_retail_months()
    return months


def use_aliased():
    """Calls the aliased re-exported function."""
    forecast = aliased_forecast()
    return forecast
