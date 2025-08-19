#!/usr/bin/env python3
"""
DebateSim TTS Service Startup Script
Starts the TTS API server and provides testing options
"""

import os
import sys
import subprocess
import time
import webbrowser
from pathlib import Path

def check_dependencies():
    """Check if required dependencies are installed"""
    print("🔍 Checking dependencies...")
    
    try:
        import google.cloud.texttospeech
        print("✅ google-cloud-texttospeech installed")
    except ImportError:
        print("❌ google-cloud-texttospeech not installed")
        print("Install with: pip install google-cloud-texttospeech")
        return False
    
    try:
        import fastapi
        print("✅ fastapi installed")
    except ImportError:
        print("❌ fastapi not installed")
        print("Install with: pip install fastapi uvicorn")
        return False
    
    try:
        import uvicorn
        print("✅ uvicorn installed")
    except ImportError:
        print("❌ uvicorn not installed")
        print("Install with: pip install uvicorn")
        return False
    
    return True

def check_credentials():
    """Check if Google Cloud credentials exist"""
    print("\n🔑 Checking credentials...")
    
    # Path relative to speech_utils folder (go up one level to root)
    creds_path = Path(__file__).parent.parent / "credentials" / "debatesim-6f403-55fd99aa753a-google-cloud.json"
    
    if creds_path.exists():
        print(f"✅ Credentials found: {creds_path}")
        return True
    else:
        print(f"❌ Credentials not found: {creds_path}")
        print(f"   Expected location: {creds_path}")
        print(f"   Current working directory: {os.getcwd()}")
        print("Make sure your Google Cloud credentials are in the credentials/ folder")
        return False

def test_tts_service():
    """Test the TTS service directly"""
    print("\n🧪 Testing TTS service...")
    
    try:
        from tts_service import GoogleTTSService
        
        tts_service = GoogleTTSService()
        if not tts_service.client:
            print("❌ TTS service initialization failed")
            return False
        
        if tts_service.test_connection():
            print("✅ TTS service test passed")
            return True
        else:
            print("❌ TTS service test failed")
            return False
            
    except Exception as e:
        print(f"❌ TTS service test error: {e}")
        return False

def start_tts_server():
    """Start the TTS API server"""
    print("\n🚀 Starting TTS API server...")
    
    try:
        # Check if port 8001 is available
        import socket
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        result = sock.connect_ex(('localhost', 8001))
        sock.close()
        
        if result == 0:
            print("⚠️ Port 8001 is already in use")
            print("Another TTS server might be running")
            return False
        
        # Start the server
        print("Starting server on http://localhost:8001")
        print("Press Ctrl+C to stop the server")
        
        # Start the server in a subprocess
        process = subprocess.Popen([
            sys.executable, "tts_api.py"
        ])
        
        # Wait a moment for server to start
        time.sleep(3)
        
        # Check if server is responding
        try:
            import requests
            response = requests.get("http://localhost:8001/health", timeout=5)
            if response.status_code == 200:
                print("✅ TTS API server is running!")
                print("🌐 API available at: http://localhost:8001")
                print("📖 API docs at: http://localhost:8001/docs")
                return process
            else:
                print("❌ Server started but health check failed")
                process.terminate()
                return False
        except ImportError:
            print("⚠️ requests library not available, skipping health check")
            print("✅ TTS API server started (health check skipped)")
            return process
        except Exception as e:
            print(f"❌ Health check failed: {e}")
            process.terminate()
            return False
            
    except Exception as e:
        print(f"❌ Failed to start TTS server: {e}")
        return False

def open_demo_page():
    """Open the demo page in browser"""
    print("\n🌐 Opening demo page...")
    
    # Check if frontend is running
    try:
        import requests
        response = requests.get("http://localhost:5173", timeout=2)
        if response.status_code == 200:
            print("✅ Frontend detected on port 5173")
            webbrowser.open("http://localhost:5173")
            return True
        else:
            print("⚠️ Frontend not responding on port 5173")
            return False
    except:
        print("⚠️ Frontend not detected on port 5173")
        print("Start your frontend with: cd frontend && npm run dev")
        return False

def main():
    """Main startup function"""
    print("🎤 DebateSim TTS Service Startup")
    print("=" * 50)
    
    # Check dependencies
    if not check_dependencies():
        print("\n❌ Please install missing dependencies and try again")
        return
    
    # Check credentials
    if not check_credentials():
        print("\n❌ Please check your Google Cloud credentials and try again")
        return
    
    # Test TTS service
    if not test_tts_service():
        print("\n❌ TTS service test failed. Check your Google Cloud setup:")
        print("- Ensure Text-to-Speech API is enabled")
        print("- Verify service account has TTS permissions")
        print("- Check if billing is enabled")
        return
    
    print("\n✅ All checks passed! Starting TTS service...")
    
    # Start TTS server
    server_process = start_tts_server()
    if not server_process:
        print("\n❌ Failed to start TTS server")
        return
    
    try:
        # Try to open demo page
        open_demo_page()
        
        print("\n🎉 TTS service is running!")
        print("\n📋 Next steps:")
        print("1. TTS API: http://localhost:8001")
        print("2. API Docs: http://localhost:8001/docs")
        print("3. Test endpoint: http://localhost:8001/test")
        print("4. Frontend demo: Start your React app and navigate to TTSDemo component")
        print("\n🛑 Press Ctrl+C to stop the TTS server")
        
        # Keep the server running
        server_process.wait()
        
    except KeyboardInterrupt:
        print("\n\n🛑 Stopping TTS server...")
        server_process.terminate()
        server_process.wait()
        print("✅ TTS server stopped")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        server_process.terminate()
        server_process.wait()

if __name__ == "__main__":
    main()
