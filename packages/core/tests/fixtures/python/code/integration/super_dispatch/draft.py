# A subclass with two bases under one parent, so `super()` in the first runs the second - draft.py

from article import Article
from audited import Audited


class Draft(Article, Audited):
    pass
