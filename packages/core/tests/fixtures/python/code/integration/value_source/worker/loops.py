# celery/worker/loops.py shape - loops.py


def asynloop(obj, connection, consumer):
    consumer.consume()


def synloop(obj, connection, consumer):
    consumer.consume()
