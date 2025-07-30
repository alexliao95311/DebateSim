# DebateSim API Reference

Quick reference guide for DebateSim API endpoints and integration.

## Base Configuration

```bash
# Base URLs
Production: https://api.debatesim.com
Development: http://localhost:8000

# Authentication (Future)
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

## Quick Start

```python
import requests

API_BASE = "http://localhost:8000"

# Generate debate response
response = requests.post(f"{API_BASE}/generate-response", json={
    "debater": "Pro AI",
    "prompt": "AI does more good than harm",
    "model": "openai/gpt-4o"
})
```

## Core Endpoints

### AI Debate Generation

#### POST `/generate-response`
Generate AI debate responses with model selection.

```python
{
    "debater": "Pro AI" | "Con AI",
    "prompt": "Topic or opponent argument",
    "bill_description": "Optional bill text",
    "model": "openai/gpt-4o"
}
```

**Models Available:**
- `openai/gpt-4o` - Primary reasoning
- `meta-llama/llama-3.3-70b-instruct` - Fallback
- `google/gemini-2.0-flash-001` - Speed optimized  
- `anthropic/claude-3.5-sonnet` - Enhanced analysis

---

### AI Judge Evaluation

#### POST `/judge-feedback`
Get comprehensive debate evaluation.

```python
{
    "transcript": "Full debate transcript",
    "model": "anthropic/claude-3.5-sonnet"
}
```

**Response includes:**
- Argument strength scoring
- Winner determination with reasoning
- Evidence quality assessment
- Rhetorical effectiveness analysis

---

### Document Processing

#### POST `/extract-text`
Extract text from PDF files.

```python
# Multipart form data
files = {'file': open('bill.pdf', 'rb')}
response = requests.post(f"{API_BASE}/extract-text", files=files)
```

**Supports:**
- PDF files up to 50MB
- Complex legislative documents
- Confidence scoring for extraction quality

---

### Congressional Data

#### POST `/search-bills`
Search current Congress bills with advanced filtering.

```python
{
    "query": "climate change",
    "limit": 20,
    "congress": 119
}
```

**Features:**
- Fuzzy string matching
- Synonym expansion
- Real-time Congress.gov data
- Intelligent caching (30min TTL)

#### POST `/extract-bill-from-url`
Extract bill metadata from Congress.gov URLs.

```python
{
    "congress": 119,
    "type": "hr",
    "number": "1234"
}
```

---

### Legislative Analysis

#### POST `/analyze-bill`
Comprehensive AI-powered bill analysis.

```python
{
    "bill_text": "Full legislative text",
    "model": "openai/gpt-4o",
    "analysis_type": "comprehensive"
}
```

**Analysis includes:**
- 6-criteria grading system
- Key findings extraction
- Implementation recommendations
- Economic impact assessment

---

## Error Handling

### Standard Error Format
```json
{
    "error": {
        "code": 400,
        "message": "Detailed description",
        "type": "ValidationError",
        "details": {"field": "reason"}
    }
}
```

### Common HTTP Status Codes
| Code | Meaning |
|------|---------|
| `400` | Bad Request - Invalid parameters |
| `404` | Not Found - Resource missing |
| `413` | File too large (>50MB) |
| `429` | Rate limit exceeded |
| `500` | Internal server error |
| `503` | External API unavailable |

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| General API | 100 req/min per IP |
| AI Generation | 20 req/min per user |
| PDF Processing | 5 req/min per user |
| Congress Search | 50 req/min per IP |

---

## Code Examples

### Python Integration
```python
import requests
import json

class DebateSimAPI:
    def __init__(self, base_url="http://localhost:8000"):
        self.base_url = base_url
    
    def generate_response(self, debater, prompt, model="openai/gpt-4o", bill_text=None):
        data = {
            "debater": debater,
            "prompt": prompt,
            "model": model
        }
        if bill_text:
            data["bill_description"] = bill_text
            
        response = requests.post(f"{self.base_url}/generate-response", json=data)
        return response.json()
    
    def judge_debate(self, transcript, model="anthropic/claude-3.5-sonnet"):
        data = {"transcript": transcript, "model": model}
        response = requests.post(f"{self.base_url}/judge-feedback", json=data)
        return response.json()
    
    def search_bills(self, query, limit=20):
        data = {"query": query, "limit": limit}
        response = requests.post(f"{self.base_url}/search-bills", json=data)
        return response.json()

# Usage
api = DebateSimAPI()
result = api.generate_response("Pro AI", "Climate action is urgent", "openai/gpt-4o")
print(result["response"])
```

### JavaScript Integration
```javascript
class DebateSimAPI {
    constructor(baseUrl = 'http://localhost:8000') {
        this.baseUrl = baseUrl;
    }
    
    async generateResponse(debater, prompt, model = 'openai/gpt-4o', billText = null) {
        const data = { debater, prompt, model };
        if (billText) data.bill_description = billText;
        
        const response = await fetch(`${this.baseUrl}/generate-response`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return response.json();
    }
    
    async judgeDebate(transcript, model = 'anthropic/claude-3.5-sonnet') {
        const response = await fetch(`${this.baseUrl}/judge-feedback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transcript, model })
        });
        return response.json();
    }
    
    async searchBills(query, limit = 20) {
        const response = await fetch(`${this.baseUrl}/search-bills`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, limit })
        });
        return response.json();
    }
}

// Usage
const api = new DebateSimAPI();
const result = await api.generateResponse('Pro AI', 'AI safety is critical');
console.log(result.response);
```

---

## Performance Tips

### Caching Strategy
- Search results cached for 30 minutes
- Popular bills cached for 1 hour
- Use identical queries to leverage cache hits

### Model Selection
- **GPT-4o**: Best for complex reasoning
- **Claude 3.5**: Excellent for analysis
- **Gemini 2.0**: Fastest responses
- **LLaMA 3.3**: Reliable fallback

### Optimization
- Pre-process large PDFs during off-peak hours
- Batch multiple requests when possible
- Use appropriate model for task complexity
- Monitor rate limits to avoid throttling

---

## Support

- **Issues**: Create GitHub issue with API error details
- **Feature Requests**: Submit via GitHub discussions  
- **Documentation**: See [PROJECT_REPORT.md](./PROJECT_REPORT.md) for comprehensive details

---

**Version**: 1.0  
**Last Updated**: July 2025 
