# django/utils/feedgenerator.py shape - feedgenerator.py


class SyndicationFeed:
    def add_item(self, title):
        return title


class Rss201rev2Feed(SyndicationFeed):
    pass


DefaultFeed = Rss201rev2Feed
