# Subclasses in another file - widgets.py

from base import Base, Mixin, Mid, Other


class Widget(Base, Mixin):
    def step(self):
        return 2

    def hook(self):
        return 3


class C(Other, Mid):
    pass


def use(c: C):
    return c.deep()
