# A base whose members its subclasses override and chain to - model.py
# Tests: a `super` call resolves to the next class declaring the member in the
# method resolution order of each class the call can run on — the parent or an
# ancestor, or a sibling a subclass with several bases puts between them —
# never to the caller's own override or a sibling nothing mixes in


class Model:
    def save(self):
        return None

    def validate(self):
        return True


class Document(Model):
    def render(self):
        return ""
