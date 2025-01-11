import os
import time
from datetime import datetime
from fastapi import FastAPI, HTTPException, Request, BackgroundTasks
from pydantic import BaseModel
from openai import OpenAI
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
import aiohttp
import logging
from cachetools import TTLCache
from cachetools.keys import hashkey
import asyncio

# Load environment variables
load_dotenv()
API_KEY = os.getenv("OPENROUTER_API_KEY")
if not API_KEY:
    raise ValueError("Please set the OPENROUTER_API_KEY environment variable.")

# Initialize logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize OpenAI client
client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=API_KEY
)

# FastAPI application
app = FastAPI()

# Enable CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Adjust if running frontend elsewhere
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class GenerateResponseRequest(BaseModel):
    debater: str
    prompt: str

class JudgeRequest(BaseModel):
    transcript: str

class SaveTranscriptRequest(BaseModel):
    transcript: str
    topic: str
    mode: str
    judge_feedback: str  # Add feedback as part of the request model

# Connection pooling
connector = aiohttp.TCPConnector(limit=20)  # Increase the limit based on your needs

# Cache for AI responses
cache = TTLCache(maxsize=100, ttl=300)  # Cache up to 100 items for 5 minutes

# Global session
session = None

@app.on_event("startup")
async def startup_event():
    global session
    session = aiohttp.ClientSession()

@app.on_event("shutdown")
async def shutdown_event():
    await session.close()

# Helper function to generate AI response
async def generate_ai_response(prompt: str):
    cache_key = hashkey(prompt)
    if cache_key in cache:
        logger.info("Cache hit for prompt")
        return cache[cache_key]

    start_time = time.time()
    try:
        for attempt in range(3):  # Retry mechanism
            try:
                async with session.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    json={
                        "model": "deepseek/deepseek-chat",
                        "messages": [
                            {"role": "system", "content": "You are a skilled debater."},
                            {"role": "user", "content": prompt},
                        ],
                        "temperature": 0.7,
                    },
                    headers={"Authorization": f"Bearer {API_KEY}"}
                ) as response:
                    if response.status != 200:
                        logger.error(f"Error generating AI response: {response.status} {response.reason}")
                        raise HTTPException(status_code=response.status, detail="Error generating AI response")
                    data = await response.json()
                    if "choices" not in data or not data["choices"]:
                        logger.error("Invalid response format from AI service")
                        raise HTTPException(status_code=500, detail="Invalid response format from AI service")
                    result = data["choices"][0]["message"]["content"].strip()
                    cache[cache_key] = result
                    logger.info(f"AI response generated in {time.time() - start_time} seconds")
                    return result
            except aiohttp.ClientError as e:
                logger.error(f"Attempt {attempt + 1} failed: {str(e)}")
                if attempt == 2:
                    raise
                await asyncio.sleep(1)  # Wait before retrying
    except Exception as e:
        logger.error(f"Exception in generate_ai_response: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating AI response: {str(e)}")

# API endpoints
@app.post("/generate-response")
async def generate_response(request: GenerateResponseRequest):
    start_time = time.time()
    response = await generate_ai_response(f"You are {request.debater}. {request.prompt}")
    logger.info(f"Total time for generate-response: {time.time() - start_time} seconds")
    return {"response": response}

@app.post("/judge-debate")
async def judge_debate(request: JudgeRequest):
    start_time = time.time()
    prompt = (
        "You are an AI judge. Read the following debate transcript and provide:\n"
        "- A brief summary of each debater's main points.\n"
        "- Feedback on strengths and weaknesses.\n"
        "- A decision on who won the debate, with reasoning.\n\n"
        f"Debate Transcript:\n{request.transcript}"
    )
    feedback = await generate_ai_response(prompt)
    logger.info(f"Total time for judge-debate: {time.time() - start_time} seconds")
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
                    f"{request.transcript}\n\n"  # Add the full debate transcript
                    f"## Judge Feedback\n\n"
                    f"{request.judge_feedback}"  # Include the judge feedback
                )
            logger.info(f"Transcript saved to {filename}")
        except Exception as e:
            logger.error(f"Exception in background_save_transcript: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error saving transcript: {str(e)}")

    background_tasks.add_task(background_save_transcript)
    return {"message": "Processing request in the background"}