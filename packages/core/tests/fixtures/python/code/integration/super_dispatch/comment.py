# A sibling override nothing calls - comment.py

from model import Model


class Comment(Model):
    def save(self):
        return "comment"
