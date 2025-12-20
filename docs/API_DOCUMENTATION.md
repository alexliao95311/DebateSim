# DebateSim API Documentation - Local Usage via POST Requests (Port 8000)

You can use DebateSim programmatically through POST requests to `http://localhost:8000`. Here are all available endpoints:

## 🎯 **Core Debate Endpoints**

### **1. Generate Debate Response**
**`POST /generate-response`**
Generate AI debate arguments for Pro or Con side.

```bash
curl -X POST http://localhost:8000/generate-response \
  -H "Content-Type: application/json" \
  -d '{
    "debater": "Pro",
    "prompt": "Should we ban social media for minors? Social media causes mental health issues.",
    "model": "openai/gpt-4o-mini",
    "bill_description": "",
    "full_transcript": "",
    "round_num": 1,
    "persona": "Default AI",
    "debate_format": "default",
    "speaking_order": "pro-first"
  }'
```

**Response:**
```json
{
  "response": "While concerns about mental health are valid, an outright ban would violate fundamental rights..."
}
```

### **2. Judge Debate**
**`POST /judge-debate`**
Get AI judge feedback on a debate transcript.

```bash
curl -X POST http://localhost:8000/judge-debate \
  -H "Content-Type: application/json" \
  -d '{
    "transcript": "## Pro Opening\n\nSocial media should be banned for minors...\n\n## Con Opening\n\nThis would violate free speech rights...",
    "model": "openai/gpt-4o-mini"
  }'
```

**Response:**
```json
{
  "feedback": "**Winner: Pro Side**\n\n**Reasoning:** The Pro side presented stronger evidence..."
}
```

### **3. Judge Feedback (Alternative)**
**`POST /judge-feedback`**
Alternative judge endpoint with same functionality.

```bash
curl -X POST http://localhost:8000/judge-feedback \
  -H "Content-Type: application/json" \
  -d '{
    "transcript": "debate transcript here...",
    "model": "openai/gpt-4o-mini"
  }'
```

## 📄 **Bill Analysis Endpoints**

### **4. Analyze Legislation (PDF Upload)**
**`POST /analyze-legislation`**
Upload and analyze PDF legislation.

```bash
curl -X POST http://localhost:8000/analyze-legislation \
  -F "file=@/path/to/bill.pdf" \
  -F "model=openai/gpt-4o-mini"
```

**Response:**
```json
{
  "success": true,
  "analysis": "## Executive Summary\n\nThis bill proposes...",
  "grades": {
    "economic_impact": {"grade": "B+", "reasoning": "..."},
    "public_benefit": {"grade": "A-", "reasoning": "..."}
  }
}
```

### **5. Analyze Legislation Text**
**`POST /analyze-legislation-text`**
Analyze legislation from text input.

```bash
curl -X POST http://localhost:8000/analyze-legislation-text \
  -H "Content-Type: application/json" \
  -d '{
    "text": "H.R. 1234: A Bill to establish...",
    "model": "openai/gpt-4o-mini"
  }'
```

### **6. Grade Legislation**
**`POST /grade-legislation`**
Get detailed grades for legislation.

```bash
curl -X POST http://localhost:8000/grade-legislation \
  -F "file=@/path/to/bill.pdf" \
  -F "model=openai/gpt-4o-mini"
```

## 🔍 **Bill Search & Discovery**

### **7. Search Bills**
**`POST /search-bills`**
Search Congress.gov for bills.

```bash
curl -X POST http://localhost:8000/search-bills \
  -H "Content-Type: application/json" \
  -d '{
    "query": "climate change",
    "limit": 10
  }'
```

### **8. Get Recommended Bills**
**`GET /recommended-bills`**
Get curated list of recommended bills.

```bash
curl http://localhost:8000/recommended-bills
```

### **9. Extract Bill from URL**
**`POST /extract-bill-from-url`**
Extract bill details from Congress.gov URL.

```bash
curl -X POST http://localhost:8000/extract-bill-from-url \
  -H "Content-Type: application/json" \
  -d '{
    "congress": 118,
    "type": "hr",
    "number": "1234",
    "url": "https://congress.gov/bill/118th-congress/house-bill/1234"
  }'
```

## 🎵 **Text-to-Speech Endpoints**

### **10. TTS Health Check**
**`GET /tts/health`**
```bash
curl http://localhost:8000/tts/health
```

### **11. Get Available Voices**
**`GET /tts/voices`**
```bash
curl http://localhost:8000/tts/voices
```

### **12. Synthesize Speech**
**`POST /tts/synthesize`**
Convert text to audio.

```bash
curl -X POST http://localhost:8000/tts/synthesize \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello, this is a test of text-to-speech.",
    "voice_name": "en-US-Chirp3-HD-Achernar",
    "rate": 1.0,
    "pitch": 0.0,
    "volume": 1.0
  }'
```

**Response:**
```json
{
  "success": true,
  "audio_content": "base64_encoded_mp3_data...",
  "voice_used": "en-US-Chirp3-HD-Achernar",
  "message": "Speech synthesized successfully"
}
```

## 📝 **Utility Endpoints**

### **13. Save Transcript**
**`POST /save-transcript`**
Save debate transcript to logs.

```bash
curl -X POST http://localhost:8000/save-transcript \
  -H "Content-Type: application/json" \
  -d '{
    "transcript": "debate transcript...",
    "topic": "Social Media Ban",
    "mode": "ai-vs-user",
    "judge_feedback": "Pro side wins..."
  }'
```

### **14. Extract Text from PDF**
**`POST /extract-text`**
Extract text from uploaded PDF.

```bash
curl -X POST http://localhost:8000/extract-text \
  -F "file=@/path/to/document.pdf"
```

## 🤖 **Available Models**

