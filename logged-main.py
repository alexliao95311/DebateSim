import os
from datetime import datetime
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

# Model name that you have access to via OpenRouter
MODEL_NAME = "openai/gpt-4o"

###############################################################################
# 2) Helper Functions
###############################################################################

def generate_ai_response(prompt):
    """
    Calls OpenRouter's `OpenAI` client to get a chat completion.
    """
    # Refined prompt to produce concise, direct responses without introductions or conclusions
    combined_prompt = (
        "You are a skilled debater. Respond directly and concisely to the given prompt without introductions, conclusions, or prefatory remarks.\n\n"
        f"{prompt}"
    )
    
    try:
        print("\nCalling AI for response...")
        completion = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a helpful debate AI. "
                        "You always respond directly to the user's request without introductions or conclusions."
                    )
                },
                {
                    "role": "user",
                    "content": combined_prompt
                }
            ],
            temperature=0.7
        )
        # Extract the response text
        if completion.choices and len(completion.choices) > 0:
            print("AI response received!")
            return completion.choices[0].message.content.strip()
        else:
            print("Warning: No content returned by the AI")
            return "No content returned by the AI."
    except Exception as e:
        print("Error calling OpenRouter API:", e)
        return "An error occurred while communicating with the AI."

def ai_debater(debater_name, statement_request=""):
    """
    AI generates a statement, using 'statement_request' to specify what we want.
    """
    prompt = (
        f"You are {debater_name}, an AI debater. "
        f"Respond directly to the following prompt: {statement_request}"
    )
    return generate_ai_response(prompt)

def ai_judge(debate_transcript):
    """
    AI judge who evaluates the debate transcript.
    """
    prompt = (
        "You are an AI judge. Read the following debate transcript and provide:\n"
        "- A brief summary of each debater's main points.\n"
        "- Feedback on strengths and weaknesses.\n"
        "- A decision on who won the debate, with reasoning.\n\n"
        f"Debate Transcript:\n{debate_transcript}"
    )
    return generate_ai_response(prompt)

def user_input_statement(debater_name):
    """
    Lets a user type a statement in the debate.
    """
    print(f"\n{debater_name}, it's your turn to speak.")
    statement = input("Enter your argument or statement (or 'DONE' to end): ")
    return statement

###############################################################################
# 3) Debate Flow Functions
###############################################################################

def run_debate_ai_vs_ai(debate_transcript, topic, user_as_judge=False):
    """
    AI vs AI, with either AI judge or user judge at the end.
    """
    round_count = 0
    while round_count < 6:
        round_count += 1
        print(f"\n=== Round {round_count} ===")

        # Pro statement
        pro_request = f"Argue in favor of the topic: '{topic}'. Respond clearly and persuasively without adding introductions or conclusions."
        pro_statement = ai_debater("AI Debater 1 (Pro)", pro_request)
        debate_transcript += f"\n[AI Debater 1 - Pro, Round {round_count}]: {pro_statement}"
        print(f"\nAI Debater 1 (Pro) says:\n{pro_statement}\n")

        # Check if user wants to end
        end_input = input("Press ENTER to continue or type 'DONE' to end debate now: ").strip().lower()
        if end_input == "done":
            break

        # Con statement
        con_request = f"Argue against the topic: '{topic}'. Respond to the Pro's arguments. Keep it concise and direct."
        con_statement = ai_debater("AI Debater 2 (Con)", con_request)
        debate_transcript += f"\n[AI Debater 2 - Con, Round {round_count}]: {con_statement}"
        print(f"\nAI Debater 2 (Con) says:\n{con_statement}\n")

        # Another chance to break
        end_input = input("Press ENTER to proceed to next round or 'DONE' to end debate: ").strip().lower()
        if end_input == "done":
            break

    # Judge
    if user_as_judge:
        user_judge_comment = input("\nAs the user judge, please provide your feedback and decision: ")
        debate_transcript += f"\n[User Judge]: {user_judge_comment}"
    else:
        judge_feedback = ai_judge(debate_transcript)
        debate_transcript += f"\n\n[AI Judge]: {judge_feedback}"

    save_debate_log(debate_transcript, topic, "AI vs AI")

