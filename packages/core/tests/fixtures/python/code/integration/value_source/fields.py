# django/db/models/fields/__init__.py shape - fields.py


class CharField:
    def __init__(self, **kwargs):
        self.kwargs = kwargs


class TypedChoiceField:
    def __init__(self, **kwargs):
        self.kwargs = kwargs


class Field:
    def formfield(self, form_class=None, choices_form_class=None, **kwargs):
        defaults = {"required": True}
        if choices_form_class is not None:
            form_class = choices_form_class
        else:
            form_class = TypedChoiceField
        defaults.update(kwargs)
        if form_class is None:
            form_class = CharField
        return form_class(**defaults)
