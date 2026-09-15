# A subclass declaring the hook, and a constructor chaining to a base with none - json_handler.py

from handler import Handler


class JsonHandler(Handler):
    def __init__(self):
        super().__init__()

    def handle(self):
        return "json"

    def close(self):
        return None
