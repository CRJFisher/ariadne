# The caller: names the protocol only - reader_caller.py

from reader import Reader


def consume(source: Reader) -> str:
    return source.read()
