import os
import time
import asyncio
import logging
from datetime import datetime
from fastapi import FastAPI, HTTPException, BackgroundTasks, UploadFile, File
from pydantic import BaseModel
from openai import OpenAI
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
import aiohttp
from cachetools import TTLCache
from cachetools.keys import hashkey
from io import BytesIO
from pdfminer.high_level import extract_text
import json
from typing import List, Dict, Any

from chains.debater_chain import get_debater_chain
from chains.judge_chain import judge_chain, get_judge_chain

# Initialize logging first
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()
API_KEY = os.getenv("OPENROUTER_API_KEY")
if not API_KEY:
    raise ValueError("Please set the OPENROUTER_API_KEY environment variable.")

CONGRESS_API_KEY = os.getenv("CONGRESS_API_KEY")
if not CONGRESS_API_KEY:
    logger.warning("CONGRESS_API_KEY not found. Recommended bills will use mock data.")

# Global model configuration
DEFAULT_MODEL = "qwen/qwq-32b:free"
FALLBACK_MODEL = "meta-llama/llama-3.3-70b-instruct"

# Initialize OpenAI client (not directly used since we are calling the API via aiohttp)
client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=API_KEY
)

# FastAPI application
app = FastAPI()

@app.get("/")
async def root():
    return {"message": "FastAPI backend is running!"}

