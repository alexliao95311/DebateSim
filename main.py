import os
import time
import asyncio
import logging
import re
from datetime import datetime
from fastapi import FastAPI, HTTPException, BackgroundTasks, UploadFile, File, Form
from fastapi.responses import StreamingResponse
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
from typing import List, Dict, Any, AsyncGenerator, Optional

from chains.debater_chain import get_debater_chain
from chains.judge_chain import judge_chain, get_judge_chain
from billsearch import BillSearcher
from legiscan_service import LegiScanService
from ca_propositions_service import CAPropositionsService

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

LEGISCAN_API_KEY = os.getenv("LEGISCAN_API_KEY")
if not LEGISCAN_API_KEY:
    logger.warning("LEGISCAN_API_KEY not found. State bills will not be available.")

# Global model configuration
DEFAULT_MODEL = "openai/gpt-4o-mini"
FALLBACK_MODEL = "meta-llama/llama-3.3-70b-instruct"

# Initialize OpenAI client (not directly used since we are calling the API via aiohttp)
client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=API_KEY
)

# FastAPI application with file size limit
app = FastAPI(
    title="DebateSim API",
    description="Legislative analysis and debate simulation API",
    version="1.0.0"
)

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

class AnalysisRequest(BaseModel):
    text: str
    model: str = DEFAULT_MODEL  # Use the global default model
    userProfile: dict = None  # Optional user profile for personalized analysis

# Connection pooling with optimizations - will be initialized lazily
connector = None

def get_connector():
    global connector
    if connector is None:
        connector = aiohttp.TCPConnector(
            limit=30,
            limit_per_host=20,
            ttl_dns_cache=300,
            use_dns_cache=True,
            keepalive_timeout=60,
            enable_cleanup_closed=True
        )
    return connector

# Cache for AI responses (key now includes model_override and skip_formatting)
cache = TTLCache(maxsize=200, ttl=600)  # Cache up to 200 items for 10 minutes

# Global session variable
session = None
bill_searcher = None
legiscan_service = None
ca_props_service = None

@app.on_event("startup")
async def startup_event():
    global session, bill_searcher, legiscan_service, ca_props_service
    session = aiohttp.ClientSession(connector=get_connector())
    bill_searcher = BillSearcher(session)
    if LEGISCAN_API_KEY:
        legiscan_service = LegiScanService(LEGISCAN_API_KEY, session)
        logger.info("LegiScan service initialized")
    else:
        logger.warning("LegiScan service not initialized - API key missing")

    # Initialize CA Propositions service
    ca_props_service = CAPropositionsService()
    logger.info("CA Propositions service initialized")

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
    full_transcript: str = ""  # Full debate transcript for context
    round_num: int = 1  # Current round number
    persona: str = "Default AI"  # Persona name for logging
    debate_format: str = "default"  # Debate format (default, public-forum)
    speaking_order: str = "pro-first"  # Speaking order for public forum (pro-first, con-first)

