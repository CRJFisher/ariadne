"""Every decorator shape the grammar admits on a method: bare, dotted,
call-shaped, dotted-call-shaped, and the accessor pair."""

import functools
from functools import lru_cache

import cython
import util
import mod


class DecoratorShapes:
    @property
    def data(self):
        return self._data

    @data.setter
    def data(self, value):
        self._data = value

    @staticmethod
    def build():
        return DecoratorShapes()

    @classmethod
    def create(cls):
        return cls()

    @cython.cfunc
    def compiled(self):
        return 1

    @util.memoized_property
    def memoized(self):
        return 2

    @functools.lru_cache()
    def cached(self):
        return 3

    @lru_cache(maxsize=1)
    def cached_bounded(self):
        return 4

    @mod.dec(arg=1)
    def dotted_call(self):
        return 5

    def plain(self):
        return self.data
