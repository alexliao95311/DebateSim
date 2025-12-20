# Google Cloud Voice-to-Text Setup Guide

This guide will help you set up Google Cloud Voice-to-Text for the DebateSim project.

## 📁 File Structure

```
DebateSim/
├── credentials/
│   └── google-cloud-credentials.json  # Your Google Cloud JSON file
├── v2tgenerator.py                    # Voice-to-Text implementation
├── test_v2t.py                       # Test script
└── VOICE_TO_TEXT_SETUP.md            # This file
```

## 🔧 Setup Steps

### 1. Install Dependencies

The required packages are already in `requirements.txt`:
```bash
pip install -r requirements.txt
```

### 2. Set Up Google Cloud Credentials

1. **Get your Google Cloud JSON credentials file** from the Google Cloud Console
2. **Place the JSON file** in the `credentials/` directory
3. **Rename it** to `google-cloud-credentials.json`

### 3. Verify Setup

Run the test script to verify everything is working:
```bash
python test_v2t.py
```

## 🔒 Security

- The `credentials/` directory is already added to `.gitignore`
- Your Google Cloud credentials will not be committed to the repository
- The JSON file pattern is also ignored globally

## 🧪 Testing

### Quick Test
```bash
python v2tgenerator.py
```

### Full Test
```bash
python test_v2t.py
```

## 📋 Requirements

- Python 3.7+
- Google Cloud Speech-to-Text API enabled
- Valid Google Cloud service account credentials
- Microphone access

## 🚨 Troubleshooting

### Common Issues:

1. **"Credentials file not found"**
   - Make sure your JSON file is in `credentials/google-cloud-credentials.json`

2. **"PyAudio not installed"**
   - On macOS: `brew install portaudio && pip install pyaudio`
   - On Ubuntu: `sudo apt-get install portaudio19-dev && pip install pyaudio`

3. **"Google Cloud Speech not installed"**
   - Run: `pip install google-cloud-speech`

4. **Microphone access issues**
   - Check your system's microphone permissions
   - Ensure no other applications are using the microphone

## 🔗 Integration

The `v2tgenerator.py` file can be imported and used in your main application:

```python
from v2tgenerator import MicStream, setup_credentials, print_server
```

## 📝 Notes

- The system uses real-time streaming recognition
- Audio is processed in 100ms chunks
- Supports automatic punctuation
- Language is set to English (US) by default 