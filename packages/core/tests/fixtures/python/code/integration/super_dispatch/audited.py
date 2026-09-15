# A second override of the base's member, reached only through a subclass that mixes it in - audited.py

from model import Model


class Audited(Model):
    def save(self):
        return "audited"
