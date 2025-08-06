import pyaudio
import os
from six.moves import queue
from google.cloud import speech
import threading
import time

RATE = 16000
CHUNK = int(RATE / 10)  # 100ms chunks

class MicStream:
    """Microphone stream for real-time speech recognition"""
    def __init__(self, rate, chunk):
        self._rate = rate
        self._chunk = chunk
        self._buff = queue.Queue()
        self.closed = True
        self._audio = pyaudio.PyAudio()
        self._stream = None

    def __enter__(self):
        self._stream = self._audio.open(
            format=pyaudio.paInt16,
            channels=1,
            rate=self._rate,
            input=True,
            frames_per_buffer=self._chunk,
            stream_callback=self._fill_buffer,
        )
        self.closed = False
        return self

    def __exit__(self, type, value, traceback):
        self.closed = True
        if self._stream:
            self._stream.stop_stream()
            self._stream.close()
        self._audio.terminate()

    def _fill_buffer(self, in_data, frame_count, time_info, status_flags):
        """Continuously collect data from the audio stream"""
        self._buff.put(in_data)
        return None, pyaudio.paContinue

    def generator(self):
        """Generate audio chunks from the microphone"""
        while not self.closed:
            try:
                data = self._buff.get(timeout=1)
                if data is None:
                    return
                yield data
            except queue.Empty:
                continue

def print_server(responses):
    """Print server logs/responses"""
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

def setup_credentials():
    """Setup Google Cloud credentials"""
    # Use Google Cloud credentials for Speech API
    # Look for credentials in parent directory since we're in speech_utils folder
    parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    credentials_path = os.path.join(parent_dir, "credentials", "debatesim-6f403-55fd99aa753a-google-cloud.json")
    
    if os.path.exists(credentials_path):
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = credentials_path
        print(f"✅ Using Google Cloud credentials: {credentials_path}")
        return True
    else:
        print(f"Google Cloud credentials file not found at: {credentials_path}")
        print("Please place your Google Cloud JSON credentials file in the credentials/ directory")
        return False

def test_speech_recognition():
    """Test the speech recognition functionality"""
    if not setup_credentials():
        return False

    try:
        # Initialize the client
        client = speech.SpeechClient()
        print("✅ Google Cloud Speech client initialized")

        # Configure the recognition
        config = speech.RecognitionConfig(
            encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
            sample_rate_hertz=RATE,
            language_code="en-US",
            enable_automatic_punctuation=True,
        )

        # Configure streaming recognition
        streaming_config = speech.StreamingRecognitionConfig(
            config=config, interim_results=True
        )

        print("🎤 Starting microphone stream...")
        print("Speak into your microphone (press Ctrl+C to stop)")

        with MicStream(RATE, CHUNK) as stream:
            # Create requests generator with proper error handling
            def request_generator():
                try:
                    for chunk in stream.generator():
                        if chunk is None:
                            break
                        # Ensure chunk is bytes
                        if isinstance(chunk, bytes):
                            # Use the correct field name for audio content
                            yield speech.StreamingRecognizeRequest(audio_content=chunk)
                        else:
                            print(f"Warning: Skipping non-bytes chunk: {type(chunk)}")
                except Exception as e:
                    print(f"Error in request generator: {e}")
                    raise

            # Start streaming recognition with proper error handling
            try:
                requests = request_generator()
                responses = client.streaming_recognize(streaming_config, requests)
                
                # Process responses
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
                        
            except Exception as e:
                print(f"Error in streaming recognition: {e}")
                import traceback
                traceback.print_exc()
                return False

    except KeyboardInterrupt:
        print("\n Speech recognition stopped by user")
        return True
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return False

    return True

if __name__ == "__main__":
    print("Google Cloud Voice-to-Text Test")
    print("=" * 40)
    test_speech_recognition()
