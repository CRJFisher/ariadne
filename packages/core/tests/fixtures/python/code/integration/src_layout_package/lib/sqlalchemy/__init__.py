"""The package this project installs from `lib/`, not from the repository root."""


class Column:
    def __init__(self, name):
        self.name = name

    def compile(self):
        return self.name