# Enable CORS for frontend communication
backend_origins = os.getenv("BACKEND_ORIGINS", "http://localhost,http://127.0.0.1,http://20.3.246.40,http://localhost:80,http://127.0.0.1:80,http://20.3.246.40:80,http://localhost:3000,http://127.0.0.1:3000,http://20.3.246.40:3000,http://172.190.97.150:3000,http://172.190.97.150:80,http://debatesim.us,https://debatesim.us").split(",")
cleaned_origins = [origin.strip().rstrip("/") for origin in backend_origins]
print("[Cleaned CORS Origins]:", cleaned_origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cleaned_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models – now referencing the global DEFAULT_MODEL
class GenerateResponseRequest(BaseModel):
    debater: str  # e.g., "Pro" or "Con"
    prompt: str   # Expected format: "debate topic. opponent's argument"
    model: str = DEFAULT_MODEL  # Use the global default model

class JudgeRequest(BaseModel):
    transcript: str
    model: str = DEFAULT_MODEL  # Use the global default model

class SaveTranscriptRequest(BaseModel):
    transcript: str
    topic: str
    mode: str
    judge_feedback: str  # Judge feedback included

class JudgeFeedbackRequest(BaseModel):
    transcript: str
    model: str = DEFAULT_MODEL  # Use the global default model

# Connection pooling with optimizations
connector = aiohttp.TCPConnector(
    limit=30,
    limit_per_host=20,
    ttl_dns_cache=300,
    use_dns_cache=True,
    keepalive_timeout=60,
    enable_cleanup_closed=True
)

# Cache for AI responses (key now includes model_override and skip_formatting)
cache = TTLCache(maxsize=200, ttl=600)  # Cache up to 200 items for 10 minutes

# Global session variable
session = None

@app.on_event("startup")
async def startup_event():
    global session
    session = aiohttp.ClientSession(connector=connector)

@app.on_event("shutdown")
async def shutdown_event():
    if session is not None:
        await session.close()


# API Endpoints

@app.post("/generate-response")
async def generate_response(request: GenerateResponseRequest):
    start_time = time.time()
    logger.info(f"📩 /generate-response called with debater={request.debater!r}, model={request.model}")
    # Determine role: "Pro" or "Con" - ensure AI is properly capitalized
    debater_role = request.debater.strip().title().replace("Ai ", "AI ")
    
    try:
        # Parse out topic and opponent argument if applicable
        parts = request.prompt.split('.', 1)
        if len(parts) > 1:
            topic = parts[0].strip()
            opponent_arg = parts[1].strip()
        else:
            topic = request.prompt.strip()
            opponent_arg = ""
        
        # Get a debater chain with the specified model
        model_specific_debater_chain = get_debater_chain(request.model)
        
        # Call the run method
        ai_output = model_specific_debater_chain.run(
            debater_role=debater_role,
            topic=topic,
            bill_description=topic, # You can modify this if needed
            history=opponent_arg
        )
        
    except Exception as e:
        logger.error(f"Error in debater_chain: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error generating debater response: {str(e)}")
        
    duration = time.time() - start_time
    logger.info(f"✅ [LangChain] Debater response generated in {duration:.2f}s: {ai_output[:200]}...")
    return {"response": ai_output}

@app.post("/judge-debate")
async def judge_debate(request: JudgeRequest):
    transcript = request.transcript
    logger.info("📩 /judge-debate called (length=%d)", len(transcript))
    try:
        feedback = judge_chain.run(transcript=transcript)
    except Exception as e:
        logger.error(f"Error in judge_chain: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error generating judge feedback")
    logger.info(f"✅ [LangChain] Judge feedback: {feedback[:200]}...")
    return {"feedback": feedback}

@app.post("/save-transcript")
async def save_transcript(request: SaveTranscriptRequest, background_tasks: BackgroundTasks):
    if not os.path.exists("logs"):
        os.makedirs("logs")
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"logs/debate_{timestamp}.md"
    def background_save_transcript():
        try:
            with open(filename, "w") as f:
                f.write(f"# Debate Transcript\n\n")
                f.write(f"**Timestamp:** {timestamp}\n\n")
                f.write(f"**Topic:** {request.topic}\n\n")
                f.write(f"**Mode:** {request.mode}\n\n")
                f.write("## Transcript\n\n")
                f.write(request.transcript + "\n\n")
                f.write("## Judge Feedback\n\n")
                f.write(request.judge_feedback + "\n")
            logger.info(f"Transcript saved to {filename}")
        except Exception as e:
            logger.error(f"Exception in background_save_transcript: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=str(e))
    background_tasks.add_task(background_save_transcript)
    return {"message": "Processing request in the background"}

class AnalyzeLegislationRequest(BaseModel):
    model: str = DEFAULT_MODEL

@app.post("/analyze-legislation")
async def analyze_legislation(file: UploadFile = File(...), model: str = DEFAULT_MODEL):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a PDF file.")
    try:
        contents = await file.read()
        # Extract text using pdfminer.six
        text = extract_text(BytesIO(contents))
        if not text.strip():
            raise ValueError("No extractable text found in PDF.")
    except Exception as e:
        logger.error(f"Error processing PDF file: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error processing PDF file: " + str(e))

    try:
        # Use the new analysis function instead of debater chain
        analysis = await analyze_legislation_text(text, model)
    except Exception as e:
        logger.error(f"Error in analyze_legislation_text: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error analyzing legislation")

    return {"analysis": analysis}

@app.post("/extract-text")
async def extract_text_endpoint(file: UploadFile = File(...)):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a PDF file.")
    try:
        contents = await file.read()
        # Extract text using pdfminer.six
        text = extract_text(BytesIO(contents))
        if not text.strip():
            raise ValueError("No extractable text found in PDF.")
    except Exception as e:
        logger.error(f"Error extracting text from PDF file: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error extracting text from PDF file: " + str(e))
    return {"text": text}

@app.post("/judge-feedback")
async def judge_feedback(request: JudgeFeedbackRequest):
    start_time = time.time()
    logger.info(f"📩 /judge-feedback called with model={request.model!r}")
    try:
        # Get the appropriate judge chain with the requested model
        model_specific_judge_chain = get_judge_chain(request.model)
        
        # Run the chain with the transcript
        feedback = model_specific_judge_chain.run(
            transcript=request.transcript
        )
        
        duration = time.time() - start_time
        logger.info(f"✅ Judge feedback generated in {duration:.2f}s")
        return {"response": feedback}
    except Exception as e:
        logger.error(f"Error in judge_chain: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error generating judge feedback")
    
@app.options("/test-cors")
async def test_cors():
    return {"message": "CORS preflight OK"}

# Cache for Congress bills
bills_cache = TTLCache(maxsize=50, ttl=3600)  # Cache for 1 hour

async def fetch_congress_bills() -> List[Dict[str, Any]]:
    """Fetch current bills from Congress.gov API"""
    if not CONGRESS_API_KEY:
        # Return mock data if no API key
        return [
            {
                "id": "hr1234-119",
                "title": "American Innovation and Manufacturing Act of 2025",
                "type": "HR",
                "number": "1234",
                "sponsor": "Rep. Smith (D-CA)",
                "lastAction": "Passed House",
                "description": "A bill to promote innovation in American manufacturing, strengthen domestic supply chains, and create jobs in emerging technologies including renewable energy and advanced materials."
            },
            {
                "id": "s5678-119",
                "title": "Climate Resilience Infrastructure Act of 2025",
                "type": "S",
                "number": "5678",
                "sponsor": "Sen. Johnson (R-TX)",
                "lastAction": "Committee Review",
                "description": "Comprehensive legislation to improve infrastructure resilience to climate change impacts, including funding for flood protection, wildfire prevention, and extreme weather preparedness."
            },
            {
                "id": "hr9999-119",
                "title": "Digital Privacy Protection Act of 2025",
                "type": "HR",
                "number": "9999",
                "sponsor": "Rep. Williams (D-NY)",
                "lastAction": "Introduced",
                "description": "A comprehensive bill to protect consumer data privacy, regulate data collection practices by tech companies, and establish a federal data protection agency."
            },
            {
                "id": "s2468-119",
                "title": "Healthcare Access and Affordability Act",
                "type": "S",
                "number": "2468",
                "sponsor": "Sen. Davis (R-FL)",
                "lastAction": "Markup Scheduled",
                "description": "Legislation to expand healthcare access in rural areas, reduce prescription drug costs, and improve mental health services nationwide."
            },
            {
                "id": "hr1357-119",
                "title": "Education Equity and Innovation Act",
                "type": "HR",
                "number": "1357",
                "sponsor": "Rep. Garcia (D-TX)",
                "lastAction": "Subcommittee Review",
                "description": "A bill to improve educational outcomes by increasing funding for underserved schools, expanding STEM programs, and supporting teacher training initiatives."
            }
        ]
    
    # Use cached result if available
    cache_key = "congress_bills_current"
    if cache_key in bills_cache:
        return bills_cache[cache_key]
    
    try:
        # Current Congress is 119th (2025-2027)
        current_congress = 119
        
        # Fetch recent bills from current Congress
        url = f"https://api.congress.gov/v3/bill/{current_congress}"
        params = {
            "api_key": CONGRESS_API_KEY,
            "format": "json",
            "limit": 20,
            "sort": "updateDate+desc"  # Sort by most recently updated
        }
        
        async with session.get(url, params=params) as response:
            if response.status != 200:
                logger.error(f"Congress API error: {response.status}")
                raise HTTPException(status_code=500, detail="Error fetching bills from Congress API")
            
            data = await response.json()
            bills_data = data.get("bills", [])
            
            # Transform the data to our format
            processed_bills = []
            for bill in bills_data[:8]:  # Limit to 8 bills for UI
                try:
                    # Extract bill information
                    bill_type = bill.get("type", "")
                    bill_number = bill.get("number", "")
                    title = bill.get("title", "Untitled Bill")
                    
                    # Get sponsor information
                    sponsors = bill.get("sponsors", [])
                    sponsor_name = "Unknown Sponsor"
                    if sponsors:
                        sponsor = sponsors[0]
                        first_name = sponsor.get("firstName", "")
                        last_name = sponsor.get("lastName", "")
                        party = sponsor.get("party", "")
                        state = sponsor.get("state", "")
                        sponsor_name = f"Rep. {first_name} {last_name} ({party}-{state})" if sponsor.get("type") == "Representative" else f"Sen. {first_name} {last_name} ({party}-{state})"
                    
                    # Get latest action
                    latest_action = bill.get("latestAction", {})
                    action_text = latest_action.get("text", "No recent action")
                    
                    # Get better description from summary or policy areas
                    description = title  # Fallback to title
                    
                    # Try to get summary first
                    summaries = bill.get("summaries", [])
                    if summaries:
                        latest_summary = summaries[0]  # Get the most recent summary
                        summary_text = latest_summary.get("text", "")
                        if summary_text:
                            description = summary_text
                    
                    # If no summary, try to use policy areas to create description
                    if description == title:
                        policy_areas = bill.get("policyArea", {})
                        policy_name = policy_areas.get("name", "")
                        subjects = bill.get("subjects", [])
                        if policy_name and subjects:
                            subject_names = [s.get("name", "") for s in subjects[:3] if s.get("name")]
                            if subject_names:
                                description = f"Legislation related to {policy_name}. Key areas: {', '.join(subject_names)}."
                    
                    # Only truncate if still very long (over 500 chars)
                    if len(description) > 500:
                        description = description[:500] + "..."
                    
                    processed_bill = {
                        "id": f"{bill_type.lower()}{bill_number}-{current_congress}",
                        "title": title,
                        "type": bill_type,
                        "number": bill_number,
                        "sponsor": sponsor_name,
                        "lastAction": action_text,  # Don't truncate action text
                        "description": description
                    }
                    processed_bills.append(processed_bill)
                    
                except Exception as e:
                    logger.warning(f"Error processing bill data: {e}")
                    continue
            
            # Cache the results
            bills_cache[cache_key] = processed_bills
            return processed_bills
            
    except Exception as e:
        logger.error(f"Error fetching Congress bills: {e}")
        # Return mock data as fallback by calling the function with temporarily disabled API key
        original_key = CONGRESS_API_KEY
        globals()['CONGRESS_API_KEY'] = None
        mock_data = [
            {
                "id": "hr1234-119",
                "title": "American Innovation and Manufacturing Act of 2025",
                "type": "HR",
                "number": "1234",
                "sponsor": "Rep. Smith (D-CA)",
                "lastAction": "Passed House",
                "description": "A bill to promote innovation in American manufacturing, strengthen domestic supply chains, and create jobs in emerging technologies including renewable energy and advanced materials."
            },
            {
                "id": "s5678-119",
                "title": "Climate Resilience Infrastructure Act of 2025",
                "type": "S",
                "number": "5678",
                "sponsor": "Sen. Johnson (R-TX)",
                "lastAction": "Committee Review",
                "description": "Comprehensive legislation to improve infrastructure resilience to climate change impacts, including funding for flood protection, wildfire prevention, and extreme weather preparedness."
            }
        ]
        globals()['CONGRESS_API_KEY'] = original_key
        return mock_data

@app.get("/recommended-bills")
async def get_recommended_bills():
    """Get current trending bills from Congress"""
    try:
        bills = await fetch_congress_bills()
        return {"bills": bills}
    except Exception as e:
        logger.error(f"Error in /recommended-bills endpoint: {e}")
        raise HTTPException(status_code=500, detail="Error fetching recommended bills")

async def analyze_legislation_text(bill_text: str, model: str) -> str:
    """Analyze legislation text with a custom analysis prompt"""
    analysis_prompt = f"""
You are a legislative analyst providing a comprehensive analysis of the following bill. Your analysis should be structured, informative, and evidence-based.

BILL TEXT:
{bill_text}

Please provide a detailed analysis with the following sections:

## Executive Summary
Provide a 2-3 sentence overview of what this bill does and its main purpose.

## Bill Details
- **Primary Sponsor**: Identify who drafted/sponsored this bill (if mentioned in the text)
- **Legislative Goals**: What are the main objectives this bill aims to achieve?
- **Key Provisions**: List the 3-5 most important sections or provisions

## Policy Analysis
### Potential Benefits
- Identify 2-3 positive aspects or benefits this bill could provide
- Support each point with specific text evidence from the bill

### Potential Concerns
- Identify 2-3 potential problems, challenges, or negative consequences
- Support each point with specific text evidence from the bill

### Implementation Considerations
- What challenges might arise in implementing this legislation?
- Are there any unclear provisions or potential ambiguities?

## Evidence from Bill Text
For each major point you make, include direct quotes from the bill text to support your analysis. Format quotes as:
> "Direct quote from the bill"

## Overall Assessment
Provide a balanced conclusion about the bill's likely effectiveness and impact.

Please ensure your analysis is objective, evidence-based, and draws directly from the bill text provided.
"""

    try:
        # Use aiohttp to make the API call
        headers = {
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://debatesim.app",
        }
        
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": "You are an expert legislative analyst providing objective, evidence-based analysis of Congressional bills."},
                {"role": "user", "content": analysis_prompt}
            ],
            "temperature": 0.3,  # Lower temperature for more analytical, less creative output
        }
        
        async with session.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload) as response:
            if response.status != 200:
                logger.error(f"OpenRouter API error in analysis: {response.status}")
                raise HTTPException(status_code=500, detail="Error generating analysis")
            
            result = await response.json()
            analysis = result["choices"][0]["message"]["content"]
            
            return analysis
            
    except Exception as e:
        logger.error(f"Error in analyze_legislation_text: {e}")
        # Return a basic fallback analysis
        return f"""
# Legislative Analysis

## Executive Summary
This bill appears to address legislative matters as indicated by its structure and content. A detailed analysis requires further review of the specific provisions.

## Bill Details
- **Primary Sponsor**: Information not clearly available in provided text
- **Legislative Goals**: Based on the bill content, this legislation aims to [goals would be identified from bill text]
- **Key Provisions**: [Key sections would be analyzed from the bill text]

## Policy Analysis
### Potential Benefits
Analysis of potential positive impacts would be provided based on the bill's specific provisions.

### Potential Concerns  
Potential challenges or negative consequences would be identified from the bill text.

## Overall Assessment
A comprehensive analysis requires review of the complete bill text and context. This preliminary analysis provides a framework for understanding the legislation's scope and potential impact.

*Note: This is a fallback analysis due to processing limitations. For a complete analysis, please try again or review the bill text manually.*
        """.strip()

