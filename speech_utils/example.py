#!/usr/bin/env python3
"""
Example usage of the speech utilities for DebateSim
"""

import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from speech_utils.v2tgenerator import setup_credentials, test_speech_recognition

def main():
    """Example of how to use the speech recognition"""
    print("🎤 Speech Recognition Example")
    print("=" * 40)
    
    # Test the speech recognition
    print("Starting speech recognition test...")
    print("Speak into your microphone and press Ctrl+C to stop.")
    print()
    
    success = test_speech_recognition()
    
    if success:
        print("\n✅ Speech recognition is working correctly!")
        print("You can now integrate this into your debate application.")
    else:
        print("\n❌ Speech recognition failed. Check the setup instructions.")
    
    return success

if __name__ == "__main__":
    main() 