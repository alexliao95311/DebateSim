import os
from datetime import datetime
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from openai import OpenAI
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware

# Load environment variables
load_dotenv()
API_KEY = os.getenv("OPENROUTER_API_KEY")
if not API_KEY:
    raise ValueError("Please set the OPENROUTER_API_KEY environment variable.")

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

# Helper function to generate AI response
def generate_ai_response(prompt: str):
    try:
        completion = client.chat.completions.create(
            model="deepseek/deepseek-chat",
            messages=[
                {"role": "system", "content": "You are a skilled debater."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.7,
        )
        return completion.choices[0].message.content.strip() if completion.choices else "No response received."
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating AI response: {str(e)}")

# API endpoints
@app.post("/generate-response")
async def generate_response(request: GenerateResponseRequest):
    response = generate_ai_response(f"You are {request.debater}. {request.prompt}")
    return {"response": response}

@app.post("/judge-debate")
async def judge_debate(request: JudgeRequest):
    prompt = (
        "You are an AI judge. Read the following debate transcript and provide:\n"
        "- A brief summary of each debater's main points.\n"
        "- Feedback on strengths and weaknesses.\n"
        "- A decision on who won the debate, with reasoning.\n\n"
        f"Debate Transcript:\n{request.transcript}"
    )
    feedback = generate_ai_response(prompt)
    return {"feedback": feedback}

@app.post("/save-transcript")
async def save_transcript(request: SaveTranscriptRequest):
    if not os.path.exists("logs"):
        os.makedirs("logs")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"logs/debate_{timestamp}.md"

    try:
        with open(filename, "w") as f:
            f.write(
                f"# Debate Transcript\n\n"
                f"**Timestamp:** {timestamp}\n"
                f"**Topic:** {request.topic}\n"
                f"**Mode:** {request.mode}\n\n"
                f"{request.transcript}\n\n"
                f"# Judge Feedback\n\n"
                f"{request.judge_feedback}"
            )
        return {"message": f"Transcript saved to {filename}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving transcript: {str(e)}")