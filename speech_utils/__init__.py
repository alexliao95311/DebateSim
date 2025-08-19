"""
Speech Utilities for DebateSim

This package provides voice-to-text and text-to-speech functionality using Google Cloud APIs.
"""

from .v2tgenerator import (
    MicStream,
    setup_credentials,
    test_speech_recognition,
    print_server
)

from .tts_service import GoogleTTSService

__version__ = "2.0.0"
__author__ = "DebateSim Team"

__all__ = [
    # Voice-to-Text (existing)
    "MicStream",
    "setup_credentials", 
    "test_speech_recognition",
    "print_server",
    
    # Text-to-Speech (new)
    "GoogleTTSService"
] 