@app.post("/generate-response")
async def generate_response(request: GenerateResponseRequest):
    start_time = time.time()
    logger.info(f"📩 /generate-response called with debater={request.debater!r}, model={request.model}, round={request.round_num}")
    
    # DEBUG: Print what transcript data we're receiving
    logger.info(f"🔍 DEBUG: Full transcript length: {len(request.full_transcript)} chars")
    if request.full_transcript:
        logger.info(f"🔍 DEBUG: Full transcript preview: {request.full_transcript[:300]}...")
    else:
        logger.info("🔍 DEBUG: No full transcript provided")
    
    # Determine role: "Pro" or "Con" - ensure AI is properly capitalized
    debater_role = request.debater.strip().title().replace("Ai ", "AI ")
    
    try:
        # Check if this is a detailed frontend prompt (direct prompt)
        # These should NOT be parsed - they're complete prompts ready to send to the LLM
        is_detailed_prompt = (
            len(request.prompt) > 800 and (
                "ABSOLUTE PRIORITY" in request.prompt or
                "CRITICAL WORD COUNT" in request.prompt or
                "SPEAKING STYLE:" in request.prompt or
                "PUBLIC FORUM REQUIREMENTS" in request.prompt or
                "LINCOLN-DOUGLAS REQUIREMENTS" in request.prompt or
                "RIGID FORMAT" in request.prompt
            )
        )

        if is_detailed_prompt:
            # Don't parse detailed prompts - they're already complete
            # Just use a placeholder topic since the chain will use the full prompt directly
            topic = "Debate topic (see full prompt)"
            opponent_arg = ""
            logger.info(f"🔍 DEBUG: Detected detailed frontend prompt ({len(request.prompt)} chars) - skipping parsing")
        else:
            # Parse out topic and opponent argument for simple prompts
            parts = request.prompt.split('.', 1)
            if len(parts) > 1:
                topic = parts[0].strip()
                opponent_arg = parts[1].strip()
            else:
                topic = request.prompt.strip()
                opponent_arg = ""

            # DEBUG: Show what we parsed
            logger.info(f"🔍 DEBUG: Parsed topic: {topic}")
            logger.info(f"🔍 DEBUG: Opponent argument: {opponent_arg[:200]}..." if opponent_arg else "🔍 DEBUG: No opponent argument")
        
        # Determine debate type based on bill_description content
        has_bill_text = bool(request.bill_description.strip())
        bill_description = request.bill_description if has_bill_text else topic
        
        # Determine debate type: if we have actual bill text, it's a bill debate
        debate_type = "bill" if has_bill_text else "topic"
        logger.info(f"Debate type determined: {debate_type} (bill_description length: {len(bill_description)} chars)")
        
        # Handle large bill texts for debates - extract key sections to avoid token limits
        if has_bill_text and len(bill_description) > 30000:  # Conservative limit for debates
            logger.info(f"Bill text too long for debate ({len(bill_description)} chars), extracting key sections for debate context")
            # Extract key portions for debate context using intelligent extraction
            original_length = len(bill_description)
            bill_description = extract_key_bill_sections(bill_description, 25000)
            logger.info(f"Extracted key sections for debate: {len(bill_description)} chars (from {original_length} chars)")
            logger.info("Key sections include: title, findings, definitions, main provisions, and implementation details")
        
        # Get a debater chain with the specified model, debate type, and format
        model_specific_debater_chain = get_debater_chain(request.model, debate_type=debate_type, debate_format=request.debate_format, speaking_order=request.speaking_order)
        
        # DEBUG: Print what we're sending to the LangChain model
        logger.info(f"🔍 DEBUG: Sending to LangChain:")
        logger.info(f"🔍 DEBUG: - debater_role: {debater_role}")
        logger.info(f"🔍 DEBUG: - topic: {topic}")
        logger.info(f"🔍 DEBUG: - bill_description length: {len(bill_description)}")
        logger.info(f"🔍 DEBUG: - round_num: {request.round_num}")
        logger.info(f"🔍 DEBUG: - history: {opponent_arg[:200]}..." if opponent_arg else "🔍 DEBUG: - history: None")
        logger.info(f"🔍 DEBUG: - full_transcript: {request.full_transcript[:200]}..." if request.full_transcript else "🔍 DEBUG: - full_transcript: None")
        logger.info(f"🔍 DEBUG: - persona_prompt length: {len(request.prompt)}")
        logger.info(f"🔍 DEBUG: - persona_prompt preview: {request.prompt[:300]}...")
        logger.info(f"🔍 DEBUG: - debate_format: {request.debate_format}")
        logger.info(f"🔍 DEBUG: - speaking_order: {request.speaking_order}")
        
        # Call the run method - pass full transcript for context and the original prompt for persona instructions
        ai_output = model_specific_debater_chain.run(
            debater_role=debater_role,
            topic=topic,
            bill_description=bill_description,  # Now uses actual bill text
            history=opponent_arg,
            full_transcript=request.full_transcript,  # Pass the full transcript for proper context
            round_num=request.round_num,  # Pass the current round number
            persona_prompt=request.prompt,  # Pass the full prompt which contains persona instructions
            persona=request.persona,  # Pass the persona name directly for logging
            prompt=request.prompt  # Also pass the prompt directly for direct prompt detection
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
async def analyze_legislation(file: UploadFile = File(...), model: str = Form(DEFAULT_MODEL), userProfile: str = Form(None)):
    logger.info(f"Received analyze-legislation request with model: {model}")
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a PDF file.")
    
    # Check file size before processing
    file_size = 0
    try:
        file.file.seek(0, 2)  # Seek to end
        file_size = file.file.tell()
        file.file.seek(0)  # Reset to beginning
        logger.info(f"PDF file size: {file_size} bytes ({file_size / (1024*1024):.1f} MB)")
        
        if file_size > 50 * 1024 * 1024:  # 50MB limit
            raise HTTPException(status_code=413, detail="File too large. Please upload a PDF smaller than 50MB.")
            
    except Exception as size_error:
        logger.warning(f"Could not determine file size: {size_error}")
    
    try:
        logger.info(f"Starting PDF processing for file: {file.filename}")
        contents = await file.read()
        logger.info(f"PDF file read complete, size: {len(contents)} bytes")
        
        # Extract text using pdfminer.six with optimized settings
        from pdfminer.high_level import extract_text
        from pdfminer.layout import LAParams
        
        # Optimize pdfminer settings for speed (compatible across versions)
        try:
            # Try with newer parameters first
            laparams = LAParams(
                char_margin=2.0,
                line_margin=0.5,
                word_margin=0.1,
                boxes_flow=0.5,
                detect_vertical=False,  # Disable vertical text detection for speed
                all_texts=False  # Skip non-text elements
            )
        except TypeError:
            # Fall back to basic parameters for older versions
            laparams = LAParams(
                char_margin=2.0,
                line_margin=0.5,
                word_margin=0.1,
                boxes_flow=0.5
            )
        
        logger.info("Starting text extraction from PDF...")
        start_time = time.time()
        text = extract_text(
            BytesIO(contents), 
            laparams=laparams, 
            caching=True,
            codec='utf-8'
        )
        extraction_time = time.time() - start_time
        logger.info(f"Text extraction complete in {extraction_time:.2f}s, extracted {len(text)} characters")
        
        if not text.strip():
            raise ValueError("No extractable text found in PDF.")
    except Exception as e:
        logger.error(f"Error processing PDF file: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error processing PDF file: " + str(e))

    try:
        # Parse user profile if provided
        parsed_user_profile = None
        if userProfile:
            try:
                parsed_user_profile = json.loads(userProfile)
                logger.info("User profile data provided for personalized analysis")
            except json.JSONDecodeError as e:
                logger.warning(f"Invalid user profile JSON, proceeding without personalization: {e}")

        # Optimize large bill processing by extracting key sections once
        processed_text = text
        if len(text) > 40000:  # Same threshold as analyze_legislation_text
            logger.info(f"Large bill detected ({len(text)} chars), extracting key sections once for both analysis and grading")
            processed_text = extract_key_bill_sections(text, 40000)
            logger.info(f"Key sections extracted: {len(processed_text)} chars")

        # Log consolidated processing info
        logger.info(f"Processing bill with model {model} - text length: {len(processed_text)} chars")

        # Generate both analysis and grades using the processed text
        analysis = await analyze_legislation_text(processed_text, model, skip_extraction=True, user_profile=parsed_user_profile)
        grades = await grade_legislation_text(processed_text, model, skip_extraction=True)
    except Exception as e:
        logger.error(f"Error in analyze_legislation_text: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error analyzing legislation")

    return {"analysis": analysis, "grades": grades, "extractedText": text}

@app.post("/analyze-legislation-text")
async def analyze_legislation_text_endpoint(request: AnalysisRequest):
    """Analyze legislation text directly without PDF extraction."""
    try:
        # Log consolidated processing info
        logger.info(f"Processing text input with model {request.model} - text length: {len(request.text)} chars")
        
        # Generate both analysis and grades (skip redundant logging since this is direct text input)
        analysis = await analyze_legislation_text(request.text, request.model, skip_extraction=True, user_profile=request.userProfile)
        grades = await grade_legislation_text(request.text, request.model, skip_extraction=True)
    except Exception as e:
        logger.error(f"Error in analyze_legislation_text: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error analyzing legislation")

    return {"analysis": analysis, "grades": grades}

@app.post("/extract-text")
async def extract_text_endpoint(file: UploadFile = File(...)):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a PDF file.")
    
    # Check file size before processing
    file_size = 0
    try:
        file.file.seek(0, 2)  # Seek to end
        file_size = file.file.tell()
        file.file.seek(0)  # Reset to beginning
        logger.info(f"PDF file size: {file_size} bytes ({file_size / (1024*1024):.1f} MB)")
        
        if file_size > 50 * 1024 * 1024:  # 50MB limit
            raise HTTPException(status_code=413, detail="File too large. Please upload a PDF smaller than 50MB.")
            
    except Exception as size_error:
        logger.warning(f"Could not determine file size: {size_error}")
    
    try:
        logger.info(f"Starting PDF text extraction for file: {file.filename}")
        contents = await file.read()
        logger.info(f"PDF file read complete, size: {len(contents)} bytes")
        
        # Extract text using pdfminer.six with optimized settings
        from pdfminer.high_level import extract_text
        from pdfminer.layout import LAParams
        
        # Optimize pdfminer settings for speed
        laparams = LAParams(
            char_margin=2.0,
            line_margin=0.5,
            word_margin=0.1,
            boxes_flow=0.5,
            detect_vertical=False,  # Disable vertical text detection for speed
            all_texts=False  # Skip non-text elements
        )
        
        logger.info("Starting text extraction from PDF...")
        start_time = time.time()
        text = extract_text(
            BytesIO(contents), 
            laparams=laparams, 
            caching=True,
            codec='utf-8'
        )
        extraction_time = time.time() - start_time
        logger.info(f"Text extraction complete in {extraction_time:.2f}s, extracted {len(text)} characters")
        
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
        raise ValueError("CONGRESS_API_KEY is required for fetching bills from Congress.gov")
    
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
        raise HTTPException(status_code=500, detail=f"Failed to fetch bills from Congress.gov: {str(e)}")

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

async def grade_legislation_text(bill_text: str, model: str, skip_extraction: bool = False) -> dict:
    """Grade legislation text based on the comprehensive rubric"""
    
    # Debug logging (reduced when called together with analysis)
    if not skip_extraction:
        logger.info(f"Grading bill text with model {model}")
        logger.info(f"Bill text length for grading: {len(bill_text)}")
    
    # Check if bill text is unavailable
    if "Bill Text Unavailable" in bill_text or "could not be retrieved from Congress.gov" in bill_text:
        logger.error("Bill text unavailable for grading")
        raise RuntimeError("Cannot grade bill: Bill text is unavailable from Congress.gov")
    
    # Handle large bill texts
    max_chars = 35000  # Conservative limit for grading
    
    if not skip_extraction and len(bill_text) > max_chars:
        logger.info(f"Bill text too long for grading ({len(bill_text)} chars), using key sections")
        bill_grading_text = extract_key_bill_sections(bill_text, max_chars)
        logger.info(f"After extraction for grading: {len(bill_grading_text)} chars")
    else:
        bill_grading_text = bill_text
    
    grading_prompt = f"""
CRITICAL: You must respond with ONLY valid JSON. No explanations, no thinking process, no additional text.

Rate this bill on 5 criteria (0-100 scale):

BILL TEXT:
{bill_grading_text}

Evaluate on:
1. Economic Impact (fiscal responsibility, cost-effectiveness)
2. Public Benefit (benefits to citizens)  
3. Implementation Feasibility (practicality)
4. Legal Soundness (constitutional compliance)
5. Goal Effectiveness (achieves stated objectives)

REQUIRED RESPONSE FORMAT (copy exactly, replace scores):
{{
  "economicImpact": [score],
  "publicBenefit": [score],
  "feasibility": [score],
  "legalSoundness": [score],
  "effectiveness": [score],
  "overall": [weighted average]
}}

IMPORTANT: 
- Respond with ONLY the JSON object above
- No markdown, no backticks, no explanations
- Start with {{ and end with }}
- Use integer scores 0-100
"""
    
    try:
        headers = {
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://debatesim.app",
        }
        
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": "You are a legislative grader. You must respond with ONLY valid JSON. No explanations, no reasoning, no additional text. Start with { and end with }."},
                {"role": "user", "content": grading_prompt}
            ],
            "temperature": 0.1,  # Even lower temperature for more consistent JSON output
            "max_tokens": 200,   # Further reduced to force just JSON response
        }

        # DEBUG: Print AI call details
        print("\n" + "="*80)
        print("🤖 AI CALL - GRADING")
        print("="*80)
        print(f"Model: {model}")
        print(f"System Prompt: {payload['messages'][0]['content']}")
        print(f"User Prompt (first 500 chars):\n{grading_prompt[:500]}...")
        print(f"Temperature: {payload['temperature']}")
        print(f"Max Tokens: {payload['max_tokens']}")
        print("="*80 + "\n")

        async with session.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload) as response:
            if response.status != 200:
                logger.error(f"OpenRouter API error in grading: {response.status}")
                raise HTTPException(status_code=500, detail="Error generating grades")
            
            result = await response.json()
            grades_text = result["choices"][0]["message"]["content"]
            
            # Check if response is empty
            if not grades_text or grades_text.strip() == "":
                logger.error("Empty response from grading API")
                raise ValueError("Empty response from API")
            
            logger.info(f"Raw grading response: {grades_text[:200]}...")
            
            # Parse JSON response
            try:
                import json
                import re
                
                # First try to extract JSON from the response
                # Look for JSON blocks in various formats
                json_patterns = [
                    r'\{[^{}]*"economicImpact"[^{}]*\}',  # Look for our specific structure
                    r'\{[^{}]*"overall"[^{}]*\}',        # Alternative pattern
                    r'\{(?:[^{}]|"[^"]*")*\}',           # Any JSON object
                ]
                
                grades_json = None
                for pattern in json_patterns:
                    match = re.search(pattern, grades_text, re.DOTALL | re.IGNORECASE)
                    if match:
                        grades_json = match.group(0)
                        logger.debug(f"Found JSON with pattern: {pattern}")
                        break
                
                if not grades_json:
                    # If no JSON found, try the whole response
                    grades_json = grades_text.strip()
                    logger.warning("No JSON pattern found, trying whole response")
                
                # Clean up common formatting issues
                grades_json = grades_json.replace('`', '').replace('json', '')
                grades_json = re.sub(r'^[^{]*', '', grades_json)  # Remove text before first {
                grades_json = re.sub(r'}[^}]*$', '}', grades_json)  # Remove text after last }
                
                logger.debug(f"Attempting to parse JSON: {grades_json}")
                grades = json.loads(grades_json)
                
                # Validate and ensure all keys exist with proper ranges
                required_keys = ["economicImpact", "publicBenefit", "feasibility", "legalSoundness", "effectiveness", "overall"]
                for key in required_keys:
                    if key not in grades:
                        grades[key] = 50  # Default to middle score
                    else:
                        # Ensure scores are within 0-100 range
                        grades[key] = max(0, min(100, int(grades[key])))
                
                # Recalculate overall if needed
                if "overall" not in grades or grades["overall"] == 0:
                    # Weighted average: effectiveness (30%), public benefit (25%), others (15% each)
                    grades["overall"] = round(
                        grades["effectiveness"] * 0.30 +
                        grades["publicBenefit"] * 0.25 +
                        grades["economicImpact"] * 0.15 +
                        grades["feasibility"] * 0.15 +
                        grades["legalSoundness"] * 0.15
                    )
                
                logger.info(f"Generated grades: {grades}")
                return grades
                
            except (json.JSONDecodeError, ValueError) as e:
                logger.error(f"Error parsing grades JSON: {e}")
                logger.error(f"Raw response: {grades_text}")
                raise RuntimeError(f"Failed to parse grading response: {e}")
            
    except Exception as e:
        logger.error(f"Error in grade_legislation_text: {e}")
        raise RuntimeError(f"Failed to grade legislation: {e}")

