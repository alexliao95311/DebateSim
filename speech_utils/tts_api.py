#!/usr/bin/env python3
"""
FastAPI Text-to-Speech Endpoint for DebateSim
Integrates with existing Google Cloud credentials
"""

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List, Dict
import base64
import os
import sys

# Add current directory to path to import tts_service
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from tts_service import GoogleTTSService

# Initialize FastAPI app
app = FastAPI(
    title="DebateSim TTS API",
    description="Google Cloud Text-to-Speech API for DebateSim",
    version="1.0.0"
)

# Initialize TTS service
tts_service = GoogleTTSService()

# Request/Response models
class TTSRequest(BaseModel):
    text: str
    voice_name: Optional[str] = None
    rate: Optional[float] = 1.0
    pitch: Optional[float] = 0.0
    volume: Optional[float] = 1.0

class TTSResponse(BaseModel):
    success: bool
    audio_content: Optional[str] = None
    voice_used: Optional[str] = None
    message: str
    error: Optional[str] = None

class VoiceInfo(BaseModel):
    name: str
    language: str
    gender: str
    description: str

class VoicesResponse(BaseModel):
    success: bool
    voices: List[VoiceInfo]
    default_voice: str

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "DebateSim TTS API",
        "version": "1.0.0",
        "status": "running"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        is_healthy = tts_service.test_connection()
        return {
            "status": "healthy" if is_healthy else "unhealthy",
            "service": "google-tts",
            "credentials_loaded": tts_service.client is not None
        }
    except Exception as e:
        return {
            "status": "error",
            "service": "google-tts",
            "error": str(e)
        }

@app.get("/voices", response_model=VoicesResponse)
async def get_voices():
    """Get available voices"""
    try:
        voices = tts_service.get_available_voices()
        default_voice = tts_service.get_default_voice()
        
        return VoicesResponse(
            success=True,
            voices=voices,
            default_voice=default_voice
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get voices: {str(e)}")

@app.post("/synthesize", response_model=TTSResponse)
async def synthesize_speech(request: TTSRequest):
    """Synthesize speech from text"""
    try:
        # Validate input
        if not request.text or len(request.text.strip()) == 0:
            raise HTTPException(status_code=400, detail="Text cannot be empty")
        
        if len(request.text) > 5000:  # Limit text length
            raise HTTPException(status_code=400, detail="Text too long (max 5000 characters)")
        
        # Validate parameters
        if request.rate and (request.rate < 0.25 or request.rate > 4.0):
            raise HTTPException(status_code=400, detail="Rate must be between 0.25 and 4.0")
        
        if request.pitch and (request.pitch < -20.0 or request.pitch > 20.0):
            raise HTTPException(status_code=400, detail="Pitch must be between -20.0 and 20.0")
        
        if request.volume and (request.volume < -96.0 or request.volume > 16.0):
            raise HTTPException(status_code=400, detail="Volume must be between -96.0 and 16.0")
        
        # Synthesize speech
        audio_content = tts_service.synthesize_speech(
            text=request.text,
            voice_name=request.voice_name,
            rate=request.rate,
            pitch=request.pitch,
            volume=request.volume
        )
        
        if audio_content:
            voice_used = request.voice_name or tts_service.get_default_voice()
            return TTSResponse(
                success=True,
                audio_content=audio_content,
                voice_used=voice_used,
                message="Speech synthesized successfully"
            )
        else:
            return TTSResponse(
                success=False,
                message="Failed to synthesize speech",
                error="TTS service returned no audio content"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        return TTSResponse(
            success=False,
            message="Internal server error",
            error=str(e)
        )

@app.get("/test")
async def test_tts():
    """Test TTS with a simple text"""
    try:
        test_text = "Hello, this is a test of the DebateSim text-to-speech system."
        audio_content = tts_service.synthesize_speech(test_text)
        
        if audio_content:
            return {
                "success": True,
                "message": "Test successful",
                "audio_length": len(audio_content),
                "sample_text": test_text
            }
        else:
            return {
                "success": False,
                "message": "Test failed",
                "error": "No audio content returned"
            }
    except Exception as e:
        return {
            "success": False,
            "message": "Test failed",
            "error": str(e)
        }

if __name__ == "__main__":
    import uvicorn
    
    # Check if TTS service is working
    print("🔍 Checking TTS service...")
    if tts_service.client:
        print("✅ TTS service initialized successfully")
        if tts_service.test_connection():
            print("✅ TTS connection test passed")
        else:
            print("❌ TTS connection test failed")
    else:
        print("❌ TTS service failed to initialize")
    
    # Start the server
    print("🚀 Starting TTS API server...")
    uvicorn.run(app, host="0.0.0.0", port=8001)
