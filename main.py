import os
from openai import OpenAI
from dotenv import load_dotenv

###############################################################################
# 1) Setup OpenRouter Client
###############################################################################
# Read your OpenRouter key from the environment
load_dotenv()
API_KEY = os.getenv("OPENROUTER_API_KEY")
if not API_KEY:
    raise ValueError("Please set the OPENROUTER_API_KEY environment variable.")

# Instantiate the OpenAI client for OpenRouter
client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=API_KEY
)

# Choose a model you have access to via OpenRouter
# E.g., "openai/gpt-3.5-turbo", "anthropic/claude-instant:free",
#       or "google/gemini-2.0-flash-thinking-exp:free" (if you have access).
MODEL_NAME = "openai/gpt-3.5-turbo"

###############################################################################
# 2) Helper Functions
###############################################################################

def generate_ai_response(prompt):
    """
    Calls OpenRouter's `OpenAI` client to get a chat completion.
    """
    try:
        completion = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": "You are a helpful debate AI."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7
        )
        # Extract the response text
        if completion.choices and len(completion.choices) > 0:
            return completion.choices[0].message.content
        else:
            return "No content returned by the AI."
    except Exception as e:
        print("Error calling OpenRouter API:", e)
        return "An error occurred while communicating with the AI."

def ai_debater(debater_name, topic, viewpoint="Pro"):
    """
    Simulates an AI debater generating arguments either 'Pro' or 'Con'.
    """
    prompt = (
        f"You are {debater_name}, an AI debater. "
        f"Present an opening statement from the {viewpoint} perspective on the topic: '{topic}'. "
        "Be clear, concise, and persuasive."
    )
    return generate_ai_response(prompt)

def ai_judge(debate_transcript):
    """
    Simulates an AI judge who evaluates the debate based on the transcript.
    """
    prompt = (
        "You are an AI judge. Read the following debate transcript and provide:\n"
        "- A brief summary of each debater's main points.\n"
        "- Feedback on strengths and weaknesses.\n"
        "- A decision on who won the debate, with reasoning.\n\n"
        f"Debate Transcript:\n{debate_transcript}"
    )
    return generate_ai_response(prompt)

def user_input_debate(debater_name, topic):
    """
    Allows the user to write an argument or statement in the debate.
    """
    print(f"\n{debater_name}, it's your turn to speak.")
    user_statement = input("Enter your argument or statement: ")
    return f"{debater_name} (User): {user_statement}"

###############################################################################
# 3) Main DebateSim Flow
###############################################################################

def main():
    print("=== Welcome to DebateSim (Text-Based, via OpenRouter) ===")
    print("Please select a debate mode:\n")
    print("1) AI as both debaters and judge (full simulation)")
    print("2) AI as debaters, user as judge")
    print("3) AI as judge, users as debaters")
    print("4) AI as judge and debater, user as the other debater\n")

    mode = input("Enter the number corresponding to the mode you want to use: ").strip()
    topic = input("\nEnter the debate topic or resolution: ").strip()

    # Initialize a log or transcript of the debate
    debate_transcript = ""

    if mode == "1":
        print("\nMode 1: AI as both debaters and judge")
        # AI Debater 1 (Pro)
        pro_statement = ai_debater("AI Debater 1", topic, "Pro")
        debate_transcript += "\n[AI Debater 1 - Pro]: " + pro_statement

        # AI Debater 2 (Con)
        con_statement = ai_debater("AI Debater 2", topic, "Con")
        debate_transcript += "\n[AI Debater 2 - Con]: " + con_statement

        # AI Judge
        judge_feedback = ai_judge(debate_transcript)
        debate_transcript += "\n\n[AI Judge]: " + judge_feedback

        print("\n--- Debate Transcript ---")
        print(debate_transcript)

    elif mode == "2":
        print("\nMode 2: AI as debaters, user as judge")
        # AI Debater 1 (Pro)
        pro_statement = ai_debater("AI Debater 1", topic, "Pro")
        debate_transcript += "\n[AI Debater 1 - Pro]: " + pro_statement

        # AI Debater 2 (Con)
        con_statement = ai_debater("AI Debater 2", topic, "Con")
        debate_transcript += "\n[AI Debater 2 - Con]: " + con_statement

        print("\n--- Debate Transcript (so far) ---")
        print(debate_transcript)
        print("\nNow you (the user) will act as the judge.\n")

        # User as judge
        user_judge_comment = input("As the judge, please provide your feedback and decision: ")
        debate_transcript += f"\n[User Judge]: {user_judge_comment}"

        print("\n--- Final Debate Transcript ---")
        print(debate_transcript)

    elif mode == "3":
        print("\nMode 3: AI as judge, users as debaters")
        # User 1 Debater
        user1_statement = user_input_debate("User Debater 1 (Pro)", topic)
        debate_transcript += "\n" + user1_statement

        # User 2 Debater
        user2_statement = user_input_debate("User Debater 2 (Con)", topic)
        debate_transcript += "\n" + user2_statement

        # AI Judge
        judge_feedback = ai_judge(debate_transcript)
        debate_transcript += "\n[AI Judge]: " + judge_feedback

        print("\n--- Final Debate Transcript ---")
        print(debate_transcript)

    elif mode == "4":
        print("\nMode 4: AI as judge and debater, user as the other debater")
        # AI Debater (Pro)
        pro_statement = ai_debater("AI Debater (Pro)", topic, "Pro")
        debate_transcript += "\n[AI Debater - Pro]: " + pro_statement

        # User Debater (Con)
        user_statement = user_input_debate("User Debater (Con)", topic)
        debate_transcript += "\n" + user_statement

        # AI Judge
        judge_feedback = ai_judge(debate_transcript)
        debate_transcript += "\n[AI Judge]: " + judge_feedback

        print("\n--- Final Debate Transcript ---")
        print(debate_transcript)

    else:
        print("Invalid mode selected. Please run the program again and choose a valid option.")

if __name__ == "__main__":
    main()