def format_user_profile_for_analysis(user_profile: dict) -> str:
    """Format user profile data for inclusion in analysis prompt"""
    if not user_profile:
        return ""

    # Helper function to format individual fields
    def format_field(label: str, value: str, options: dict = None) -> str:
        if not value or value == 'prefer_not_to_say':
            return f"{label}: Not specified"

        # Map coded values to readable text if options provided
        if options and value in options:
            return f"{label}: {options[value]}"

        return f"{label}: {value}"

    # Define human-readable mappings for coded values
    citizenship_options = {
        'citizen': 'U.S. Citizen',
        'permanent_resident': 'Permanent Resident',
        'temporary_resident': 'Temporary Resident',
        'undocumented': 'Undocumented'
    }

    immigration_options = {
        'visa_holder': 'Visa Holder',
        'asylum_seeker': 'Asylum Seeker',
        'refugee': 'Refugee',
        'daca': 'DACA Recipient',
        'tps': 'TPS Holder',
        'other': 'Other Immigration Status',
        'not_applicable': 'Not Applicable'
    }

    race_options = {
        'american_indian': 'American Indian or Alaska Native',
        'asian': 'Asian',
        'black': 'Black or African American',
        'native_hawaiian': 'Native Hawaiian or Other Pacific Islander',
        'white': 'White',
        'multiracial': 'Two or More Races'
    }

    ethnicity_options = {
        'hispanic_latino': 'Hispanic or Latino',
        'not_hispanic_latino': 'Not Hispanic or Latino'
    }

    income_options = {
        'low_income': 'Low Income (under $25,000)',
        'lower_middle': 'Lower Middle Income ($25,000 - $49,999)',
        'middle_income': 'Middle Income ($50,000 - $99,999)',
        'upper_middle': 'Upper Middle Income ($100,000 - $199,999)',
        'high_income': 'High Income ($200,000+)'
    }

    age_options = {
        'under_18': 'Under 18',
        '18_24': '18-24',
        '25_34': '25-34',
        '35_44': '35-44',
        '45_54': '45-54',
        '55_64': '55-64',
        '65_plus': '65+'
    }

    education_options = {
        'no_high_school': 'No High School Diploma',
        'high_school': 'High School Diploma/GED',
        'some_college': 'Some College',
        'associates': "Associate's Degree",
        'bachelors': "Bachelor's Degree",
        'masters': "Master's Degree",
        'doctoral': 'Doctoral Degree'
    }

    employment_options = {
        'employed_full_time': 'Employed Full-time',
        'employed_part_time': 'Employed Part-time',
        'self_employed': 'Self-employed',
        'unemployed': 'Unemployed',
        'student': 'Student',
        'retired': 'Retired',
        'disabled': 'Unable to work due to disability',
        'homemaker': 'Homemaker'
    }

    disability_options = {
        'no_disability': 'No Disability',
        'physical_disability': 'Physical Disability',
        'cognitive_disability': 'Cognitive Disability',
        'sensory_disability': 'Sensory Disability',
        'mental_health': 'Mental Health Condition',
        'multiple_disabilities': 'Multiple Disabilities'
    }

    veteran_options = {
        'veteran': 'Veteran',
        'active_duty': 'Active Duty',
        'reservist': 'Reservist/National Guard',
        'military_family': 'Military Family Member',
        'not_applicable': 'Not Applicable'
    }

    profile_parts = [
        format_field('Citizenship Status', user_profile.get('citizenshipStatus'), citizenship_options),
        format_field('Immigration Status', user_profile.get('immigrationStatus'), immigration_options),
        format_field('Race', user_profile.get('race'), race_options),
        format_field('Ethnicity', user_profile.get('ethnicity'), ethnicity_options),
        format_field('Income Level', user_profile.get('socioeconomicStatus'), income_options),
        format_field('Age Range', user_profile.get('age'), age_options),
        format_field('Education Level', user_profile.get('education'), education_options),
        format_field('Employment Status', user_profile.get('employment'), employment_options),
        format_field('Disability Status', user_profile.get('disability'), disability_options),
        format_field('Veteran Status', user_profile.get('veteranStatus'), veteran_options)
    ]

    if user_profile.get('other') and user_profile.get('other').strip():
        profile_parts.append(f"Additional Information: {user_profile.get('other').strip()}")

    return '\n'.join(profile_parts)

async def analyze_legislation_text(bill_text: str, model: str, skip_extraction: bool = False, user_profile: dict = None) -> str:
    """Analyze legislation text with a custom analysis prompt"""
    
    # Debug logging (reduced when called together with grading)
    if not skip_extraction:
        logger.info(f"Analyzing bill text with model {model}")
        logger.info(f"Bill text length for analysis: {len(bill_text)}")
        
        # Add progress information for large bill processing
        if len(bill_text) > 40000:
            logger.info(f"Bill text is large ({len(bill_text)} chars), will use intelligent extraction")
    
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

