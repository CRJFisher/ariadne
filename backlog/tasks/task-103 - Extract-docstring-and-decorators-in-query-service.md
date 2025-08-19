---
id: task-103
title: Extract docstring and decorators in query service
status: To Do
assignee: []
created_date: '2025-08-05 13:47'
labels:
  - enhancement
dependencies: []
---

## Description

The query_service.ts has a TODO to extract docstring and decorators based on language when getting symbol metadata. Currently it returns empty values for these fields.

## Acceptance Criteria

- [ ] Docstring extraction implemented for supported languages
- [ ] Decorator extraction implemented for supported languages
- [ ] Language-specific logic properly handles different syntax
- [ ] Tests verify extraction works correctly
- [ ] Fix docstring boundary detection to not include code beyond the docstring

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
