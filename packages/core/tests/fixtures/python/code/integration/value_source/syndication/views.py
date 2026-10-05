# django/contrib/syndication/views.py shape - views.py

from syndication import feedgenerator


class Store:
    def save(self):
        return None


class Feed:
    feed_type = feedgenerator.DefaultFeed
    store_class = Store

    def __init__(self):
        self.session = Store()

    def get_feed(self):
        feed = self.feed_type()
        feed.add_item("title")
        store = self.store_class()
        store.save()
        self.session.save()
