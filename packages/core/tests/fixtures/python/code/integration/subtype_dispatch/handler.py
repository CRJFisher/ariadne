# An abstract base that calls a hook only its subclasses declare - handler.py
# Tests: a miss on the base fans out over the subtypes that declare the
# member; a constructor miss and a `super` miss never fan out


class Handler:
    def run(self):
        return self.handle()
