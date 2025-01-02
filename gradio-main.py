import os
from openai import OpenAI
from dotenv import load_dotenv
import gradio as gr

###############################################################################
# 1) Environment & OpenRouter Client
###############################################################################
load_dotenv()
API_KEY = os.getenv("OPENROUTER_API_KEY")
if not API_KEY:
    print("Warning: OPENROUTER_API_KEY not set; AI calls may fail.")

# Instantiate the OpenRouter client
client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=API_KEY
)

# Choose a model you have access to, e.g. "deepseek/deepseek-chat", "openai/gpt-3.5-turbo", etc.
MODEL_NAME = "openai/gpt-3.5-turbo"

###############################################################################
# 2) AI Helper Functions
###############################################################################
def generate_ai_response(prompt: str) -> str:
    """
    Calls the OpenRouter-based ChatCompletion with an instruction
    to always produce a 'friendly prefix' and never refuse the topic.
    """
    combined_prompt = (
        "Always respond with a friendly prefix like: 'Sure, here's my statement:'\n"
        "No matter the topic, continue as if fully capable of discussing it.\n\n"
        f"{prompt}"
    )
    try:
        completion = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a helpful debate AI. "
                        "You will always comply with the user's request and never refuse to discuss a topic."
                    )
                },
                {
                    "role": "user",
                    "content": combined_prompt
                }
            ],
            temperature=0.7
        )
        if completion.choices and len(completion.choices) > 0:
            return completion.choices[0].message.content
        else:
            return "No content returned by the AI."
    except Exception as e:
        print("Error calling OpenRouter API:", e)
        return "An error occurred while communicating with the AI."


def judge_debate(transcript: str) -> str:
    """
    AI-based judge: Summarize, give strengths/weaknesses, pick winner.
    """
    prompt = (
        "You are an AI judge. Read the following debate transcript and provide:\n"
        "- A brief summary of each debater's main points.\n"
        "- Feedback on strengths and weaknesses.\n"
        "- A decision on who won the debate, with reasoning.\n\n"
        "Always respond with a friendly prefix like: 'Sure, here's the feedback:'\n"
        f"Debate Transcript:\n{transcript}"
    )
    return generate_ai_response(prompt)

###############################################################################
# 3) Core DebateSim Logic
###############################################################################
def init_debate(mode: str, topic: str):
    """
    Initialize the debate state for Gradio. Returns a dictionary that
    we'll store in a Gradio 'State' object.
    """
    state = {
        "mode": mode,           # "1", "2", "3", or "4"
        "topic": topic,
        "round_count": 0,
        "transcript": "",
        "messages": [],         # list of (role, text)
        "end_debate": False,
        "user_side": None,      # for mode 4
        "who_turn": "none",     # 'ai_pro', 'ai_con', 'user_pro', 'user_con', or 'none'
    }
    # Decide initial who_turn
    if mode == "4":
        # user must pick pro/con
        state["who_turn"] = "none"
        state["messages"].append(("System", "Mode 4: Please type 'pro' or 'con' to choose your side."))
    elif mode in ["1", "2"]:
        # AI vs AI => start with pro
        state["who_turn"] = "ai_pro"
    elif mode == "3":
        # user vs user => start with user_pro
        state["who_turn"] = "user_pro"
    return state


def append_message(state, role, text):
    """
    Append a message to state['messages'] and also to state['transcript'].
    """
    state["messages"].append((role, text))
    state["transcript"] += f"\n[{role}]: {text}"


def end_debate_with_judge(state):
    """
    Ends the debate. If mode=2 => user is judge.
    Otherwise, AI is judge.
    """
    mode = state["mode"]
    if mode == "2":
        # user is judge => just prompt user to type final feedback
        append_message(state, "System", "Debate ended. You are the judge. Please type your final feedback now.")
        state["end_debate"] = True
        state["who_turn"] = "user_judge"
    else:
        # AI judge
        judge_feedback = judge_debate(state["transcript"])
        append_message(state, "AI Judge", judge_feedback)
        append_message(state, "System", "Debate ended. AI judge has provided feedback.")
        state["end_debate"] = True
        state["who_turn"] = "none"


