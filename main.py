import os
import time
from datetime import datetime
from fastapi import FastAPI, HTTPException, BackgroundTasks
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
    prompt: str  # For debate mode, expected to be the opponent's argument

class JudgeRequest(BaseModel):
    transcript: str

class SaveTranscriptRequest(BaseModel):
    transcript: str
    topic: str
    mode: str
    judge_feedback: str  # Add feedback as part of the request model

# Connection pooling
connector = aiohttp.TCPConnector(limit=20)  # Increase the limit based on your needs

# Cache for AI responses (includes prompt and role in the key)
cache = TTLCache(maxsize=100, ttl=300)  # Cache up to 100 items for 5 minutes

# Global session
session = None

@app.on_event("startup")
async def startup_event():
    global session
    session = aiohttp.ClientSession(connector=connector)

@app.on_event("shutdown")
async def shutdown_event():
    await session.close()

# Helper function to generate AI response with role-specific instructions
async def generate_ai_response(prompt: str, role: str = "debater"):
    # Use both prompt and role in the cache key
    cache_key = hashkey(prompt, role)
    if cache_key in cache:
        logger.info("Cache hit for prompt")
        return cache[cache_key]

    start_time = time.time()
    # Build the messages based on the role
    if role == "judge":
        # Judge-specific instructions remain unchanged.
        system_message = (
            "You are an impartial AI judge. Your task is to carefully evaluate the following debate transcript. "
            "Provide a detailed analysis that includes:\n"
            " - A concise summary of each debater's main arguments.\n"
            " - An assessment of the strengths and weaknesses in each debater's arguments.\n"
            " - A clear decision on which debater performed better, supported by logical reasoning.\n"
            "Ensure your judgement is fair and based solely on the transcript provided."
        )
        user_message = f"Debate Transcript:\n{prompt}"
        messages = [
            {"role": "system", "content": system_message},
            {"role": "user", "content": user_message}
        ]
    else:
        # Debater mode instructions.
        # Expecting the prompt to contain the debater's side and the opponent's argument separated by a period.
        try:
            debater_side, opponent_argument = prompt.split('.', 1)
            opponent_argument = opponent_argument.strip()
        except ValueError:
            debater_side = prompt
            opponent_argument = ""
        system_message = (
            "You are a debater engaged in a live debate. Your response should adhere to the following guidelines:\n"
            "1. Present your own arguments clearly.\n"
            "2. If there are opposing arguments, refute them directly.\n"
            "3. Address your opponent directly using second person (you).\n"
            "4. Make your response short and well-organized, limiting it to 300 words.\n"
        )
        user_message = (
            f"Debater Side: {debater_side.strip()}\n"
            f"Opponent's Argument: {opponent_argument}\n\n"
            "Using the guidelines provided, produce your debate response."
        )
        messages = [
            {"role": "system", "content": system_message},
            {"role": "user", "content": user_message}
        ]

    # Retry mechanism with a total of 3 attempts
    for attempt in range(3):
        try:
            async with session.post(
                "https://openrouter.ai/api/v1/chat/completions",
                json={
                    "model": "mistralai/mistral-small-24b-instruct-2501",
                    "messages": messages,
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
                logger.info(f"AI response generated in {time.time() - start_time:.2f} seconds")
                return result
        except aiohttp.ClientError as e:
            logger.error(f"Attempt {attempt + 1} failed: {str(e)}")
            if attempt == 2:
                raise HTTPException(status_code=500, detail="Error generating AI response after multiple attempts")
            await asyncio.sleep(1)
    # If we exit the loop without returning a result, raise an error.
    raise HTTPException(status_code=500, detail="Failed to generate AI response.")

# API endpoints
@app.post("/generate-response")
async def generate_response(request: GenerateResponseRequest):
    start_time = time.time()
    # Construct the full prompt for the debater.
    full_prompt = f"{request.debater}. {request.prompt}"
    response_text = await generate_ai_response(full_prompt, role="debater")
    logger.info(f"Total time for generate-response: {time.time() - start_time:.2f} seconds")
    return {"response": response_text}

@app.post("/judge-debate")
async def judge_debate(request: JudgeRequest):
    start_time = time.time()
    # The prompt here is simply the debate transcript.
    feedback = await generate_ai_response(request.transcript, role="judge")
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