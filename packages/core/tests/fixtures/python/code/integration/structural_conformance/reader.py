# A protocol nothing names as a base - reader.py
# Tests: the same member-coverage test answers a Python protocol, with no
# language leaf in `structural_conformance.ts`

from typing import Protocol


class Reader(Protocol):
    def read(self) -> str: ...

    def close(self) -> None: ...

    def seek(self, offset: int) -> None: ...