You can specify these models in the `model` parameter:
- `"openai/gpt-4o-mini"` (default)
- `"meta-llama/llama-3.3-70b-instruct"`
- `"google/gemini-2.0-flash-001"`
- `"anthropic/claude-3.5-sonnet"`
- `"openai/gpt-4o-mini-search-preview"`

## 🎭 **Available Personas**

For debate generation, you can use these personas:
- `"Default AI"`
- `"Donald Trump"` 
- `"Kamala Harris"`
- `"Elon Musk"`
- `"Drake"`

## 🏛️ **Example: Complete Debate Workflow**

```bash
# 1. Start a debate
curl -X POST http://localhost:8000/generate-response \
  -H "Content-Type: application/json" \
  -d '{
    "debater": "Pro",
    "prompt": "Should AI be regulated?",
    "model": "openai/gpt-4o-mini"
  }' > pro_response.json

# 2. Generate opponent response
curl -X POST http://localhost:8000/generate-response \
  -H "Content-Type: application/json" \
  -d '{
    "debater": "Con", 
    "prompt": "Should AI be regulated? AI drives innovation and economic growth.",
    "model": "openai/gpt-4o-mini"
  }' > con_response.json

# 3. Judge the debate
curl -X POST http://localhost:8000/judge-debate \
  -H "Content-Type: application/json" \
  -d '{
    "transcript": "## Pro Opening\nAI should be regulated...\n## Con Opening\nRegulation stifles innovation...",
    "model": "openai/gpt-4o-mini"
  }' > judge_feedback.json

# 4. Convert to audio
curl -X POST http://localhost:8000/tts/synthesize \
  -H "Content-Type: application/json" \
  -d '{
    "text": "The judge has determined the winner...",
    "voice_name": "en-US-Chirp3-HD-Achernar"
  }' > audio_result.json
```

## 🚀 **Getting Started**

1. **Start the backend server:**
   ```bash
   cd /Users/alexliao/Desktop/DebateSim
   uvicorn main:app --reload --port 8000
   ```

2. **Test the connection:**
   ```bash
   curl http://localhost:8000/
   ```

3. **Use any of the endpoints above!**

All endpoints return JSON responses and support CORS for web applications. The server includes comprehensive error handling and logging.

## 🔧 **Advanced Usage Tips**

### **Chain Multiple Rounds**
For multi-round debates, pass the `full_transcript` parameter with the complete debate history:

```bash
curl -X POST http://localhost:8000/generate-response \
  -H "Content-Type: application/json" \
  -d '{
    "debater": "Pro",
    "prompt": "Should AI be regulated? Regulation stifles innovation.",
    "full_transcript": "## Round 1 - Pro Opening\nAI should be regulated...\n## Round 1 - Con Opening\nRegulation stifles innovation...",
    "round_num": 2,
    "model": "openai/gpt-4o-mini"
  }'
```

### **Bill-Based Debates**
Include bill text for evidence-based arguments:

```bash
curl -X POST http://localhost:8000/generate-response \
  -H "Content-Type: application/json" \
  -d '{
    "debater": "Pro",
    "prompt": "Support this AI regulation bill",
    "bill_description": "H.R. 1234: A Bill to establish oversight of artificial intelligence systems...",
    "model": "openai/gpt-4o-mini"
  }'
```

### **Custom Personas**
Use different personas for varied debate styles:

```bash
curl -X POST http://localhost:8000/generate-response \
  -H "Content-Type: application/json" \
  -d '{
    "debater": "Pro",
    "prompt": "AI regulation is necessary",
    "persona": "Elon Musk",
    "model": "openai/gpt-4o-mini"
  }'
```

### **Public Forum Format**
Use public forum debate format with specific speaking orders:

```bash
curl -X POST http://localhost:8000/generate-response \
  -H "Content-Type: application/json" \
  -d '{
    "debater": "Pro",
    "prompt": "Climate change action is urgent",
    "debate_format": "public-forum",
    "speaking_order": "pro-first",
    "model": "openai/gpt-4o-mini"
  }'
```

## 🎯 **Response Formats**

### **Standard Response**
Most endpoints return JSON with success/error status:
```json
{
  "response": "AI-generated content...",
  "success": true
}
```

### **Analysis Response**
Bill analysis includes detailed grades:
```json
{
  "success": true,
  "analysis": "## Executive Summary\n...",
  "grades": {
    "economic_impact": {
      "grade": "B+",
      "reasoning": "Strong economic benefits..."
    },
    "public_benefit": {
      "grade": "A-", 
      "reasoning": "Significant public value..."
    }
  }
}
```

### **Error Response**
Failed requests return error details:
```json
{
  "detail": "Error description",
  "status_code": 400
}
```

## 📊 **Rate Limits & Performance**

- **No built-in rate limits** (local usage)
- **File upload limit**: 10MB for PDFs
- **Text length limits**: 5000 characters for TTS
- **Response times**: 2-10 seconds depending on model and complexity
- **Concurrent requests**: Supported with connection pooling

## 🛠️ **Troubleshooting**

### **Common Issues**

1. **Server not responding**: Ensure server is running on port 8000
2. **TTS failures**: Check Google Cloud credentials in `/credentials/`
3. **PDF processing errors**: Ensure file is valid PDF under 10MB
4. **Model timeouts**: Try fallback model `meta-llama/llama-3.3-70b-instruct`

### **Debug Mode**
Enable detailed logging by checking server console output when making requests.

### **Health Checks**
Verify service components:
- **Main API**: `curl http://localhost:8000/`
- **TTS Service**: `curl http://localhost:8000/tts/health`
- **Bill Search**: `curl http://localhost:8000/recommended-bills`

---

**Created**: January 2025  
**Version**: 1.0  
**Base URL**: `http://localhost:8000`