---

## Analysis Information

**Model Used:** {model}
**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}
**Status:** Bill text unavailable

*This is an automated message when official bill text cannot be retrieved from Congress.gov.*
        """.strip()
    
    # Handle large bill texts by creating a smart summary approach
    max_chars = 40000  # Conservative limit to avoid API token limits
    
    if not skip_extraction and len(bill_text) > max_chars:
        logger.info(f"Bill text too long ({len(bill_text)} chars), using intelligent summarization approach")
        
        # Extract key sections for analysis
        bill_analysis_text = extract_key_bill_sections(bill_text, max_chars)
        logger.info(f"After key section extraction: {len(bill_analysis_text)} chars")
        
        # Double-check: if still too long, do emergency truncation
        if len(bill_analysis_text) > max_chars:
            logger.warning(f"Extracted text still too long ({len(bill_analysis_text)} chars), applying emergency truncation")
            bill_analysis_text = bill_analysis_text[:max_chars-1000] + "\n\n[NOTE: Bill text was truncated due to length constraints.]"
            logger.info(f"Final length after emergency truncation: {len(bill_analysis_text)} chars")
        
    else:
        bill_analysis_text = bill_text
    
    # Format user profile context if provided
    user_context = ""
    personalized_section = ""
    if user_profile:
        formatted_profile = format_user_profile_for_analysis(user_profile)
        if formatted_profile:
            user_context = f"""

USER PROFILE CONTEXT:
The analysis should consider how this legislation might specifically affect a person with the following characteristics:
{formatted_profile}
"""
            personalized_section = """

## Impacts on You
Based on the user's profile information provided, analyze how this bill would specifically affect someone with their demographic characteristics, circumstances, and background. Consider:
- Direct impacts on their situation (economic, legal, social)
- Indirect effects through programs, services, or policies they might use
- How their specific demographic group might be affected differently than the general population
- Potential benefits or challenges they might face
- Any special provisions or considerations that apply to their circumstances

Provide concrete, specific examples of how the bill's provisions would translate into real-world impacts for this individual."""

    analysis_prompt = f"""
You are a legislative analyst providing a comprehensive analysis of the following bill. The bill text may include key extracted sections marked with === headers === for large bills.{user_context}

BILL TEXT:
{bill_analysis_text}

Please provide a detailed analysis with the following sections, including specific explanations for grading criteria:

## Executive Summary
Provide a 2-3 sentence overview of what this bill does and its main purpose based on the title, findings, and key provisions.

## Bill Details
- **Bill Title**: Extract the official title and short title if available
- **Primary Sponsor**: Identify who drafted/sponsored this bill (if mentioned in the text)
- **Legislative Goals**: What are the main objectives this bill aims to achieve?
- **Key Provisions**: List the 3-5 most important sections or provisions from the extracted content

## Grading Analysis Explanations
### Economic Impact Assessment
Analyze the bill's fiscal impact, cost-effectiveness, and economic benefits. Consider budget allocations, revenue impacts, and cost-benefit analysis. Explain why this bill scores well or poorly on economic criteria.

### Public Benefit Evaluation
Assess how this bill addresses public needs and benefits different population segments. Consider scope of impact, target demographics, and societal benefits. Explain the public value proposition.

### Implementation Feasibility Review
Evaluate the practicality of executing this legislation. Consider resource requirements, timeline feasibility, administrative capacity, and potential implementation challenges.

### Legal and Constitutional Soundness
Analyze the bill's compliance with constitutional principles and existing legal frameworks. Consider jurisdictional issues, legal precedents, and potential constitutional challenges.

### Goal Effectiveness Analysis
Assess how well the bill addresses its stated problems and achieves intended objectives. Consider whether the proposed solutions match the identified problems and likelihood of success.

## Policy Analysis
### Potential Benefits
- Identify 2-3 positive aspects or benefits this bill could provide
- Explain each point based on the bill's provisions and anticipated outcomes

### Potential Concerns
- Identify 2-3 potential problems, challenges, or negative consequences
- Explain each point based on potential risks and implementation challenges

### Implementation Considerations
- What challenges might arise in implementing this legislation?
- Are there any unclear provisions or potential ambiguities?
- Consider authorization levels, effective dates, and enforcement mechanisms if mentioned
{personalized_section}

## Overall Assessment
Provide a balanced conclusion about the bill's likely effectiveness and impact based on the available sections. If this analysis is based on extracted sections rather than the full bill, note that the assessment covers the key provisions reviewed.

Please ensure your analysis is objective, comprehensive, and provides practical insights about the legislation's likely impact and effectiveness.
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

        # DEBUG: Print AI call details
        print("\n" + "="*80)
        print("🤖 AI CALL - ANALYSIS")
        print("="*80)
        print(f"Model: {model}")
        print(f"System Prompt: {payload['messages'][0]['content']}")
        print(f"User Prompt (first 1000 chars):\n{analysis_prompt[:1000]}...")
        print(f"User Prompt Total Length: {len(analysis_prompt)} characters")
        print(f"Temperature: {payload['temperature']}")
        print("="*80 + "\n")

        async with session.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload) as response:
            if response.status != 200:
                logger.error(f"OpenRouter API error in analysis: {response.status}")
                raise HTTPException(status_code=500, detail="Error generating analysis")
            
            result = await response.json()
            analysis = result["choices"][0]["message"]["content"]
            
            # Add model information to the analysis
            analysis_with_model = f"{analysis}\n\n---\n\n## Analysis Information\n\n**Model Used:** {model}\n**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}"
            
            return analysis_with_model
            
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

                # DEBUG: Print emergency AI call details
                print("\n" + "="*80)
                print("🤖 AI CALL - EMERGENCY ANALYSIS")
                print("="*80)
                print(f"Model: {model}")
                print(f"System Prompt: {payload_emergency['messages'][0]['content']}")
                print(f"User Prompt (first 500 chars):\n{emergency_prompt[:500]}...")
                print(f"User Prompt Total Length: {len(emergency_prompt)} characters")
                print(f"Temperature: {payload_emergency['temperature']}")
                print(f"Max Tokens: {payload_emergency['max_tokens']}")
                print("="*80 + "\n")

                async with session.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload_emergency) as response:
                    if response.status == 200:
                        result = await response.json()
                        emergency_analysis = result["choices"][0]["message"]["content"]
                        
                        # Add model information to emergency analysis
                        emergency_analysis_with_model = f"{emergency_analysis}\n\n---\n\n## Analysis Information\n\n**Model Used:** {model}\n**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}\n**Note:** Emergency reduced analysis due to content length"
                        
                        return emergency_analysis_with_model
                        
            except Exception as emergency_error:
                logger.error(f"Emergency analysis also failed: {emergency_error}")
        
        # Return a basic fallback analysis with model info
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

---

## Analysis Information

**Model Used:** {model}
**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}
**Status:** Processing error fallback

*Note: This is an automated response due to processing limitations with very large bills.*
        """.strip()

def parse_bill_xml(xml_content: str) -> str:
    """
    Parse Congress.gov XML bill format and extract structured text with sections.

    Congress bills use XML with tags like:
    - <section> for sections
    - <header> for section headers
    - <enum> for section numbers
    - <text> for content
    - <title> for titles
    - <chapter>, <part>, <subtitle> for organizational units
    """
    try:
        import xml.etree.ElementTree as ET

        logger.info("Parsing XML bill content")

        # Parse the XML
        try:
            root = ET.fromstring(xml_content)
        except ET.ParseError as e:
            logger.warning(f"XML parsing failed: {e}. Falling back to text extraction.")
            # Fallback: just strip XML tags
            import re
            return re.sub(r'<[^>]+>', '', xml_content)

        # Extract bill text with structure
        bill_parts = []

        def extract_text_recursive(element, level=0):
            """Recursively extract text from XML elements while preserving structure"""
            text_parts = []

            # Extract section header information
            if element.tag in ['section', 'title', 'chapter', 'part', 'subtitle']:
                # Look for enum (section number) and header
                enum = element.find('.//enum')
                header = element.find('.//header')

                section_text = []
                if enum is not None and enum.text:
                    section_text.append(f"\n\nSEC. {enum.text.strip()}")
                if header is not None and header.text:
                    section_text.append(f" {header.text.strip().upper()}")

                if section_text:
                    text_parts.append(''.join(section_text))

            # Extract regular text content
            if element.tag == 'text' and element.text:
                text_parts.append(f"\n{element.text.strip()}")

            # Recursively process child elements
            for child in element:
                child_text = extract_text_recursive(child, level + 1)
                if child_text:
                    text_parts.extend(child_text)

                # Also get tail text (text after the child element)
                if child.tail and child.tail.strip():
                    text_parts.append(child.tail.strip())

            return text_parts

        # Extract text from the root element
        extracted_parts = extract_text_recursive(root)
        bill_text = ' '.join(extracted_parts)

        # Clean up the text
        import re
        # Normalize whitespace
        bill_text = re.sub(r'\s+', ' ', bill_text)
        # Add proper spacing around section markers
        bill_text = re.sub(r'(\n\n)(SEC\.\s+\d+)', r'\1\n\2', bill_text)
        # Clean up excessive newlines
        bill_text = re.sub(r'\n{3,}', '\n\n', bill_text)
        bill_text = bill_text.strip()

        logger.info(f"Extracted {len(bill_text)} characters from XML")
        logger.info(f"XML parsing preview: {bill_text[:300]}...")

        return bill_text

    except Exception as e:
        logger.error(f"Error parsing XML bill: {e}")
        # Fallback: return raw text with XML tags stripped
        import re
        return re.sub(r'<[^>]+>', '', xml_content)

