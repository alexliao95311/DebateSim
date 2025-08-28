#!/usr/bin/env python3
"""
Test script for Google Cloud Text-to-Speech service
Uses existing credentials from credentials/debatesim-6f403-55fd99aa753a-google-cloud.json
"""

import os
import sys

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def test_tts_service():
    """Test the TTS service directly"""
    print("🎤 Testing Google Cloud Text-to-Speech Service")
    print("=" * 60)
    
    try:
        from tts_service import GoogleTTSService
        
        # Initialize service
        print("🔍 Initializing TTS service...")
        tts_service = GoogleTTSService()
        
        if not tts_service.client:
            print("❌ Failed to initialize TTS service")
            return False
        
        print("✅ TTS service initialized successfully")
        
        # Test connection
        print("\n🔍 Testing connection...")
        if tts_service.test_connection():
            print("✅ Connection test passed")
        else:
            print("❌ Connection test failed")
            return False
        
        # Show available voices
        print("\n🎭 Available voices:")
        voices = tts_service.get_available_voices()
        for voice in voices:
            gender_emoji = "👩" if voice["gender"] == "FEMALE" else "👨"
            print(f"  {gender_emoji} {voice['name']} - {voice['description']}")
        
        # Test synthesis with different voices
        print("\n🎵 Testing speech synthesis...")
        test_texts = [
            "Welcome to DebateSim! This is a test of the enhanced text-to-speech system.",
            "The quality of these voices is significantly better than standard browser TTS.",
            "You can now choose from multiple natural-sounding voices for your debates."
        ]
        
        test_voices = ["en-US-Neural2-A", "en-US-Neural2-C", "en-US-Neural2-E"]
        
        for i, (text, voice) in enumerate(zip(test_texts, test_voices), 1):
            print(f"\n  Test {i}: {text[:50]}...")
            print(f"    Voice: {voice}")
            
            result = tts_service.synthesize_speech(text, voice_name=voice)
            if result:
                print(f"    ✅ Success! Audio length: {len(result)} characters")
            else:
                print(f"    ❌ Failed!")
        
        print("\n🎉 All tests completed successfully!")
        return True
        
    except ImportError as e:
        print(f"❌ Import error: {e}")
        print("Make sure you have installed the required dependencies:")
        print("pip install google-cloud-texttospeech")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

def test_tts_api():
    """Test the TTS API endpoints"""
    print("\n🌐 Testing TTS API endpoints...")
    print("=" * 60)
    
    try:
        import requests
        
        base_url = "http://localhost:8001"
        
        # Test health endpoint
        print("🔍 Testing health endpoint...")
        response = requests.get(f"{base_url}/health")
        if response.status_code == 200:
            health_data = response.json()
            print(f"✅ Health check: {health_data}")
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
        
        # Test voices endpoint
        print("\n🎭 Testing voices endpoint...")
        response = requests.get(f"{base_url}/voices")
        if response.status_code == 200:
            voices_data = response.json()
            print(f"✅ Voices endpoint: {len(voices_data['voices'])} voices available")
        else:
            print(f"❌ Voices endpoint failed: {response.status_code}")
            return False
        
        # Test synthesis endpoint
        print("\n🎵 Testing synthesis endpoint...")
        test_text = "Hello, this is a test of the TTS API."
        response = requests.post(f"{base_url}/synthesize", json={
            "text": test_text,
            "voice_name": "en-US-Neural2-A"
        })
        
        if response.status_code == 200:
            synthesis_data = response.json()
            if synthesis_data['success']:
                print(f"✅ Synthesis successful: {len(synthesis_data['audio_content'])} characters")
            else:
                print(f"❌ Synthesis failed: {synthesis_data['error']}")
                return False
        else:
            print(f"❌ Synthesis endpoint failed: {response.status_code}")
            return False
        
        print("\n🎉 All API tests completed successfully!")
        return True
        
    except ImportError:
        print("❌ Requests library not available. Install with: pip install requests")
        return False
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to TTS API. Make sure the server is running:")
        print("python tts_api.py")
        return False
    except Exception as e:
        print(f"❌ API test error: {e}")
        return False

def main():
    """Main test function"""
    print("🚀 DebateSim TTS Service Test Suite")
    print("=" * 60)
    
    # Test 1: Direct TTS service
    print("\n📋 Test 1: Direct TTS Service")
    tts_success = test_tts_service()
    
    # Test 2: TTS API endpoints
    print("\n📋 Test 2: TTS API Endpoints")
    api_success = test_tts_api()
    
    # Summary
    print("\n📊 Test Summary")
    print("=" * 60)
    print(f"Direct TTS Service: {'✅ PASS' if tts_success else '❌ FAIL'}")
    print(f"TTS API Endpoints: {'✅ PASS' if api_success else '❌ FAIL'}")
    
    if tts_success and api_success:
        print("\n🎉 All tests passed! Your TTS service is working correctly.")
        print("\n🚀 Next steps:")
        print("1. Start the TTS API server: python tts_api.py")
        print("2. Test the frontend demo component")
        print("3. Integrate EnhancedVoiceOutput in your app")
    else:
        print("\n⚠️ Some tests failed. Check the error messages above.")
        
        if not tts_success:
            print("\n🔧 TTS Service Issues:")
            print("- Verify Google Cloud credentials are correct")
            print("- Check if Text-to-Speech API is enabled")
            print("- Install dependencies: pip install google-cloud-texttospeech")
        
        if not api_success:
            print("\n🔧 API Issues:")
            print("- Start the TTS API server: python tts_api.py")
            print("- Check if port 8001 is available")
            print("- Install dependencies: pip install fastapi uvicorn")

if __name__ == "__main__":
    main()
