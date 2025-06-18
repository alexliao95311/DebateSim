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

from chains.debater_chain import get_debater_chain
from chains.judge_chain import judge_chain, get_judge_chain

# Load environment variables
load_dotenv()
API_KEY = os.getenv("OPENROUTER_API_KEY")
if not API_KEY:
    raise ValueError("Please set the OPENROUTER_API_KEY environment variable.")

# Initialize logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global model configuration
DEFAULT_MODEL = "deepseek/deepseek-r1-0528:free"
FALLBACK_MODEL = "meta-llama/llama-3-8b-instruct:free"

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
backend_origins = os.getenv("BACKEND_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000,http://20.3.246.40:3000").split(",")
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

# Connection pooling
connector = aiohttp.TCPConnector(limit=20)

# Cache for AI responses (key now includes model_override and skip_formatting)
cache = TTLCache(maxsize=100, ttl=300)  # Cache up to 100 items for 5 minutes

# Global session variable
session = None

@app.on_event("startup")
async def startup_event():
    global session
    session = aiohttp.ClientSession(connector=connector)

@app.on_event("shutdown")
async def shutdown_event():
    await session.close()


# API Endpoints

@app.post("/generate-response")
async def generate_response(request: GenerateResponseRequest):
    logger.info(f"📩 /generate-response called with debater={request.debater!r}, prompt={request.prompt!r}")
    # Determine role: "Pro" or "Con"
    debater_role = request.debater.strip().title()
    
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
        
    logger.info(f"✅ [LangChain] Debater response: {ai_output[:200]}...")
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

@app.post("/analyze-legislation")
async def analyze_legislation(file: UploadFile = File(...)):
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
        # Get a debater chain with the default model for legislation analysis
        analysis_chain = get_debater_chain(DEFAULT_MODEL)
        
        analysis = analysis_chain.run(
            debater_role="Analyst",
            topic="Legislation Analysis",
            bill_description=text,
            history=""
        )
    except Exception as e:
        logger.error(f"Error in debater_chain for legislation: {e}", exc_info=True)
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
    logger.info(f"📩 /judge-feedback called with model={request.model!r}")
    try:
        # Get the appropriate judge chain with the requested model
        model_specific_judge_chain = get_judge_chain(request.model)
        
        # Run the chain with the transcript
        feedback = model_specific_judge_chain.run(
            transcript=request.transcript
        )
        
        return {"response": feedback}
    except Exception as e:
        logger.error(f"Error in judge_chain: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error generating judge feedback")
    
@app.options("/test-cors")
async def test_cors():
    return {"message": "CORS preflight OK"}