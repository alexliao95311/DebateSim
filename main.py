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
backend_origins = os.getenv("BACKEND_ORIGINS", "http://localhost,http://127.0.0.1,http://20.3.246.40,http://localhost:80,http://127.0.0.1:80,http://20.3.246.40:80,http://localhost:3000,http://127.0.0.1:3000,http://20.3.246.40:3000,http://20.3.246.40:5000,http://172.190.97.150:3000,http://172.190.97.150:80,http://172.190.97.150:5000,http://debatesim.us,https://debatesim.us").split(",")
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

class GenerateResponseRequest(BaseModel):
    debater: str  # e.g., "Pro" or "Con"
    prompt: str   # Expected format: "debate topic. opponent's argument"
    model: str = DEFAULT_MODEL  # Use the global default model
    bill_description: str = ""  # Full bill text for evidence-based arguments

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
        
        # Use provided bill description or fallback to topic
        bill_description = request.bill_description if request.bill_description.strip() else topic
        
        # Handle large bill texts for debates - truncate to avoid token limits
        if len(bill_description) > 30000:  # Conservative limit for debates
            logger.info(f"Bill text too long for debate ({len(bill_description)} chars), truncating for debate context")
            # Extract key portions for debate context
            bill_description = extract_key_bill_sections(bill_description, 25000)
            logger.info(f"Truncated bill text for debate: {len(bill_description)} chars")
        
        # Get a debater chain with the specified model
        model_specific_debater_chain = get_debater_chain(request.model)
        
        # Call the run method
        ai_output = model_specific_debater_chain.run(
            debater_role=debater_role,
            topic=topic,
            bill_description=bill_description,  # Now uses actual bill text
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

def extract_key_bill_sections(bill_text: str, max_chars: int) -> str:
    """
    Intelligently extract key sections from large bills for analysis
    """
    import re
    
    # Split into lines for processing
    lines = bill_text.split('\n')
    
    # Priority sections to always include (case insensitive)
    priority_patterns = [
        r'SHORT TITLE|TITLE.*Act',
        r'FINDINGS|PURPOSES?|POLICY',
        r'DEFINITIONS?',
        r'SECTION 1\.|SEC\. 1\.',
        r'AUTHORIZATION|APPROPRIATION',
        r'EFFECTIVE DATE|SUNSET|TERMINATION'
    ]
    
    # Section markers to identify content blocks
    section_markers = [
        r'SECTION \d+\.|SEC\. \d+\.',
        r'TITLE [IVX]+',
        r'CHAPTER \d+',
        r'PART [A-Z]+',
        r'Subtitle [A-Z]'
    ]
    
    key_sections = []
    current_section = []
    section_header = ""
    chars_used = 0
    
    # Always include the beginning (title, short title, etc.) - but limit it
    header_lines = min(30, len(lines))
    header_text = '\n'.join(lines[:header_lines])
    if len(header_text) > max_chars * 0.2:  # Don't let header use more than 20% of space
        header_text = header_text[:int(max_chars * 0.2)]
    key_sections.append(f"=== BILL HEADER ===\n{header_text}")
    chars_used += len(header_text)
    
    # Process remaining lines looking for important sections
    for i, line in enumerate(lines[header_lines:], header_lines):
        line_upper = line.strip().upper()
        
        # Check if this line starts a new section
        is_section_start = any(re.match(pattern, line_upper) for pattern in section_markers)
        is_priority = any(re.search(pattern, line_upper) for pattern in priority_patterns)
        
        if is_section_start or is_priority:
            # Save previous section if it exists and we have room
            if current_section and chars_used < max_chars * 0.7:
                section_text = '\n'.join(current_section)
                # Limit individual sections to prevent one section from dominating
                if len(section_text) > max_chars * 0.15:  # Max 15% per section
                    section_text = section_text[:int(max_chars * 0.15)] + "\n[Section truncated...]"
                
                if chars_used + len(section_text) < max_chars * 0.8:
                    key_sections.append(f"=== {section_header} ===\n{section_text}")
                    chars_used += len(section_text)
            
            # Start new section
            current_section = [line]
            section_header = line.strip()[:100]  # Limit header length
        else:
            current_section.append(line)
        
        # Stop if we're approaching the limit
        if chars_used > max_chars * 0.8:
            break
    
    # Add the last section if there's room
    if current_section and chars_used < max_chars * 0.7:
        section_text = '\n'.join(current_section)
        # Apply same size limit to last section
        if len(section_text) > max_chars * 0.15:
            section_text = section_text[:int(max_chars * 0.15)] + "\n[Section truncated...]"
        
        if chars_used + len(section_text) < max_chars * 0.8:
            key_sections.append(f"=== {section_header} ===\n{section_text}")
    
    # Combine all sections
    result = '\n\n'.join(key_sections)
    
    # Final safety check
    if len(result) > max_chars * 0.9:
        result = result[:int(max_chars * 0.9)] + "\n\n[Content truncated to fit limits...]"
    
    # Add summary note
    result += f"\n\n[NOTE: This analysis covers key sections extracted from a {len(bill_text):,} character bill. The analysis focuses on the most important provisions including title, definitions, main sections, and implementation details.]"
    
    return result

async def analyze_legislation_text(bill_text: str, model: str) -> str:
    """Analyze legislation text with a custom analysis prompt"""
    
    # Debug logging
    logger.info(f"Analyzing bill text with model {model}")
    logger.info(f"Bill text length for analysis: {len(bill_text)}")
    
    # Check if bill text is unavailable from Congress.gov
    if "Bill Text Unavailable" in bill_text or "could not be retrieved from Congress.gov" in bill_text:
        logger.warning("Bill text unavailable from Congress.gov API")
        return f"""
# Bill Text Currently Unavailable

## Notice
The full text of this bill could not be retrieved from Congress.gov at this time.

## Possible Reasons
This may occur because:
- The bill text is not yet available in the Congressional API
- The bill is still being processed by Congress
- There was a temporary API issue
- The bill may be very recent or in early stages

## What You Can Do
1. **Check Congress.gov directly**: Visit the official Congress.gov website to see if the full text is available there
2. **Try again later**: Bill text may become available as it progresses through the legislative process
3. **Upload a PDF**: If you have access to the bill text in PDF format, you can upload it directly for analysis
4. **Use Debate Mode**: You can still set up a debate about this bill using the title and description

## Alternative Analysis
Based on the bill information available:
- **Bill Number**: {bill_text.split()[0] if bill_text.split() else 'Unknown'}
- **Status**: Text retrieval from official sources currently unavailable
- **Recommendation**: Check back later or use alternative methods mentioned above

*This is an automated message when official bill text cannot be retrieved from Congress.gov.*
        """.strip()
    
    # Handle large bill texts by creating a smart summary approach
    max_chars = 40000  # Conservative limit to avoid API token limits
    
    if len(bill_text) > max_chars:
        logger.info(f"Bill text too long ({len(bill_text)} chars), using intelligent summarization approach")
        
        # Extract key sections for analysis
        bill_analysis_text = extract_key_bill_sections(bill_text, max_chars)
        logger.info(f"After extraction: {len(bill_analysis_text)} chars")
        
        # Double-check: if still too long, do emergency truncation
        if len(bill_analysis_text) > max_chars:
            logger.warning(f"Extracted text still too long ({len(bill_analysis_text)} chars), applying emergency truncation")
            bill_analysis_text = bill_analysis_text[:max_chars-1000] + "\n\n[NOTE: Bill text was truncated due to length constraints.]"
            logger.info(f"Final length after emergency truncation: {len(bill_analysis_text)} chars")
        
    else:
        bill_analysis_text = bill_text
    
    analysis_prompt = f"""
You are a legislative analyst providing a comprehensive analysis of the following bill. The bill text may include key extracted sections marked with === headers === for large bills.

BILL TEXT:
{bill_analysis_text}

Please provide a detailed analysis with the following sections:

## Executive Summary
Provide a 2-3 sentence overview of what this bill does and its main purpose based on the title, findings, and key provisions.

## Bill Details
- **Bill Title**: Extract the official title and short title if available
- **Primary Sponsor**: Identify who drafted/sponsored this bill (if mentioned in the text)
- **Legislative Goals**: What are the main objectives this bill aims to achieve?
- **Key Provisions**: List the 3-5 most important sections or provisions from the extracted content

## Policy Analysis
### Potential Benefits
- Identify 2-3 positive aspects or benefits this bill could provide
- Support each point with specific text evidence from the available sections

### Potential Concerns
- Identify 2-3 potential problems, challenges, or negative consequences
- Support each point with specific text evidence from the available sections

### Implementation Considerations
- What challenges might arise in implementing this legislation?
- Are there any unclear provisions or potential ambiguities?
- Consider authorization levels, effective dates, and enforcement mechanisms if mentioned

## Evidence from Bill Text
For each major point you make, include direct quotes from the bill sections to support your analysis. Format quotes as:
> "Direct quote from the bill"

## Overall Assessment
Provide a balanced conclusion about the bill's likely effectiveness and impact based on the available sections. If this analysis is based on extracted sections rather than the full bill, note that the assessment covers the key provisions reviewed.

Please ensure your analysis is objective, evidence-based, and draws directly from the bill text sections provided.
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
        # Try once more with an even smaller text sample if the error suggests token limits
        if "400" in str(e) or "token" in str(e).lower():
            try:
                logger.info("Attempting analysis with emergency reduced text size")
                # Emergency fallback - use only first 20k characters
                emergency_text = bill_analysis_text[:20000] + "\n\n[NOTE: Emergency text reduction applied due to API limits]"
                
                emergency_prompt = f"""
Please provide a brief analysis of this bill excerpt:

{emergency_text}

Include:
1. Executive Summary (2-3 sentences)
2. Main Purpose
3. Key Provisions identified
4. Note that this is a partial analysis due to length constraints

Keep response concise and focused.
"""
                
                payload_emergency = {
                    "model": model,
                    "messages": [
                        {"role": "system", "content": "You are a legislative analyst. Provide concise, factual analysis."},
                        {"role": "user", "content": emergency_prompt}
                    ],
                    "temperature": 0.3,
                    "max_tokens": 2000  # Limit response size too
                }
                
                async with session.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload_emergency) as response:
                    if response.status == 200:
                        result = await response.json()
                        return result["choices"][0]["message"]["content"]
                        
            except Exception as emergency_error:
                logger.error(f"Emergency analysis also failed: {emergency_error}")
        
        # Return a basic fallback analysis
        return f"""
# Legislative Analysis - Processing Error

## Notice
This analysis could not be completed due to technical limitations with the bill size or API constraints.

## What We Know
- **Bill Size**: {len(bill_text):,} characters
- **Processing Status**: Text extraction successful, but analysis failed due to size limitations

## Recommendation
For a complete analysis of this large bill, consider:
1. Reviewing the bill directly on Congress.gov
2. Focusing on specific sections of interest
3. Trying the analysis again (some temporary API issues may resolve)

## Alternative
You can try uploading a PDF of specific sections you're most interested in analyzing, or use the debate feature to discuss particular aspects of the legislation.

*Note: This is an automated response due to processing limitations with very large bills.*
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
            # Remove HTML entities
            clean_text = re.sub(r'&lt;', '<', clean_text)
            clean_text = re.sub(r'&gt;', '>', clean_text)
            clean_text = re.sub(r'&amp;', '&', clean_text)
            clean_text = re.sub(r'&quot;', '"', clean_text)
            clean_text = re.sub(r'&apos;', "'", clean_text)
            # Remove excessive whitespace
            clean_text = re.sub(r'\s+', ' ', clean_text).strip()
            # Remove document metadata that's not useful for analysis
            clean_text = re.sub(r'\[Congressional Bills.*?\]', '', clean_text)
            clean_text = re.sub(r'\[From the U\.S\. Government Publishing Office\]', '', clean_text)
            clean_text = re.sub(r'&lt;DOC&gt;.*?&lt;/DOC&gt;', '', clean_text, flags=re.DOTALL)
            
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
        
        # Add bill title like the extract endpoint does
        bill_title = f"{bill_type} {bill_number}"
        full_bill_text = f"{bill_title}\n\n{bill_text}"
        
        # Debug logging
        logger.info(f"Fetched bill text length: {len(full_bill_text)}")
        logger.info(f"Bill text preview: {full_bill_text[:200]}...")
        
        # Use a custom analysis function instead of debater chain
        analysis = await analyze_legislation_text(full_bill_text, model)
        
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