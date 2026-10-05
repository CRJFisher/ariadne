# Base and mixin bodies calling methods a subclass overrides - base.py
# Tests: `self.m()` in a base or mixin reaching the override, and a member two
# hops up the second base of `class C(Other, Mid)`


class Root:
    def deep(self):
        return 0


class Mid(Root):
    pass


class Other:
    def shallow(self):
        return 0


class Mixin:
    def render(self):
        return self.hook()

    def hook(self):
        return None


class Base:
    def run(self):
        return self.step()

    def step(self):
        return None


class Local(Base):
    def step(self):
        return 1
