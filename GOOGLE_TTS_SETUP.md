# Google Cloud Text-to-Speech Setup Guide

This guide will help you set up Google Cloud Text-to-Speech (TTS) using your existing credentials to replace the basic browser TTS with high-quality, natural-sounding voices.

## 🎯 What You'll Get

- **9 High-Quality Neural2 Voices** (male and female)
- **Natural Sounding Speech** with proper intonation and rhythm
- **Voice Selection** - choose from different personalities
- **Automatic Fallback** to browser TTS if Google TTS fails
- **Better Audio Quality** with MP3 encoding
- **Uses Your Existing Credentials** - no additional setup needed!

## ✅ What's Already Configured

- **Google Cloud Service Account** - `text2speech@debatesim-6f403.iam.gserviceaccount.com`
- **Credentials File** - `credentials/debatesim-6f403-55fd99aa753a-google-cloud.json`
- **Speech-to-Text API** - Already enabled and working

## 🔧 Setup Steps

### 1. Install Dependencies

Install the Google Cloud Text-to-Speech library:

```bash
pip install google-cloud-texttospeech
```

Or update your existing requirements:

```bash
pip install -r requirements.txt
```

### 2. Test the TTS Service

Test if everything is working with your credentials:

```bash
python test_tts.py
```

This will test both the direct TTS service and the API endpoints.

### 3. Start the TTS API Server

Start the backend TTS service:

```bash
python tts_api.py
```

This will start a FastAPI server on port 8001 that provides TTS functionality to your frontend.

### 4. Test the Frontend

1. Start your frontend development server
2. Navigate to the TTS demo component
3. You should see a voice selector button (🎭)
4. Click it to see available Google TTS voices

## 🎭 Available Voices

The system includes these high-quality Neural2 voices:

### Female Voices
- **en-US-Neural2-A** - Natural female voice (default)
- **en-US-Neural2-E** - Natural female voice
- **en-US-Neural2-F** - Natural female voice
- **en-US-Neural2-H** - Natural female voice

### Male Voices
- **en-US-Neural2-C** - Natural male voice
- **en-US-Neural2-D** - Natural male voice
- **en-US-Neural2-G** - Natural male voice
- **en-US-Neural2-I** - Natural male voice
- **en-US-Neural2-J** - Natural male voice

## 🚀 Usage

### Backend TTS Service

```python
from tts_service import GoogleTTSService

# Initialize service (uses your existing credentials)
tts_service = GoogleTTSService()

# Synthesize speech
audio_content = tts_service.synthesize_speech(
    text="Hello, this is a test!",
    voice_name="en-US-Neural2-A",
    rate=0.9,
    pitch=0,
    volume=1.0
)
```

### Frontend Integration

```jsx
import EnhancedVoiceOutput from './components/EnhancedVoiceOutput';

<EnhancedVoiceOutput 
  text="Hello, this is a test of Google TTS!"
  useGoogleTTS={true}
  ttsApiUrl="http://localhost:8001"
/>
```

### API Endpoints

The TTS API provides these endpoints:

- `GET /health` - Check service health
- `GET /voices` - Get available voices
- `POST /synthesize` - Synthesize speech from text
- `GET /test` - Test TTS with sample text

## 🔄 Migration from Old TTS

### Replace VoiceOutput with EnhancedVoiceOutput

**Before:**
```jsx
import VoiceOutput from './VoiceOutput';

<VoiceOutput text="Hello world" />
```

**After:**
```jsx
import EnhancedVoiceOutput from './EnhancedVoiceOutput';

<EnhancedVoiceOutput 
  text="Hello world" 
  useGoogleTTS={true}
  ttsApiUrl="http://localhost:8001"
/>
```

### Update Debate.jsx TTS

Replace the basic TTS in `Debate.jsx`:

**Before:**
```jsx
const handlePlay = () => {
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  synth.speak(utterance);
};
```

**After:**
```jsx
import EnhancedVoiceOutput from './EnhancedVoiceOutput';

// Replace the play/stop buttons with:
<EnhancedVoiceOutput 
  text={text}
  useGoogleTTS={true}
  ttsApiUrl="http://localhost:8001"
  buttonStyle="compact"
/>
```

## 💰 Pricing

Google Cloud TTS pricing (as of 2024):
- **Neural2 voices**: $4.00 per 1 million characters
- **Standard voices**: $4.00 per 1 million characters
- **WaveNet voices**: $16.00 per 1 million characters

**Example**: A typical debate speech (~500 words) costs about **$0.01**

## 🛠️ Troubleshooting

### Common Issues

1. **"Failed to initialize TTS service"**
   - Check if `credentials/debatesim-6f403-55fd99aa753a-google-cloud.json` exists
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

4. **No voice selector appears**
   - Check if backend TTS API is running
   - Verify `ttsApiUrl` is correct
   - Check browser console for errors

### Testing Your Setup

Run the comprehensive test suite:

```bash
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

## 📞 Support

If you encounter issues:

1. Run `python test_tts.py` to diagnose problems
2. Check the backend TTS API server logs
3. Verify Google Cloud project settings
4. Check service account permissions

## 🎉 What's Next?

After setting up Google TTS, you can:

1. **Customize voices** for different debate personas
2. **Add SSML markup** for better speech control
3. **Implement voice caching** to reduce API calls
4. **Add multilingual support** for international debates
5. **Integrate with existing debate components** for enhanced user experience