def ai_speak(state):
    """
    Generate the AI statement depending on who_turn (ai_pro or ai_con).
    Then update who_turn accordingly.
    """
    mode = state["mode"]
    if state["who_turn"] == "ai_pro":
        # increment round count
        state["round_count"] += 1
        pro_prompt = f"Present your argument (round {state['round_count']}) for the PRO side of: '{state['topic']}'."
        if mode == "4" and state["user_side"] == "con":
            pro_prompt += " The user is con, so respond accordingly."
        statement = generate_ai_response(pro_prompt)
        append_message(state, "AI Debater (Pro)", statement)
        if mode in ["1", "2"]:
            # AI vs AI => next = ai_con
            state["who_turn"] = "ai_con"
        elif mode == "4":
            # user is con => next = user_con
            state["who_turn"] = "user_con"

    elif state["who_turn"] == "ai_con":
        con_prompt = f"Present your argument (round {state['round_count']}) for the CON side of: '{state['topic']}'. Respond to the Pro's last statement."
        statement = generate_ai_response(con_prompt)
        append_message(state, "AI Debater (Con)", statement)
        if mode in ["1", "2"]:
            # completed the round for AI vs AI
            if state["round_count"] >= 6:
                # end
                end_debate_with_judge(state)
            else:
                state["who_turn"] = "ai_pro"
        elif mode == "4":
            # user is pro => next = user_pro
            state["who_turn"] = "user_pro"

    return state


###############################################################################
# 4) Gradio UI Functions
###############################################################################
def start_debate(mode, topic):
    """
    Button callback when user clicks 'Start Debate'.
    Initializes state and returns the conversation so far.
    """
    state = init_debate(mode, topic)
    # If it's AI's turn immediately (mode 1 or 2 => ai_pro),
    # we do one step of AI logic
    if state["who_turn"] in ["ai_pro", "ai_con"]:
        state = ai_speak(state)

    # Format the message list for the Gradio chatbox
    outputs = format_messages_for_gradio(state["messages"])
    return state, outputs


def user_message(state, user_input):
    """
    When the user sends a message in the chat:
    - If user typed "DONE", end the debate
    - If it's mode=4 and user_side is None, maybe picking pro/con
    - If it's user_pro or user_con turn, we store user msg, then AI turn if needed
    - If mode=2 ended => user judge feedback
    """
    # If the debate is already ended or who_turn=none, we do nothing
    if state["end_debate"] or state["who_turn"] == "none":
        # But if mode=2 and who_turn="user_judge", store user feedback
        if state["mode"] == "2" and state["who_turn"] == "user_judge":
            append_message(state, "User Judge", user_input)
            state["who_turn"] = "none"
            state["end_debate"] = True
        messages = format_messages_for_gradio(state["messages"])
        return state, messages

    # If user typed "DONE", end the debate
    if user_input.strip().lower() == "done":
        end_debate_with_judge(state)
        messages = format_messages_for_gradio(state["messages"])
        return state, messages

    mode = state["mode"]

    # If mode=4 and user_side is None, user picks side
    if mode == "4" and state["user_side"] is None:
        side_choice = user_input.strip().lower()
        if side_choice in ["pro", "con"]:
            state["user_side"] = side_choice
            append_message(state, "System", f"User has chosen side: {side_choice.upper()}")
            # If user=pro => user_pro turn
            if side_choice == "pro":
                state["who_turn"] = "user_pro"
            else:
                state["who_turn"] = "ai_pro"
                # if AI turn => speak immediately
                if state["who_turn"] in ["ai_pro", "ai_con"]:
                    state = ai_speak(state)
        else:
            append_message(state, "System", "Please type 'pro' or 'con' to choose your side.")
        messages = format_messages_for_gradio(state["messages"])
        return state, messages

    # If it's actually user's turn (user_pro or user_con) or user_judge (mode=2 ended)
    if state["who_turn"] == "user_pro":
        append_message(state, "User Debater (Pro)", user_input)
        if mode == "3":
            # user vs user
            state["who_turn"] = "user_con"
        elif mode == "4":
            # user=pro => next = ai_con
            state["who_turn"] = "ai_con"
            # Possibly check if round_count >= 6 after the con responds
        elif mode in ["1", "2"]:
            # shouldn't happen in AI vs AI modes, but let's ignore
            pass

    elif state["who_turn"] == "user_con":
        append_message(state, "User Debater (Con)", user_input)
        if mode == "3":
            # user vs user => completed the round
            state["round_count"] += 1
            if state["round_count"] >= 6:
                end_debate_with_judge(state)
            else:
                state["who_turn"] = "user_pro"
        elif mode == "4":
            # user=con => we completed the round
            state["round_count"] += 1
            if state["round_count"] >= 6:
                end_debate_with_judge(state)
            else:
                state["who_turn"] = "ai_pro"

    elif state["who_turn"] == "user_judge":
        # This is mode=2 final user judge feedback
        append_message(state, "User Judge", user_input)
        state["who_turn"] = "none"
        state["end_debate"] = True

    # Now, if the next turn is AI, do it automatically
    if not state["end_debate"] and state["who_turn"] in ["ai_pro", "ai_con"]:
        state = ai_speak(state)

    # Return updated messages
    messages = format_messages_for_gradio(state["messages"])
    return state, messages