async def fetch_bill_text(bill_type: str, bill_number: str, congress: int = 119) -> str:
    """Fetch full text of a specific bill from Congress.gov API"""
    if not CONGRESS_API_KEY:
        # Return mock bill text if no API key
        return f"""
{bill_type.upper()} {bill_number} - Mock Bill Text

SECTION 1. SHORT TITLE.
This Act may be cited as the "Sample {bill_type.upper()} {bill_number} Act".

SECTION 2. FINDINGS.
Congress finds the following:
(1) This is a sample bill text for demonstration purposes.
(2) The actual bill text would be much longer and more detailed.
(3) Real bills contain specific legislative language, definitions, and implementation details.

SECTION 3. PURPOSES.
The purposes of this Act are to demonstrate the bill text extraction functionality and provide a template for actual legislative analysis.

SECTION 4. DEFINITIONS.
In this Act:
(1) DEMONSTRATION - means showing how the system works with actual bill content.
(2) SAMPLE - means this is not real legislative text but serves as an example.

SECTION 5. IMPLEMENTATION.
The provisions of this Act shall take effect 90 days after the date of enactment.
        """.strip()
    
    try:
        # Get bill text versions from Congress API
        url = f"https://api.congress.gov/v3/bill/{congress}/{bill_type.lower()}/{bill_number}/text"
        params = {
            "api_key": CONGRESS_API_KEY,
            "format": "json"
        }
        
        async with session.get(url, params=params) as response:
            if response.status != 200:
                logger.error(f"Congress API error fetching bill text: {response.status}")
                raise HTTPException(status_code=500, detail="Error fetching bill text from Congress API")
            
            data = await response.json()
            text_versions = data.get("textVersions", [])
            
            if not text_versions:
                raise ValueError("No text versions available for this bill")
            
            # Get the most recent text version (usually the first one)
            latest_version = text_versions[0]
            text_url = latest_version.get("formats", [])
            
            # Look for plain text format first, then XML
            text_content = None
            for format_info in text_url:
                if format_info.get("type") == "Formatted Text":
                    format_url = format_info.get("url")
                    if format_url:
                        # Fetch the actual text content
                        async with session.get(format_url) as text_response:
                            if text_response.status == 200:
                                text_content = await text_response.text()
                                break
            
            if not text_content:
                # If no formatted text, try to get any available format
                for format_info in text_url:
                    format_url = format_info.get("url")
                    if format_url:
                        async with session.get(format_url) as text_response:
                            if text_response.status == 200:
                                text_content = await text_response.text()
                                break
            
            if not text_content:
                raise ValueError("Could not retrieve bill text content")
            
            # Clean up the text (remove HTML tags if present, etc.)
            import re
            # Basic HTML tag removal
            clean_text = re.sub(r'<[^>]+>', '', text_content)
            # Remove excessive whitespace
            clean_text = re.sub(r'\s+', ' ', clean_text).strip()
            
            return clean_text
            
    except Exception as e:
        logger.error(f"Error fetching bill text for {bill_type} {bill_number}: {e}")
        # Return a more informative mock text on error
        return f"""
{bill_type.upper()} {bill_number} - Bill Text Unavailable

Note: The full text of this bill could not be retrieved from Congress.gov at this time. 
This may be because:
- The bill text is not yet available in the API
- The bill is still being processed
- There was a temporary API issue

For the complete and official text of this legislation, please visit:
https://www.congress.gov/bill/{congress}th-congress/{bill_type.lower()}-bill/{bill_number}

This is a placeholder text for analysis/debate purposes. In a real scenario, 
this would contain the full legislative text including all sections, 
subsections, definitions, and implementation details.
        """.strip()