def run_debate_users(debate_transcript, topic):
    """
    User vs User, AI judge at the end.
    """
    round_count = 0
    while round_count < 6:
        round_count += 1
        print(f"\n=== Round {round_count} ===")

        # User 1 (Pro)
        statement = user_input_statement("User Debater 1 (Pro)")
        if statement.strip().lower() == "done":
            break
        debate_transcript += f"\n[User Debater 1 (Pro), Round {round_count}]: {statement}"

        # User 2 (Con)
        statement = user_input_statement("User Debater 2 (Con)")
        if statement.strip().lower() == "done":
            break
        debate_transcript += f"\n[User Debater 2 (Con), Round {round_count}]: {statement}"

    # AI judge evaluates the transcript
    print("\n--- Judging the Debate ---")
    judge_feedback = ai_judge(debate_transcript)
    debate_transcript += f"\n\n[AI Judge]: {judge_feedback}"

    # Print the AI judge's feedback
    print("\n=== AI Judge's Feedback ===")
    print(judge_feedback)

    # Save the transcript and judge's feedback
    save_debate_log(debate_transcript, topic, "User vs User")

def run_debate_ai_and_user(debate_transcript, topic):
    """
    AI as one debater, user as the other, AI as judge.
    Up to 6 back-and-forth rounds or until 'DONE'.
    The user chooses which side they want (Pro or Con), and the AI takes the opposite side.
    """
    print("\nDo you want to argue for the PRO side or the CON side?")
    user_side = input("Type 'pro' or 'con': ").strip().lower()

    if user_side == "pro":
        user_label, ai_label, ai_side = "User Debater (Pro)", "AI Debater (Con)", "CON"
    else:
        user_label, ai_label, ai_side = "User Debater (Con)", "AI Debater (Pro)", "PRO"

    round_count = 0
    while round_count < 6:
        round_count += 1
        print(f"\n=== Round {round_count} ===")

        if user_side == "pro":
            # User goes first (Pro)
            statement = user_input_statement(user_label)
            if statement.strip().lower() == "done":
                break
            debate_transcript += f"\n[{user_label}, Round {round_count}]: {statement}"

            # AI responds (Con)
            ai_request = f"Argue for the {ai_side} side of the topic: '{topic}'. Respond to the user's statement."
            ai_response = ai_debater(ai_label, ai_request)
            debate_transcript += f"\n[{ai_label}, Round {round_count}]: {ai_response}"
            print(f"\n{ai_label} says:\n{ai_response}\n")
        else:
            # AI goes first (Pro)
            ai_request = f"Argue for the {ai_side} side of the topic: '{topic}'."
            ai_response = ai_debater(ai_label, ai_request)
            debate_transcript += f"\n[{ai_label}, Round {round_count}]: {ai_response}"
            print(f"\n{ai_label} says:\n{ai_response}\n")

            # User responds (Con)
            statement = user_input_statement(user_label)
            if statement.strip().lower() == "done":
                break
            debate_transcript += f"\n[{user_label}, Round {round_count}]: {statement}"

        # Check if the user wants to end the debate early
        end_input = input("Press ENTER to continue or 'DONE' to end debate: ").strip().lower()
        if end_input == "done":
            break

    # AI Judge evaluates the debate
    print("\n--- Judging the Debate ---")
    judge_feedback = ai_judge(debate_transcript)
    debate_transcript += f"\n\n[AI Judge]: {judge_feedback}"

    # Print the AI judge's feedback
    print("\n=== AI Judge's Feedback ===")
    print(judge_feedback)

    # Save the transcript and judge's feedback
    save_debate_log(debate_transcript, topic, "AI vs User")

###############################################################################
# 4) Utility Functions
###############################################################################

def save_debate_log(debate_transcript, topic, mode):
    """
    Saves the debate transcript to a markdown file.
    """
    if not os.path.exists("logs"):
        os.makedirs("logs")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"logs/debate_{timestamp}.md"
    with open(filename, "w") as f:
        f.write(f"# Debate Transcript\n\n**Timestamp:** {timestamp}\n**Topic:** {topic}\n**Mode:** {mode}\n\n{debate_transcript}")
    print(f"\nDebate log saved to: {filename}")

###############################################################################
# 5) Main Program
###############################################################################

def main():
    print("=== Welcome to DebateSim ===")
    print("1) AI vs AI, AI judges")
    print("2) AI vs AI, user judges")
    print("3) User vs User, AI judges")
    print("4) AI vs User, AI judges")

    mode = input("\nEnter the number corresponding to the mode you want: ").strip()
    topic = input("\nEnter the debate topic or resolution: ").strip()

    debate_transcript = ""

    if mode == "1":
        run_debate_ai_vs_ai(debate_transcript, topic, user_as_judge=False)
    elif mode == "2":
        run_debate_ai_vs_ai(debate_transcript, topic, user_as_judge=True)
    elif mode == "3":
        run_debate_users(debate_transcript, topic)
    elif mode == "4":
        run_debate_ai_and_user(debate_transcript, topic)
    else:
        print("Invalid mode selected. Please try again.")

if __name__ == "__main__":
    main()