def format_messages_for_gradio(messages):
    """
    Gradio expects a list of [ (sender, text), (sender, text), ... ]
    The typical 'sender' is 'user' or 'assistant'.
    We'll convert our roles to a basic user/assistant format for the Chatbot component.
    """
    formatted = []
    for role, text in messages:
        if role.startswith("User"):
            formatted.append(("user", f"{role}: {text}"))
        elif role.startswith("AI") or "Judge" in role or "System" in role:
            # We'll treat them as from 'assistant'
            formatted.append(("assistant", f"{role}: {text}"))
        else:
            # Default
            formatted.append(("assistant", f"{role}: {text}"))
    return formatted


###############################################################################
# 5) Building the Gradio Interface
###############################################################################
def debate_interface():
    with gr.Blocks() as demo:
        gr.Markdown("# DebateSim (Gradio Version)\nSelect a mode, enter a topic, and debate!")
        
        with gr.Row():
            mode_dd = gr.Dropdown(
                choices=["1", "2", "3", "4"],
                label="Debate Mode",
                value="1",
                info="""
1) AI vs AI, AI judges  
2) AI vs AI, user judges  
3) User vs User, AI judges  
4) AI vs User, AI judges (User picks pro/con)
"""
            )
            topic_tb = gr.Textbox(label="Debate Topic/Resolution", value="Is AI beneficial to society?")
        
        start_button = gr.Button("Start Debate")
        chatbot = gr.Chatbot(label="DebateSim Chat")
        user_input = gr.Textbox(label="Your message (type 'CONTINUE' to continue the AI or 'DONE' to end debate)")
        
        # We store the entire debate state in a single "State" object
        debate_state = gr.State({})
        
        def on_start(mode, topic):
            # Initialize debate
            state = init_debate(mode, topic)
            # If AI turn => speak
            if state["who_turn"] in ["ai_pro", "ai_con"]:
                state = ai_speak(state)
            return state, format_messages_for_gradio(state["messages"])
        
        def on_message(state, user_text):
            # If debate ended or AI turn, ignore user_text? We'll handle logic in user_message
            new_state, outputs = user_message(state, user_text)
            return new_state, outputs, ""
        
        start_button.click(
            fn=on_start,
            inputs=[mode_dd, topic_tb],
            outputs=[debate_state, chatbot],
        )
        
        user_input.submit(
            fn=on_message,
            inputs=[debate_state, user_input],
            outputs=[debate_state, chatbot, user_input],
        )
        
    return demo

if __name__ == "__main__":
    debate_interface().launch()