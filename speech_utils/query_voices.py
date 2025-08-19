#!/usr/bin/env python3
"""
Query Google Cloud TTS for actual voice information
"""

import os
import sys
from google.cloud import texttospeech

def query_voices():
    """Query Google Cloud for available voices"""
    print("🔍 Querying Google Cloud TTS for available voices...")
    print("=" * 60)
    
    try:
        # Set credentials path
        credentials_path = os.path.join(os.path.dirname(__file__), "..", "credentials", "debatesim-6f403-55fd99aa753a-google-cloud.json")
        abs_credentials_path = os.path.abspath(credentials_path)
        
        if not os.path.exists(abs_credentials_path):
            print(f"❌ Credentials not found: {abs_credentials_path}")
            return
        
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = abs_credentials_path
        
        # Create client
        client = texttospeech.TextToSpeechClient()
        print("✅ TTS client created successfully")
        
        # Query for voices
        request = texttospeech.ListVoicesRequest()
        response = client.list_voices(request=request)
        
        # Filter for Neural2 voices
        neural2_voices = []
        for voice in response.voices:
            if "Neural2" in voice.name and voice.language_codes and "en-US" in voice.language_codes:
                neural2_voices.append(voice)
        
        print(f"\n🎭 Found {len(neural2_voices)} Neural2 voices for en-US:")
        print("-" * 60)
        
        for voice in neural2_voices:
            gender = "FEMALE" if voice.ssml_gender == texttospeech.SsmlVoiceGender.FEMALE else "MALE"
            print(f"Name: {voice.name}")
            print(f"Gender: {gender}")
            print(f"Language: {voice.language_codes}")
            print(f"Natural Sample Rate: {voice.natural_sample_rate_hertz}")
            print("-" * 40)
        
        # Generate the correct voice definitions
        print("\n📝 Correct voice definitions for tts_service.py:")
        print("=" * 60)
        print("self.voices = [")
        
        for voice in neural2_voices:
            gender = "FEMALE" if voice.ssml_gender == texttospeech.SsmlVoiceGender.FEMALE else "MALE"
            gender_emoji = "👩" if gender == "FEMALE" else "👨"
            print(f"    {{")
            print(f"        \"name\": \"{voice.name}\",")
            print(f"        \"language\": \"en-US\",")
            print(f"        \"gender\": \"{gender}\",")
            print(f"        \"description\": \"Natural {gender.lower()} voice (Neural2) - {gender_emoji}\"")
            print(f"    }},")
        
        print("]")
        
        # Set default voice
        if neural2_voices:
            default_voice = neural2_voices[0].name
            print(f"\nself.default_voice = \"{default_voice}\"")
        
    except Exception as e:
        print(f"❌ Error querying voices: {e}")

if __name__ == "__main__":
    query_voices()
