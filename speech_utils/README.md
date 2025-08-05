# Speech Utilities

This folder contains the voice-to-text functionality for the DebateSim project using Google Cloud Speech-to-Text API.

## 📁 Files

- `v2tgenerator.py` - Main voice-to-text implementation with streaming recognition
- `test_v2t.py` - Test script to verify the setup and functionality
- `README.md` - This documentation file

## 🚀 Quick Start

### Prerequisites

1. **Python Environment**: Make sure you have Python 3.9+ and a virtual environment
2. **Google Cloud Project**: Set up a Google Cloud project with Speech-to-Text API enabled
3. **Service Account**: Create a service account with Speech-to-Text permissions

### Installation

1. **Install Dependencies**:
   ```bash
   pip install pyaudio google-cloud-speech six
   ```

2. **Set up Credentials**:
   - Place your Google Cloud service account JSON file in the `credentials/` directory
   - The file should be named: `debatesim-6f403-55fd99aa753a-google-cloud.json`
   - Ensure the service account has `Cloud Speech-to-Text User` role

3. **Test the Setup**:
   ```bash
   cd speech_utils
   python3 test_v2t.py
   ```

## 🔧 Configuration

### Credentials Setup

The system expects Google Cloud credentials at:
```
credentials/debatesim-6f403-55fd99aa753a-google-cloud.json
```

### Environment Variables

The system automatically sets:
```bash
export GOOGLE_APPLICATION_CREDENTIALS="credentials/debatesim-6f403-55fd99aa753a-google-cloud.json"
```

## 📖 Usage

### Basic Voice-to-Text

```python
from speech_utils.v2tgenerator import test_speech_recognition

# Test the speech recognition
success = test_speech_recognition()
if success:
    print("Speech recognition is working!")
```

### Integration with Your Application

```python
from speech_utils.v2tgenerator import MicStream, setup_credentials
from google.cloud import speech

# Setup credentials
setup_credentials()

# Initialize speech client
client = speech.SpeechClient()

# Configure recognition
config = speech.RecognitionConfig(
    encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
    sample_rate_hertz=16000,
    language_code="en-US",
    enable_automatic_punctuation=True,
)

# Use streaming recognition
streaming_config = speech.StreamingRecognitionConfig(
    config=config, interim_results=True
)

# Start microphone stream
with MicStream(16000, 1600) as stream:
    def request_generator():
        for chunk in stream.generator():
            if isinstance(chunk, bytes):
                yield speech.StreamingRecognizeRequest(audio_content=chunk)
    
    requests = request_generator()
    responses = client.streaming_recognize(streaming_config, requests)
    
    for response in responses:
        if response.results:
            result = response.results[0]
            if result.alternatives:
                transcript = result.alternatives[0].transcript
                if result.is_final:
                    print(f"Final: {transcript}")
                else:
                    print(f"Partial: {transcript}")
```

## 🧪 Testing

### Run the Test Suite

```bash
cd speech_utils
python3 test_v2t.py
```

The test will:
1. ✅ Check dependencies (PyAudio, Google Cloud Speech, Six)
2. ✅ Verify credentials are properly set up
3. ✅ Test real-time speech recognition
4. ✅ Provide live transcription feedback

### Expected Output

```
🎯 Google Cloud Voice-to-Text Setup Test
==================================================

1. Checking dependencies...
✅ PyAudio installed
✅ Google Cloud Speech installed
✅ Six library installed

2. Checking credentials...
✅ Google Cloud credentials file found at: credentials/debatesim-6f403-55fd99aa753a-google-cloud.json

3. Testing speech recognition...
✅ Using Google Cloud credentials: credentials/debatesim-6f403-55fd99aa753a-google-cloud.json
✅ Google Cloud Speech client initialized
🎤 Starting microphone stream...
Speak into your microphone (press Ctrl+C to stop)
Partial transcript: Hello, this is a test
Final transcript: Hello, this is a test of the voice recognition system.

✅ Voice-to-Text setup is working correctly!
```

## 🔧 Troubleshooting

### Common Issues

1. **"No module named 'pyaudio'"**
   - Install PyAudio: `pip install pyaudio`
   - On macOS: `brew install portaudio` then `pip install pyaudio`

2. **"Credentials file not found"**
   - Ensure the credentials file exists in the `credentials/` directory
   - Check the filename matches: `debatesim-6f403-55fd99aa753a-google-cloud.json`

3. **"401 Request had invalid authentication credentials"**
   - Verify the service account has Speech-to-Text permissions
   - Check that the Speech-to-Text API is enabled in your Google Cloud project

4. **"None Exception iterating requests!"**
   - This usually indicates a credentials permission issue
   - Use the working credentials file (the one that works for both TTS and STT)

### Microphone Issues

1. **No audio input detected**
   - Check microphone permissions in your OS
   - Ensure the correct input device is selected
   - Test with: `python3 -c "import pyaudio; print(pyaudio.PyAudio().get_default_input_device_info())"`

2. **Poor recognition quality**
   - Speak clearly and at a normal pace
   - Reduce background noise
   - Ensure microphone is working properly

## 🔗 Integration with DebateSim

### Frontend Integration

The voice-to-text functionality can be integrated into your React frontend by:

1. **Creating an API endpoint** in your backend to handle speech recognition
2. **Using WebRTC** for browser-based audio capture
3. **Sending audio data** to the backend for processing

### Backend Integration

```python
# In your main application
from speech_utils.v2tgenerator import setup_credentials, MicStream
from google.cloud import speech

class SpeechRecognitionService:
    def __init__(self):
        setup_credentials()
        self.client = speech.SpeechClient()
    
    def start_recognition(self, callback):
        """Start real-time speech recognition"""
        # Implementation here
        pass
    
    def stop_recognition(self):
        """Stop speech recognition"""
        # Implementation here
        pass
```

## 📋 Requirements

### Python Dependencies
```
pyaudio>=0.2.14
google-cloud-speech>=2.33.0
six>=1.17.0
```

### System Requirements
- **OS**: macOS, Linux, or Windows
- **Python**: 3.9 or higher
- **Microphone**: Working microphone input
- **Internet**: Connection to Google Cloud APIs

### Google Cloud Requirements
- **Project**: Active Google Cloud project
- **API**: Speech-to-Text API enabled
- **Service Account**: With appropriate permissions
- **Billing**: Enabled for the project

## 🔐 Security Notes

- Keep your credentials file secure and never commit it to version control
- Use environment variables for production deployments
- Consider using Google Cloud's Application Default Credentials for production
- Regularly rotate your service account keys

## 📞 Support

If you encounter issues:

1. **Check the troubleshooting section** above
2. **Verify your Google Cloud setup** in the Google Cloud Console
3. **Test with the provided test script** to isolate issues
4. **Check microphone permissions** in your operating system

## 🚀 Next Steps

Once the basic voice-to-text is working:

1. **Integrate with your debate application**
2. **Add real-time transcription display**
3. **Implement speaker identification**
4. **Add language support for multiple languages**
5. **Optimize for debate-specific vocabulary**

---

**Last Updated**: January 2025  
**Version**: 1.0.0  
**Compatibility**: Python 3.9+, Google Cloud Speech API v2 