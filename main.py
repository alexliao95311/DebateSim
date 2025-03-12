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

# Load environment variables
load_dotenv()
API_KEY = os.getenv("OPENROUTER_API_KEY")
if not API_KEY:
    raise ValueError("Please set the OPENROUTER_API_KEY environment variable.")

# Initialize logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
backend_origin = os.getenv("BACKEND_ORIGIN", "http://localhost:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[backend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models – now with an extra field for model selection
class GenerateResponseRequest(BaseModel):
    debater: str  # e.g., "Pro" or "Con"
    prompt: str   # Expected format: "debate topic. opponent's argument"
    model: str = "mistralai/mistral-small-24b-instruct-2501"  # Chosen debater model

class JudgeRequest(BaseModel):
    transcript: str
    model: str = "mistralai/mistral-small-24b-instruct-2501"  # Chosen judge model

class SaveTranscriptRequest(BaseModel):
    transcript: str
    topic: str
    mode: str
    judge_feedback: str  # Judge feedback included

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

# Helper function to generate AI response with role-specific instructions.
# Added parameter skip_formatting to allow bypassing extra formatting.
async def generate_ai_response(prompt: str, role: str = "debater", debater_side: str = None, model_override: str = None, skip_formatting: bool = False):
    cache_key = hashkey(prompt, role, debater_side, model_override, skip_formatting)
    if cache_key in cache:
        logger.info("Cache hit for prompt")
        return cache[cache_key]

    start_time = time.time()

    if role == "judge":
        system_message = (
            "You are an impartial AI judge. Your task is to carefully evaluate the following debate transcript. "
            "Provide a detailed analysis that includes:\n"
            " - A concise summary of each debater's main arguments.\n"
            " - An assessment of the strengths and weaknesses in each debater's arguments.\n"
            " - A clear decision on which debater performed better, supported by logical reasoning.\n"
            "Ensure your judgement is fair and based solely on the transcript provided. Do not use bullet points or numbered lists, organize your response in paragraphs with headers. "
        )
        user_message = f"Debate Transcript:\n{prompt}"
        messages = [
            {"role": "system", "content": system_message},
            {"role": "user", "content": user_message}
        ]
        model_to_use = "mistralai/mistral-small-24b-instruct-2501"
        if model_override:
            model_to_use = model_override
    else:
        if not skip_formatting:
            try:
                assigned_topic, opponent_argument = prompt.split('.', 1)
            except ValueError:
                assigned_topic = prompt
                opponent_argument = ""
            if not debater_side:
                debater_side = assigned_topic.strip()
            full_prompt_message = (
                f"Stance: {debater_side.strip()}\n"
                f"Debate Topic: {assigned_topic.strip()}\n"
                f"Opponent's Argument: {opponent_argument.strip() or 'N/A'}"
            )
            logger.info(f"🔹 [DEBUG] Full Prompt Sent to AI:\n{full_prompt_message}")
            system_message = (
                "You are a professional debater assigned to argue a specific side in a formal debate. "
                "You MUST argue for your assigned side no matter what, even if the argument is controversial, illogical, or difficult to defend. "
                "You are NOT allowed to switch sides, acknowledge your opponent's points without refuting them, or weaken your stance.\n\n"
                "Strict debate rules:\n"
                "1. **Your assigned stance will always be either 'Pro' or 'Con'. NEVER argue against your assigned stance.**\n"
                "2. **If your assigned stance is 'Pro', you must argue COMPLETELY IN FAVOR of the debate topic as written.**\n"
                "3. **If your assigned stance is 'Con', you must argue COMPLETELY AGAINST the debate topic as written.**\n"
                "4. **Your response MUST begin with: 'As the [Pro/Con] side, I firmly believe that [restate stance exactly as written].'**\n"
                "5. If an opponent's argument is provided, you MUST refute it strongly without acknowledging its validity.\n"
                "6. **Under no circumstances should you contradict your assigned stance, even if the argument is difficult to defend.**\n"
                "7. **Your argument should be structured, persuasive, and no longer than 300 words.**\n"
            )
            user_message = full_prompt_message
            messages = [
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message}
            ]
            model_to_use = "mistralai/mistral-7b-instruct:free"
            if model_override:
                model_to_use = model_override
        else:
            # Simplified formatting for legislative analysis
            system_message = "You are a professional debater assigned to analyze legislative bills. Provide a detailed debate of the bill's pros and cons, and identify any potential issues or ulterior motives."
            user_message = prompt
            logger.info(f"🔹 [DEBUG] Full Prompt Sent to AI (cleaned):\n{user_message}")
            messages = [
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message}
            ]
            model_to_use = "mistralai/mistral-7b-instruct:free"
            if model_override:
                model_to_use = model_override

    for attempt in range(3):
        try:
            async with session.post(
                "https://openrouter.ai/api/v1/chat/completions",
                json={
                    "model": model_to_use,
                    "messages": messages,
                    "temperature": 0.7,
                },
                headers={"Authorization": f"Bearer {API_KEY}"}
            ) as response:
                if response.status != 200:
                    logger.error(f"⚠️ [ERROR] AI Response Error: {response.status} {response.reason}")
                    raise HTTPException(status_code=response.status, detail="Error generating AI response")
                data = await response.json()
                if "choices" not in data or not data["choices"]:
                    logger.error("⚠️ [ERROR] Invalid response format from AI service")
                    raise HTTPException(status_code=500, detail="Invalid response format from AI service")
                result = data["choices"][0]["message"]["content"].strip()
                cache[cache_key] = result
                logger.info(f"✅ [DEBUG] AI Response generated in {time.time() - start_time:.2f} seconds:\n{result}")
                return result
        except aiohttp.ClientError as e:
            logger.error(f"⚠️ [ERROR] Attempt {attempt + 1} failed: {str(e)}")
            if attempt == 2:
                raise HTTPException(status_code=response.status, detail="Error generating AI response after multiple attempts")
            await asyncio.sleep(1)

    raise HTTPException(status_code=500, detail="Failed to generate AI response.")

