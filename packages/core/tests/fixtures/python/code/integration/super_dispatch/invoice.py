# An override chaining past a parent that inherits the member from its own base - invoice.py

from model import Document


class Invoice(Document):
    def validate(self):
        return super().validate()
