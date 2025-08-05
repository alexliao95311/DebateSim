import pyaudio
from six.moves import queue
from google.cloud import speech

RATE = 16000
CHUNK = int(RATE / 10) # btw this means 100ms