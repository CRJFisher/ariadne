# A caller holding the base type, importing neither subclass - dispatch.py

from handler import Handler


def dispatch(handler: Handler):
    return handler.handle()
