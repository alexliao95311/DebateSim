# Speech Utilities for DebateSim

This folder contains both **voice-to-text** and **text-to-speech** functionality for the DebateSim project using Google Cloud APIs.

## 📁 Files

### Voice-to-Text (Existing)
- `v2tgenerator.py` - Main voice-to-text implementation with streaming recognition
- `test_v2t.py` - Test script to verify the voice-to-text setup and functionality

### Text-to-Speech (New)
- `tts_service.py` - Core Google Cloud TTS service with 9 Neural2 voices
- `tts_api.py` - FastAPI server providing TTS endpoints
- `test_tts.py` - Comprehensive testing script for TTS functionality
- `start_tts.py` - Easy startup script for the TTS service
- `query_voices.py` - Script to query Google Cloud for actual voice information

## 🎤 Text-to-Speech Features

- **9 High-Quality Neural2 Voices** (male and female)
- **Natural Sounding Speech** with proper intonation and rhythm
- **Voice Selection** - choose from different personalities
- **Automatic Fallback** to browser TTS if Google TTS fails
- **Better Audio Quality** with MP3 encoding
- **Uses Existing Credentials** - no additional setup needed!

## 🔑 Credentials Setup

The system automatically uses your existing Google Cloud credentials from:
```
DebateSim/
├── credentials/
│   └── debatesim-6f403-55fd99aa753a-google-cloud.json  # Your existing credentials
└── speech_utils/
    ├── tts_service.py
    ├── tts_api.py
    ├── test_tts.py
    ├── start_tts.py
    └── query_voices.py
```

**No additional configuration needed** - the system automatically finds your credentials!

## 🚀 Quick Start

### 1. Install Dependencies

```bash
pip install google-cloud-texttospeech fastapi uvicorn
```

### 2. Test TTS Service

```bash
cd speech_utils
python test_tts.py
```

### 3. Start TTS API Server

```bash
cd speech_utils
python start_tts.py
```

### 4. Use in Frontend

```jsx
import EnhancedVoiceOutput from './components/EnhancedVoiceOutput';

<EnhancedVoiceOutput 
  text="Hello world" 
  useGoogleTTS={true}
  ttsApiUrl="http://localhost:8001"
/>
```

## 🎭 Available Voices

### Female Voices 👩
- **en-US-Neural2-C** - Natural female voice (Neural2)
- **en-US-Neural2-E** - Natural female voice (Neural2)
- **en-US-Neural2-F** - Natural female voice (Neural2)
- **en-US-Neural2-G** - Natural female voice (Neural2)
- **en-US-Neural2-H** - Natural female voice (Neural2)

### Male Voices 👨
- **en-US-Neural2-A** - Natural male voice (Neural2) - **Default**
- **en-US-Neural2-D** - Natural male voice (Neural2)
- **en-US-Neural2-I** - Natural male voice (Neural2)
- **en-US-Neural2-J** - Natural male voice (Neural2)

**Total**: 5 Female voices + 4 Male voices = 9 Neural2 voices

## 🔧 API Endpoints

The TTS API provides these endpoints:

- `GET /health` - Check service health
- `GET /voices` - Get available voices
- `POST /synthesize` - Synthesize speech from text
- `GET /test` - Test TTS with sample text

## 🧪 Testing

### Test TTS Service Directly

```bash
cd speech_utils
python test_tts.py
```

### Test TTS API Endpoints

```bash
cd speech_utils
python tts_api.py
# In another terminal:
curl http://localhost:8001/health
curl http://localhost:8001/voices
```

### Query Actual Voice Information

```bash
cd speech_utils
python query_voices.py
```

This will show you the actual voice information from Google Cloud, including correct genders and sample rates.

### Comprehensive Test Suite

```bash
cd speech_utils
python test_tts.py
```

This will test:
- ✅ Google Cloud credentials
- ✅ Text-to-Speech API access
- ✅ Voice synthesis
- ✅ API endpoints

## 🔒 Security

- **No API keys in frontend** - All credentials stay on the backend
- **Uses existing service account** - No additional credentials needed
- **Automatic fallback** - Falls back to browser TTS if Google TTS fails

## 📱 Browser Compatibility

- ✅ **Chrome/Edge**: Full Google TTS support
- ✅ **Firefox**: Google TTS + fallback to browser TTS
- ✅ **Safari**: Google TTS + fallback to browser TTS
- ⚠️ **Mobile browsers**: May have limited TTS support

## 🎨 Customization

### Add Custom Voices

Edit `tts_service.py`:

```python
self.voices = [
    # ... existing voices ...
    {
        "name": "en-US-Neural2-K",
        "language": "en-US",
        "gender": "FEMALE",
        "description": "Custom voice description"
    }
]
```

### Custom Voice Settings

```python
audio_content = tts_service.synthesize_speech(
    text="Custom text",
    voice_name="en-US-Neural2-A",
    rate=0.8,        # Slower speech
    pitch=-2,         # Lower pitch
    volume=0.9        # Slightly quieter
)
```

## 🔄 Migration from Old TTS

Replace the old `VoiceOutput` with `EnhancedVoiceOutput`:

```jsx
// Before
<VoiceOutput text="Hello world" />

// After  
<EnhancedVoiceOutput 
  text="Hello world" 
  useGoogleTTS={true}
  ttsApiUrl="http://localhost:8001"
/>
```

## 🛠️ Troubleshooting

### Common Issues

1. **"Failed to initialize TTS service"**
   - Check if `credentials/debatesim-6f403-55fd99aa753a-google-cloud.json` exists in the root directory
   - Verify the service account has Text-to-Speech permissions
   - Ensure Text-to-Speech API is enabled in your Google Cloud project

2. **"Connection test failed"**
   - Check if Text-to-Speech API is enabled
   - Verify billing is enabled on your Google Cloud project
   - Check service account permissions

3. **"Could not connect to TTS API"**
   - Start the TTS API server: `python tts_api.py`
   - Check if port 8001 is available
   - Verify the server is running and accessible

### Testing Your Setup

Run the comprehensive test suite:

```bash
cd speech_utils
python test_tts.py
```

## 📞 Support

If you encounter issues:

1. Run `python test_tts.py` to diagnose problems
2. Run `python query_voices.py` to verify voice information
3. Check the backend TTS API server logs
4. Verify Google Cloud project settings
5. Check service account permissions

## 🎉 What's Next?

After setting up Google TTS, you can:

1. **Customize voices** for different debate personas
2. **Add SSML markup** for better speech control
3. **Implement voice caching** to reduce API calls
4. **Add multilingual support** for international debates
5. **Integrate with existing debate components** for enhanced user experience 