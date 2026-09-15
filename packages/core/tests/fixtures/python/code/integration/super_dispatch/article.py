# An override chaining to the member its parent declares - article.py

from model import Model


class Article(Model):
    def save(self):
        return super().save()