@app.post("/analyze-recommended-bill")
async def analyze_recommended_bill(request: dict):
    """Analyze a recommended bill directly"""
    try:
        bill_type = request.get("type", "").upper()
        bill_number = request.get("number", "")
        model = request.get("model", DEFAULT_MODEL)
        
        if not bill_type or not bill_number:
            raise HTTPException(status_code=400, detail="Bill type and number are required")
        
        # Fetch the full bill text
        bill_text = await fetch_bill_text(bill_type, bill_number)
        
        # Use a custom analysis function instead of debater chain
        analysis = await analyze_legislation_text(bill_text, model)
        
        return {"analysis": analysis}
        
    except Exception as e:
        logger.error(f"Error analyzing recommended bill: {e}")
        raise HTTPException(status_code=500, detail="Error analyzing bill")

@app.post("/extract-recommended-bill-text")
async def extract_recommended_bill_text(request: dict):
    """Extract text from a recommended bill for debate setup"""
    try:
        bill_type = request.get("type", "").upper()
        bill_number = request.get("number", "")
        bill_title = request.get("title", f"{bill_type} {bill_number}")
        
        if not bill_type or not bill_number:
            raise HTTPException(status_code=400, detail="Bill type and number are required")
        
        # Fetch the full bill text
        bill_text = await fetch_bill_text(bill_type, bill_number)
        
        return {
            "text": f"{bill_title}\n\n{bill_text}",
            "title": bill_title
        }
        
    except Exception as e:
        logger.error(f"Error extracting recommended bill text: {e}")
        raise HTTPException(status_code=500, detail="Error extracting bill text")