---
id: TASK-103
title: Extract docstring and decorators in query service
status: Done
assignee: []
created_date: "2025-08-05 13:47"
updated_date: "2026-03-20 14:28"
labels:
  - enhancement
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

The query_service.ts has a TODO to extract docstring and decorators based on language when getting symbol metadata. Currently it returns empty values for these fields.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Docstring extraction implemented for supported languages
- [ ] #2 Decorator extraction implemented for supported languages
- [ ] #3 Language-specific logic properly handles different syntax
- [ ] #4 Tests verify extraction works correctly
- [ ] #5 Fix docstring boundary detection to not include code beyond the docstring

## Known Issues

### Python Docstring Over-extraction

When extracting docstrings from Python methods, the extraction includes too much content beyond the actual docstring.

**Failing Example:**

Given this Python code:

```python
def calculate_mean(self) -> float:
    """Calculate the mean of all data points"""
    if not self.data:
        return 0.0
    return sum(self.data) / len(self.data)

def process_items(items: list) -> dict:
    """Process a list of items and return statistics"""
    return {...}
```

When calling `get_source_code(symbol: "calculate_mean", includeDocstring: true)`, the docstring field returns:

```text
Calculate the mean of all data points"""
    if not self.data:
        return 0.0
    return sum(self.data) / len(self.data)

def process_items(items: list) -> dict:
```

Instead of just:

```text
Calculate the mean of all data points
```

This suggests the docstring extraction is not properly finding the closing triple quotes and is including subsequent code.

<!-- AC:END -->