async def fetch_bill_text(bill_type: str, bill_number: str, congress: int = 119) -> str:
    """Fetch full text of a specific bill from Congress.gov API"""
    if not CONGRESS_API_KEY:
        raise ValueError("CONGRESS_API_KEY is required for bill text retrieval")

    try:
        # Get bill text versions from Congress API
        url = f"https://api.congress.gov/v3/bill/{congress}/{bill_type.lower()}/{bill_number}/text"
        params = {
            "api_key": CONGRESS_API_KEY,
            "format": "json"
        }

        async with session.get(url, params=params) as response:
            if response.status == 404:
                logger.error(f"Bill text not found: {bill_type} {bill_number}")
                raise ValueError("No text versions available for this bill")
            elif response.status != 200:
                logger.error(f"Congress API error fetching bill text: {response.status}")
                raise HTTPException(status_code=500, detail="Error fetching bill text from Congress API")

            data = await response.json()
            text_versions = data.get("textVersions", [])

            if not text_versions:
                raise ValueError("No text versions available for this bill")

            # Get the most recent text version (usually the first one)
            latest_version = text_versions[0]
            text_url = latest_version.get("formats", [])

            # Try XML format first (most structured), then formatted text
            text_content = None
            is_xml = False

            for format_info in text_url:
                format_type = format_info.get("type", "")
                if "XML" in format_type.upper():
                    format_url = format_info.get("url")
                    if format_url:
                        logger.info(f"Fetching XML format from: {format_url}")
                        async with session.get(format_url) as text_response:
                            if text_response.status == 200:
                                text_content = await text_response.text()
                                is_xml = True
                                logger.info(f"Successfully fetched XML format ({len(text_content)} chars)")
                                break

            # Fallback to formatted text if XML not available
            if not text_content:
                for format_info in text_url:
                    if format_info.get("type") == "Formatted Text":
                        format_url = format_info.get("url")
                        if format_url:
                            async with session.get(format_url) as text_response:
                                if text_response.status == 200:
                                    text_content = await text_response.text()
                                    break

            # Last resort - try any available format
            if not text_content:
                for format_info in text_url:
                    format_url = format_info.get("url")
                    if format_url:
                        async with session.get(format_url) as text_response:
                            if text_response.status == 200:
                                text_content = await text_response.text()
                                break

            if not text_content:
                raise ValueError("Could not retrieve bill text content")

            # Parse XML if we got XML format
            if is_xml:
                logger.info("Parsing XML bill format")
                text_content = parse_bill_xml(text_content)
            
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
            # Normalize line endings and clean up whitespace more carefully
            clean_text = re.sub(r'\r\n', '\n', clean_text)  # Normalize line endings
            clean_text = re.sub(r'[ \t]+', ' ', clean_text)  # Multiple spaces/tabs to single space

            # Preserve some structure by keeping line breaks around section headers
            # Look for section patterns and ensure they start on new lines
            section_patterns = [
                r'(SEC(?:TION)?\.?\s+\d+[A-Z]?\.)',
                r'(TITLE\s+[IVX]+)',
                r'(CHAPTER\s+\d+)',
                r'(PART\s+[A-Z]+)',
                r'(SUBTITLE\s+[A-Z]+)'
            ]

            for pattern in section_patterns:
                # Ensure section headers start on new lines
                clean_text = re.sub(f'(?<!^)(?<!\n){pattern}', r'\n\1', clean_text, flags=re.IGNORECASE)

            # Clean up excessive newlines but keep some structure
            clean_text = re.sub(r'\n\s*\n\s*\n+', '\n\n', clean_text)  # Multiple newlines to double
            clean_text = clean_text.strip()
            # Remove document metadata that's not useful for analysis
            clean_text = re.sub(r'\[Congressional Bills.*?\]', '', clean_text)
            clean_text = re.sub(r'\[From the U\.S\. Government Publishing Office\]', '', clean_text)
            clean_text = re.sub(r'&lt;DOC&gt;.*?&lt;/DOC&gt;', '', clean_text, flags=re.DOTALL)
            
            return clean_text
            
    except HTTPException:
        # Let HTTPException propagate up without re-raising as RuntimeError
        raise
    except Exception as e:
        logger.error(f"Error fetching bill text for {bill_type} {bill_number}: {e}")
        raise RuntimeError(f"Failed to fetch bill text for {bill_type} {bill_number}: {str(e)}")

@app.post("/analyze-recommended-bill")
async def analyze_recommended_bill(request: dict):
    """Analyze a recommended bill directly"""
    try:
        bill_type = request.get("type", "").upper()
        bill_number = request.get("number", "")
        congress = request.get("congress", 119)  # Default to current congress
        model = request.get("model", DEFAULT_MODEL)
        
        if not bill_type or not bill_number:
            raise HTTPException(status_code=400, detail="Bill type and number are required")
        
        logger.info(f"Analyzing bill {bill_type} {bill_number} from {congress}th Congress")
        
        # Fetch the full bill text
        bill_text = await fetch_bill_text(bill_type, bill_number, congress)
        
        # Add bill title like the extract endpoint does
        bill_title = f"{bill_type} {bill_number}"
        full_bill_text = f"{bill_title}\n\n{bill_text}"
        
        # Debug logging
        logger.info(f"Fetched bill text length: {len(full_bill_text)}")
        logger.info(f"Bill text preview: {full_bill_text[:200]}...")
        
        # Log consolidated processing info
        logger.info(f"Processing recommended bill {bill_title} with model {model}")
        
        # Check if we need to process large bill text
        if len(full_bill_text) > 40000:
            logger.info(f"Large bill detected ({len(full_bill_text)} chars), extracting key sections for analysis")
            processed_text = extract_key_bill_sections(full_bill_text, 40000)
            logger.info(f"Key sections extracted: {len(processed_text)} chars")
            
            # Generate both analysis and grades using processed text
            analysis = await analyze_legislation_text(processed_text, model, skip_extraction=True, user_profile=None)
            grades = await grade_legislation_text(processed_text, model, skip_extraction=True)
        else:
            # Generate both analysis and grades using full text
            analysis = await analyze_legislation_text(full_bill_text, model, skip_extraction=True, user_profile=None)
            grades = await grade_legislation_text(full_bill_text, model, skip_extraction=True)
        
        return {"analysis": analysis, "grades": grades}
        
    except RuntimeError as e:
        # Check if this is a "no text versions available" error or 404 error
        error_str = str(e)
        if "No text versions available" in error_str or "404 Not Found" in error_str:
            logger.error(f"No text available for bill {bill_type} {bill_number}")
            raise HTTPException(status_code=404, detail="No bill text available yet. This bill may not have been published or may still be in draft form.")
        else:
            logger.error(f"Error fetching bill text: {e}")
            raise HTTPException(status_code=500, detail="Error fetching bill text from Congress API")
    except Exception as e:
        logger.error(f"Error analyzing recommended bill: {e}")
        raise HTTPException(status_code=500, detail="Error analyzing bill")

