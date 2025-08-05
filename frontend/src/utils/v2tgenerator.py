import pyaudio
from six.moves import queue
from google.cloud import speech

RATE = 16000
CHUNK = int(RATE / 10) # btw this means 100ms

class MicrophoneStream:
    """rec system to chunk"""
    def __init__(self, rate, chunk):
        self._rate = rate
        self._chunk = chunk

        self._buff = queue.Queue()
        self.closed = True