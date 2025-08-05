"""
Speech Utilities for DebateSim

This package provides voice-to-text functionality using Google Cloud Speech-to-Text API.
"""

from .v2tgenerator import (
    MicStream,
    setup_credentials,
    test_speech_recognition,
    print_server
)

__version__ = "1.0.0"
__author__ = "DebateSim Team"

__all__ = [
    "MicStream",
    "setup_credentials", 
    "test_speech_recognition",
    "print_server"
] 