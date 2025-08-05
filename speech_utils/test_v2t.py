#!/usr/bin/env python3
"""
Test script for Google Cloud Voice-to-Text setup
"""

import os
import sys
# Add parent directory to path to import from speech_utils
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from speech_utils.v2tgenerator import setup_credentials, test_speech_recognition

def check_dependencies():
    """Check if all required dependencies are installed"""
    try:
        import pyaudio
        print("✅ PyAudio installed")
    except ImportError:
        print("❌ PyAudio not installed. Install with: pip install pyaudio")
        return False

    try:
        import google.cloud.speech
        print("✅ Google Cloud Speech installed")
    except ImportError:
        print("❌ Google Cloud Speech not installed. Install with: pip install google-cloud-speech")
        return False

    try:
        import six
        print("✅ Six library installed")
    except ImportError:
        print("❌ Six library not installed. Install with: pip install six")
        return False

    return True

def check_credentials():
    """Check if credentials are properly set up"""
    # Look for credentials in parent directory
    parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    credentials_path = os.path.join(parent_dir, "credentials", "debatesim-6f403-55fd99aa753a-google-cloud.json")
    
    if not os.path.exists(os.path.join(parent_dir, "credentials")):
        print("❌ Credentials directory not found")
        print("Creating credentials directory...")
        os.makedirs(os.path.join(parent_dir, "credentials"), exist_ok=True)
        return False
    
    if not os.path.exists(credentials_path):
        print("❌ Google Cloud credentials file not found")
        print(f"Please place your Google Cloud credentials JSON file at: {credentials_path}")
        return False
    
    print(f"✅ Google Cloud credentials file found at: {credentials_path}")
    return True

def main():
    """Main test function"""
    print("🎯 Google Cloud Voice-to-Text Setup Test")
    print("=" * 50)
    
    # Check dependencies
    print("\n1. Checking dependencies...")
    if not check_dependencies():
        print("\n❌ Dependencies check failed. Please install missing packages.")
        return False
    
    # Check credentials
    print("\n2. Checking credentials...")
    if not check_credentials():
        print("\n❌ Credentials check failed. Please set up your Google Cloud credentials.")
        return False
    
    # Test speech recognition
    print("\n3. Testing speech recognition...")
    print("This will start listening to your microphone.")
    print("Speak into your microphone and press Ctrl+C to stop.")
    
    try:
        success = test_speech_recognition()
        if success:
            print("\n✅ Voice-to-Text setup is working correctly!")
            return True
        else:
            print("\n❌ Voice-to-Text test failed.")
            return False
    except KeyboardInterrupt:
        print("\n🛑 Test stopped by user")
        return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1) 