@app.post("/grade-legislation")
async def grade_legislation(file: UploadFile = File(...), model: str = DEFAULT_MODEL):
    """Grade a legislation PDF based on the comprehensive rubric"""
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a PDF file.")
    
    # Check file size before processing
    file_size = 0
    try:
        file.file.seek(0, 2)  # Seek to end
        file_size = file.file.tell()
        file.file.seek(0)  # Reset to beginning
        logger.info(f"PDF file size: {file_size} bytes ({file_size / (1024*1024):.1f} MB)")
        
        if file_size > 50 * 1024 * 1024:  # 50MB limit
            raise HTTPException(status_code=413, detail="File too large. Please upload a PDF smaller than 50MB.")
            
    except Exception as size_error:
        logger.warning(f"Could not determine file size: {size_error}")
    
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
        # Generate grades for the legislation
        grades = await grade_legislation_text(text, model)
    except Exception as e:
        logger.error(f"Error in grade_legislation_text: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error grading legislation")

    return {"grades": grades}

@app.post("/grade-recommended-bill")
async def grade_recommended_bill(request: dict):
    """Grade a recommended bill based on the comprehensive rubric"""
    try:
        bill_type = request.get("type", "").upper()
        bill_number = request.get("number", "")
        congress = request.get("congress", 119)  # Default to current congress
        model = request.get("model", DEFAULT_MODEL)
        
        if not bill_type or not bill_number:
            raise HTTPException(status_code=400, detail="Bill type and number are required")
        
        logger.info(f"Grading bill {bill_type} {bill_number} from {congress}th Congress")
        
        # Fetch the full bill text
        bill_text = await fetch_bill_text(bill_type, bill_number, congress)
        
        # Add bill title
        bill_title = f"{bill_type} {bill_number}"
        full_bill_text = f"{bill_title}\n\n{bill_text}"
        
        # Generate grades for the bill
        grades = await grade_legislation_text(full_bill_text, model)
        
        return {"grades": grades}
        
    except RuntimeError as e:
        # Check if this is a "no text versions available" error or 404 error
        error_str = str(e)
        if "No text versions available" in error_str or "404 Not Found" in error_str:
            logger.error(f"No text available for bill {bill_type} {bill_number}")
            raise HTTPException(status_code=404, detail="No bill text available yet. This bill may not have been published or may still be in draft form.")
        else:
            logger.error(f"Error fetching bill text: {e}")
            raise HTTPException(status_code=500, detail="Error fetching bill text from Congress API")
    except Exception as e:
        logger.error(f"Error grading recommended bill: {e}")
        raise HTTPException(status_code=500, detail="Error grading bill")

@app.post("/extract-recommended-bill-text")
async def extract_recommended_bill_text(request: dict):
    """Extract text from a recommended bill for debate setup"""
    try:
        bill_type = request.get("type", "").upper()
        bill_number = request.get("number", "")
        congress = request.get("congress", 119)  # Default to current congress
        bill_title = request.get("title", f"{bill_type} {bill_number}")
        
        if not bill_type or not bill_number:
            raise HTTPException(status_code=400, detail="Bill type and number are required")
        
        logger.info(f"Extracting text for bill {bill_type} {bill_number} from {congress}th Congress")
        
        # Fetch the full bill text
        bill_text = await fetch_bill_text(bill_type, bill_number, congress)
        
        return {
            "text": f"{bill_title}\n\n{bill_text}",
            "title": bill_title
        }
        
    except RuntimeError as e:
        # Check if this is a "no text versions available" error or 404 error
        error_str = str(e)
        if "No text versions available" in error_str or "404 Not Found" in error_str:
            logger.error(f"No text available for bill {bill_type} {bill_number}")
            raise HTTPException(status_code=404, detail="No bill text available yet. This bill may not have been published or may still be in draft form.")
        else:
            logger.error(f"Error fetching bill text: {e}")
            raise HTTPException(status_code=500, detail="Error fetching bill text from Congress API")
    except Exception as e:
        logger.error(f"Error extracting recommended bill text: {e}")
        raise HTTPException(status_code=500, detail="Error extracting bill text")

# No response cleaning needed for standard models

# Bill Search Models
class BillSearchRequest(BaseModel):
    query: str
    limit: int = 20

class BillSuggestionsRequest(BaseModel):
    query: str
    limit: int = 5

@app.post("/search-bills")
async def search_bills(request: BillSearchRequest):
    """Search for bills using the Congress.gov API"""
    try:
        if not bill_searcher:
            raise HTTPException(status_code=500, detail="Bill search service not available")
        
        logger.info(f"Searching bills with query: '{request.query}' (limit: {request.limit})")
        
        # Use the bill searcher to find matching bills
        results = await bill_searcher.search_bills(request.query, request.limit)
        
        logger.info(f"Found {len(results)} bills matching query: '{request.query}'")
        
        return {"bills": results}
        
    except Exception as e:
        logger.error(f"Error in /search-bills endpoint: {e}")
        raise HTTPException(status_code=500, detail="Error searching bills")

@app.post("/search-suggestions")
async def search_suggestions(request: BillSuggestionsRequest):
    """Get search suggestions for bill queries"""
    try:
        if not bill_searcher:
            raise HTTPException(status_code=500, detail="Bill search service not available")
        
        logger.info(f"Getting suggestions for query: '{request.query}'")
        
        # Use the bill searcher to get suggestions
        suggestions = await bill_searcher.get_suggestions(request.query, request.limit)
        
        logger.info(f"Generated {len(suggestions)} suggestions for query: '{request.query}'")
        
        return {"suggestions": suggestions}
        
    except Exception as e:
        logger.error(f"Error in /search-suggestions endpoint: {e}")
        raise HTTPException(status_code=500, detail="Error getting search suggestions")

# Bill link extraction models
class BillFromUrlRequest(BaseModel):
    congress: int
    type: str
    number: str
    url: str

class StateBillFromUrlRequest(BaseModel):
    state: str
    bill_number: str
    year: Optional[str] = None
    url: str

