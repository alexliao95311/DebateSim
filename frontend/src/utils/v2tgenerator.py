import pyaudio
from six.moves import queue
from google.cloud import speech

RATE = 16000
CHUNK = int(RATE / 10) # btw this means 100ms

class MicStream:
    """rec system to chunk"""
    def __init__(self, rate, chunk):
        self._rate = rate
        self._chunk = chunk

        self._buff = queue.Queue()
        self.closed = True

def print_server(responses):
    """ prints server logs/responses """
    for response in responses:
        if not response.results:
            continue
        result = response.results[0]

        if not result.alternatives:
            continue
        transcript = result.alternatives[0].transcript

        if result.is_final:
            print(f"Final transcript: {transcript}\n")
        else:
            print(f"Partial transcript: {transcript}", end="\r")
