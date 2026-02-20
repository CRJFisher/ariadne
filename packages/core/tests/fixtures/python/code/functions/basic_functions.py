"""
Basic function definitions
Tests: function declarations, parameters, return values
"""

def greet(name: str) -> str:
    return f"Hello, {name}!"


def add(a: int, b: int) -> int:
    return a + b


def process_user(name: str, age: int, active: bool = True) -> dict:
    return {
        "name": name,
        "age": age,
        "active": active,
    }


def multiple_returns(value: int) -> str:
    if value > 0:
        return "positive"
    elif value < 0:
        return "negative"
    else:
        return "zero"


def call_chain():
    data = fetch_data()
    result = transform_data(data)
    return result


def fetch_data():
    return {"value": 42}


def transform_data(data: dict):
    return data["value"] * 2