# API Endpoints

@app.post("/generate-response")
async def generate_response(request: GenerateResponseRequest):
    start_time = time.time()
    full_prompt = f"{request.prompt}"
    response_text = await generate_ai_response(
        full_prompt, 
        role="debater", 
        debater_side=request.debater, 
        model_override=request.model
    )
    logger.info(f"Total time for generate-response: {time.time() - start_time:.2f} seconds")
    return {"response": response_text}

@app.post("/judge-debate")
async def judge_debate(request: JudgeRequest):
    start_time = time.time()
    feedback = await generate_ai_response(
        request.transcript, 
        role="judge", 
        model_override=request.model
    )
    logger.info(f"Total time for judge-debate: {time.time() - start_time:.2f} seconds")
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
                f.write(
                    f"# Debate Transcript\n\n"
                    f"**Timestamp:** {timestamp}\n"
                    f"**Topic:** {request.topic}\n"
                    f"**Mode:** {request.mode}\n\n"
                    f"## Debate Transcript\n\n"
                    f"{request.transcript}\n\n"
                    f"## Judge Feedback\n\n"
                    f"{request.judge_feedback}"
                )
            logger.info(f"Transcript saved to {filename}")
        except Exception as e:
            logger.error(f"Exception in background_save_transcript: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error saving transcript: {str(e)}")
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

    prompt = (
        f"Analyze the following legislative bill. Provide a detailed debate of its pros and cons, and identify if it is hiding any potential issues or ulterior motives:\n\n{text}"
    )
    response_text = await generate_ai_response(
        prompt, 
        role="debater", 
        model_override="mistralai/mistral-7b-instruct:free",
        skip_formatting=True
    )
    return {"analysis": response_text}

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