@app.post("/extract-bill-from-url")
async def extract_bill_from_url(request: BillFromUrlRequest):
    """Extract bill information from Congress.gov URL"""
    try:
        if not CONGRESS_API_KEY:
            raise HTTPException(status_code=500, detail="Congress API key not available")
        
        logger.info(f"Extracting bill info from URL: {request.type} {request.number} from {request.congress}th Congress")
        logger.debug(f"Request data: congress={request.congress}, type={request.type}, number={request.number}")
        
        # Fetch bill information from Congress.gov API
        url = f"https://api.congress.gov/v3/bill/{request.congress}/{request.type.lower()}/{request.number}"
        logger.debug(f"Congress API URL: {url}")
        
        params = {
            "api_key": CONGRESS_API_KEY,
            "format": "json"
        }
        
        async with session.get(url, params=params) as response:
            logger.debug(f"Congress API response status: {response.status}")
            
            if response.status == 404:
                logger.error(f"Bill not found: {request.type} {request.number} from {request.congress}th Congress")
                raise HTTPException(status_code=404, detail="Bill not found in Congress.gov")
            elif response.status != 200:
                response_text = await response.text()
                logger.error(f"Congress API error fetching bill info: {response.status}, response: {response_text}")
                raise HTTPException(status_code=500, detail="Error fetching bill information from Congress API")
            
            data = await response.json()
            logger.debug(f"Congress API response data keys: {data.keys() if data else 'None'}")
            
            bill_data = data.get("bill", {})
            
            if not bill_data:
                logger.error(f"No bill data in response: {data}")
                raise HTTPException(status_code=404, detail="Bill not found")
            
            # Extract bill information
            title = bill_data.get("title", f"{request.type.upper()} {request.number}")
            
            # Get sponsor information
            sponsors = bill_data.get("sponsors", [])
            sponsor_name = "Unknown Sponsor"
            if sponsors:
                sponsor = sponsors[0]
                first_name = sponsor.get("firstName", "")
                last_name = sponsor.get("lastName", "")
                party = sponsor.get("party", "")
                state = sponsor.get("state", "")
                if last_name:
                    title_prefix = "Rep." if sponsor.get("bioguideId", "").startswith("H") else "Sen."
                    sponsor_name = f"{title_prefix} {first_name} {last_name}"
                    if party and state:
                        sponsor_name += f" ({party}-{state})"
            
            # Create description from title or summary
            description = title
            summaries = bill_data.get("summaries", [])
            if summaries and isinstance(summaries, list) and len(summaries) > 0:
                latest_summary = summaries[0]
                if isinstance(latest_summary, dict):
                    summary_text = latest_summary.get("text", "")
                    if summary_text and len(summary_text) > len(title):
                        description = summary_text[:500] + ("..." if len(summary_text) > 500 else "")
            else:
                logger.debug(f"Summaries data type: {type(summaries)}, content: {summaries}")
            
            return {
                "title": title,
                "description": description,
                "sponsor": sponsor_name,
                "congress": request.congress,
                "type": request.type.upper(),
                "number": request.number
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error extracting bill from URL: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error extracting bill information: {str(e)}")

@app.post("/extract-state-bill-from-url")
async def extract_state_bill_from_url(request: StateBillFromUrlRequest):
    """Extract state bill information from LegiScan URL"""
    try:
        if not legiscan_service:
            raise HTTPException(status_code=503, detail="LegiScan service not available. API key may be missing.")

        year_info = f" ({request.year})" if request.year else ""
        logger.info(f"Extracting state bill info from URL: {request.state} {request.bill_number}{year_info}")

        # Search for the bill by bill number in the state
        # LegiScan API doesn't support direct bill lookup by number, so we search
        bills = await legiscan_service.search_bills(request.state, request.bill_number, limit=50)

        # Find exact match for bill number
        matching_bill = None
        for bill in bills:
            if bill.get("number", "").upper() == request.bill_number.upper():
                matching_bill = bill
                break

        if not matching_bill:
            # If no exact match in search, try getting from current session
            logger.info(f"No match in search results, trying master list for current session")
            all_bills = await legiscan_service.get_master_list(request.state, None)
            for bill in all_bills:
                if bill.get("number", "").upper() == request.bill_number.upper():
                    matching_bill = bill
                    break

        # If still not found and we have a year, try to find the session for that year
        if not matching_bill and request.year:
            logger.info(f"Trying to find session for year {request.year}")
            sessions = await legiscan_service.get_session_list(request.state)
            for session in sessions:
                year_start = session.get("year_start")
                year_end = session.get("year_end")
                if year_start and year_end:
                    if int(request.year) >= year_start and int(request.year) <= year_end:
                        logger.info(f"Found session {session.get('session_id')} for year {request.year}")
                        session_bills = await legiscan_service.get_master_list(request.state, session.get("session_id"))
                        for bill in session_bills:
                            if bill.get("number", "").upper() == request.bill_number.upper():
                                matching_bill = bill
                                break
                        if matching_bill:
                            break

        if not matching_bill:
            logger.error(f"Bill not found: {request.state} {request.bill_number}{year_info}")

            # Provide more helpful error message
            error_detail = f"Bill {request.bill_number} not found in {request.state}."

            if request.year and int(request.year) >= 2025:
                error_detail += f" Note: {request.year} legislative sessions may not have started yet or may not be fully tracked in LegiScan. Try checking if the session is active on your state legislature's website."
            else:
                error_detail += " The bill may not be available in the LegiScan database, it may be from an archived session, or the session may not be currently tracked."

            raise HTTPException(status_code=404, detail=error_detail)

        # Get full bill details if we have a bill_id
        bill_id = matching_bill.get("id")
        if bill_id:
            full_bill = await legiscan_service.get_bill(bill_id)
            if full_bill:
                matching_bill = full_bill

        return {
            "title": matching_bill.get("title", f"{request.state} {request.bill_number}"),
            "number": matching_bill.get("number", request.bill_number),
            "description": matching_bill.get("description", matching_bill.get("title", "")),
            "sponsor": matching_bill.get("sponsor", "Unknown Sponsor"),
            "status": matching_bill.get("status", ""),
            "lastAction": matching_bill.get("lastAction", ""),
            "lastActionDate": matching_bill.get("lastActionDate", ""),
            "url": matching_bill.get("url", request.url),
            "stateLink": matching_bill.get("stateLink", ""),
            "id": bill_id,
            "state": request.state
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error extracting state bill from URL: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error extracting state bill information: {str(e)}")

# ============================================================================
# LEGISCAN STATE BILLS ENDPOINTS
# ============================================================================

@app.get("/states")
async def get_states():
    """Get list of all US states for state bill search"""
    try:
        states = LegiScanService.get_state_list()
        return {"states": states}
    except Exception as e:
        logger.error(f"Error getting state list: {e}")
        raise HTTPException(status_code=500, detail="Error getting state list")

@app.get("/state-sessions/{state}")
async def get_state_sessions(state: str):
    """Get legislative sessions for a state"""
    try:
        if not legiscan_service:
            raise HTTPException(status_code=503, detail="LegiScan service not available. API key may be missing.")

        sessions = await legiscan_service.get_session_list(state.upper())
        return {"sessions": sessions}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting sessions for {state}: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting sessions for {state}")

@app.get("/state-bills/{state}")
async def get_state_bills(state: str, session_id: Optional[int] = None):
    """Get bills for a state session"""
    try:
        if not legiscan_service:
            raise HTTPException(status_code=503, detail="LegiScan service not available. API key may be missing.")

        bills = await legiscan_service.get_master_list(state.upper(), session_id)
        return {"bills": bills[:20]}  # Return 20 most recent bills
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting bills for {state}: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting bills for {state}")

class StateBillSearchRequest(BaseModel):
    state: str
    query: str
    limit: int = 20

@app.post("/search-state-bills")
async def search_state_bills(request: StateBillSearchRequest):
    """Search for state bills"""
    try:
        if not legiscan_service:
            raise HTTPException(status_code=503, detail="LegiScan service not available. API key may be missing.")

        logger.info(f"Searching state bills in {request.state} with query: '{request.query}'")

        bills = await legiscan_service.search_bills(request.state.upper(), request.query, request.limit)

        logger.info(f"Found {len(bills)} bills in {request.state} matching query: '{request.query}'")

        return {"bills": bills}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error searching state bills: {e}")
        raise HTTPException(status_code=500, detail="Error searching state bills")

class StateBillRequest(BaseModel):
    bill_id: int

@app.post("/get-state-bill")
async def get_state_bill_details(request: StateBillRequest):
    """Get detailed information about a specific state bill"""
    try:
        if not legiscan_service:
            raise HTTPException(status_code=503, detail="LegiScan service not available. API key may be missing.")

        logger.info(f"Fetching state bill details for ID: {request.bill_id}")

        bill = await legiscan_service.get_bill(request.bill_id)

        if not bill:
            raise HTTPException(status_code=404, detail="Bill not found")

        return {"bill": bill}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting state bill details: {e}")
        raise HTTPException(status_code=500, detail="Error getting state bill details")

class StateBillTextRequest(BaseModel):
    bill_id: int

@app.post("/extract-state-bill-text")
async def extract_state_bill_text(request: StateBillTextRequest):
    """Extract text from a state bill"""
    try:
        if not legiscan_service:
            raise HTTPException(status_code=503, detail="LegiScan service not available. API key may be missing.")

        logger.info(f"Extracting text for state bill ID: {request.bill_id}")

        # Get bill details first
        bill = await legiscan_service.get_bill(request.bill_id)

        if not bill:
            raise HTTPException(status_code=404, detail="Bill not found")

        # Get the most recent text version
        texts = bill.get("texts", [])
        if not texts:
            raise HTTPException(status_code=404, detail="No text available for this bill")

        # Get the first (most recent) text document
        text_doc = texts[0]
        doc_id = text_doc.get("doc_id")

        if not doc_id:
            raise HTTPException(status_code=404, detail="No document ID available")

        # Fetch the bill text
        bill_text = await legiscan_service.get_bill_text(doc_id)

        if not bill_text:
            raise HTTPException(status_code=404, detail="Could not retrieve bill text")

        return {
            "text": f"{bill.get('number', '')} - {bill.get('title', '')}\n\n{bill_text}",
            "title": bill.get("title", ""),
            "number": bill.get("number", "")
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error extracting state bill text: {e}")
        raise HTTPException(status_code=500, detail="Error extracting state bill text")

class AnalyzeStateBillRequest(BaseModel):
    bill_id: int
    model: str = DEFAULT_MODEL
    userProfile: dict = None

@app.post("/analyze-state-bill")
async def analyze_state_bill(request: AnalyzeStateBillRequest):
    """Analyze a state bill"""
    try:
        if not legiscan_service:
            raise HTTPException(status_code=503, detail="LegiScan service not available. API key may be missing.")

        logger.info(f"Analyzing state bill ID: {request.bill_id} with model: {request.model}")

        # Get bill details
        bill = await legiscan_service.get_bill(request.bill_id)

        if not bill:
            raise HTTPException(status_code=404, detail="Bill not found")

        # Get the most recent text version
        texts = bill.get("texts", [])
        if not texts:
            raise HTTPException(status_code=404, detail="No text available for this bill")

        # Get the first (most recent) text document
        text_doc = texts[0]
        doc_id = text_doc.get("doc_id")

        if not doc_id:
            raise HTTPException(status_code=404, detail="No document ID available")

        # Fetch the bill text
        bill_text = await legiscan_service.get_bill_text(doc_id)

        if not bill_text:
            raise HTTPException(status_code=404, detail="Could not retrieve bill text")

        # Format full text with title
        full_text = f"{bill.get('number', '')} - {bill.get('title', '')}\n\n{bill_text}"

        # Log consolidated processing info
        logger.info(f"Processing state bill {bill.get('number', '')} with model {request.model}")

        # Check if we need to process large bill text
        if len(full_text) > 40000:
            logger.info(f"Large bill detected ({len(full_text)} chars), extracting key sections for analysis")
            processed_text = extract_key_bill_sections(full_text, 40000)
            logger.info(f"Key sections extracted: {len(processed_text)} chars")

            # Generate both analysis and grades using processed text
            analysis = await analyze_legislation_text(processed_text, request.model, skip_extraction=True, user_profile=request.userProfile)
            grades = await grade_legislation_text(processed_text, request.model, skip_extraction=True)
        else:
            # Generate both analysis and grades using full text
            analysis = await analyze_legislation_text(full_text, request.model, skip_extraction=True, user_profile=request.userProfile)
            grades = await grade_legislation_text(full_text, request.model, skip_extraction=True)

        return {"analysis": analysis, "grades": grades}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error analyzing state bill: {e}")
        raise HTTPException(status_code=500, detail="Error analyzing state bill")

# ============================================================================
# CALIFORNIA PROPOSITIONS ENDPOINTS
# ============================================================================

@app.get("/ca-propositions")
async def get_ca_propositions(election_cycle: Optional[str] = None):
    """Get list of California ballot propositions"""
    try:
        if not ca_props_service:
            raise HTTPException(status_code=503, detail="CA Propositions service not available")

        propositions = await ca_props_service.get_propositions_list(election_cycle)
        return {"propositions": propositions}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting CA propositions: {e}")
        raise HTTPException(status_code=500, detail="Error getting CA propositions")

class CAPropositionTextRequest(BaseModel):
    prop_id: str

@app.post("/extract-ca-proposition-text")
async def extract_ca_proposition_text(request: CAPropositionTextRequest):
    """Extract text from a California proposition"""
    try:
        if not ca_props_service:
            raise HTTPException(status_code=503, detail="CA Propositions service not available")

        logger.info(f"Extracting text for CA proposition: {request.prop_id}")

        prop_data = await ca_props_service.get_proposition_text(request.prop_id)

        if not prop_data:
            raise HTTPException(status_code=404, detail="Proposition text not found")

        return {
            "text": f"PROPOSITION {prop_data['number']}\n\n{prop_data['text']}",
            "title": f"Proposition {prop_data['number']}",
            "number": prop_data['number']
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error extracting CA proposition text: {e}")
        raise HTTPException(status_code=500, detail="Error extracting CA proposition text")

class AnalyzeCAPropositionRequest(BaseModel):
    prop_id: str
    model: str = DEFAULT_MODEL
    userProfile: dict = None

@app.post("/analyze-ca-proposition")
async def analyze_ca_proposition(request: AnalyzeCAPropositionRequest):
    """Analyze a California proposition"""
    try:
        if not ca_props_service:
            raise HTTPException(status_code=503, detail="CA Propositions service not available")

        logger.info(f"Analyzing CA proposition: {request.prop_id} with model: {request.model}")

        # Get proposition text
        prop_data = await ca_props_service.get_proposition_text(request.prop_id)

        if not prop_data:
            raise HTTPException(status_code=404, detail="Proposition text not found")

        # Format full text with title
        full_text = f"PROPOSITION {prop_data['number']}\n\n{prop_data['text']}"

        # Log processing info
        logger.info(f"Processing CA Prop {prop_data['number']} with model {request.model}")

        # Check if we need to process large text
        if len(full_text) > 40000:
            logger.info(f"Large proposition detected ({len(full_text)} chars), extracting key sections")
            processed_text = extract_key_bill_sections(full_text, 40000)
            logger.info(f"Key sections extracted: {len(processed_text)} chars")

            # Generate analysis and grades
            analysis = await analyze_legislation_text(processed_text, request.model, skip_extraction=True, user_profile=request.userProfile)
            grades = await grade_legislation_text(processed_text, request.model, skip_extraction=True)
        else:
            # Generate analysis and grades using full text
            analysis = await analyze_legislation_text(full_text, request.model, skip_extraction=True, user_profile=request.userProfile)
            grades = await grade_legislation_text(full_text, request.model, skip_extraction=True)

        return {"analysis": analysis, "grades": grades}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error analyzing CA proposition: {e}")
        raise HTTPException(status_code=500, detail="Error analyzing CA proposition")

# ============================================================================
# TEXT-TO-SPEECH ENDPOINTS
# ============================================================================

# Import TTS service
import sys
sys.path.append('speech_utils')
from speech_utils.tts_service import GoogleTTSService

# Initialize TTS service
tts_service = GoogleTTSService()

@app.get("/tts/health")
async def tts_health():
    """Check TTS service health"""
    try:
        if tts_service.client:
            return {
                "status": "healthy",
                "service": "google-tts",
                "credentials_loaded": True,
                "message": "TTS service is running and ready"
            }
        else:
            return {
                "status": "unhealthy",
                "service": "google-tts",
                "credentials_loaded": False,
                "message": "TTS service not initialized"
            }
    except Exception as e:
        logger.error(f"TTS health check error: {e}")
        return {
            "status": "error",
            "service": "google-tts",
            "error": str(e)
        }

@app.get("/tts/voices")
async def get_tts_voices():
    """Get available TTS voices"""
    try:
        voices = tts_service.get_available_voices()
        default_voice = tts_service.get_default_voice()
        
        return {
            "success": True,
            "voices": voices,
            "default_voice": default_voice,
            "total_voices": len(voices)
        }
    except Exception as e:
        logger.error(f"Error getting TTS voices: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting TTS voices: {str(e)}")

class TTSRequest(BaseModel):
    text: str
    voice_name: str = None
    rate: float = 1.0
    pitch: float = 0.0
    volume: float = 1.0

@app.post("/tts/synthesize")
async def synthesize_speech(request: TTSRequest):
    """Synthesize speech from text"""
    try:
        if not request.text or request.text.strip() == "":
            raise HTTPException(status_code=400, detail="Text is required")
        
        # Use default voice if none specified
        voice_name = request.voice_name or tts_service.get_default_voice()
        
        # Synthesize speech
        audio_content = tts_service.synthesize_speech(
            text=request.text,
            voice_name=voice_name,
            rate=request.rate,
            pitch=request.pitch,
            volume=request.volume
        )
        
        if audio_content:
            return {
                "success": True,
                "audio_content": audio_content,
                "voice_used": voice_name,
                "text_length": len(request.text),
                "message": "Speech synthesized successfully"
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to synthesize speech")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"TTS synthesis error: {e}")
        raise HTTPException(status_code=500, detail=f"TTS synthesis error: {str(e)}")

@app.get("/tts/test")
async def test_tts():
    """Test TTS with sample text"""
    try:
        test_text = "Hello! This is a test of the DebateSim text-to-speech system. The voice should sound natural and clear."
        
        audio_content = tts_service.synthesize_speech(
            text=test_text,
            voice_name=tts_service.get_default_voice()
        )
        
        if audio_content:
            return {
                "success": True,
                "audio_content": audio_content,
                "test_text": test_text,
                "voice_used": tts_service.get_default_voice(),
                "message": "TTS test successful"
            }
        else:
            raise HTTPException(status_code=500, detail="TTS test failed")
            
    except Exception as e:
        logger.error(f"TTS test error: {e}")
        raise HTTPException(status_code=500, detail=f"TTS test error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)