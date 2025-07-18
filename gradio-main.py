import os
from openai import OpenAI
from dotenv import load_dotenv
import gradio as gr

###############################################################################
# 1) Environment & OpenRouter Client
###############################################################################
load_dotenv()
API_KEY = os.getenv("OPENROUTER_API_KEY")

# If you have no key set, warn but don't crash
if not API_KEY:
    print("Warning: OPENROUTER_API_KEY not set; AI calls may fail.")

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=API_KEY
)

# Example model; replace if needed
MODEL_NAME = "openai/gpt-3.5-turbo"

###############################################################################
# 2) AI Helper Functions
###############################################################################
def generate_ai_response(prompt: str) -> str:
    """
    Calls the ChatCompletion API with a 'friendly prefix' directive.
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
                        "You are a helpful debate AI. You always comply with user requests "
                        "and never refuse a topic."
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
    state = {
        "mode": mode,
        "topic": topic,
        "round_count": 0,
        "transcript": "",
        "messages": [],
        "end_debate": False,
        "user_side": None,
        "who_turn": "none",
    }
    # Setup initial who_turn
    if mode == "4":
        state["messages"].append(
            ("System", "Mode 4 selected: Please type 'pro' or 'con' to choose your side.")
        )
    elif mode in ["1", "2"]:
        # AI vs AI => start with ai_pro
        state["who_turn"] = "ai_pro"
    elif mode == "3":
        # user vs user => user_pro
        state["who_turn"] = "user_pro"
    return state

def append_message(state, role, text):
    state["messages"].append((role, text))
    state["transcript"] += f"\n[{role}]: {text}"

def end_debate_with_judge(state):
    if state["mode"] == "2":
        # user is judge
        append_message(state, "System", "Debate ended. You are the judge. Please type final feedback now.")
        state["end_debate"] = True
        state["who_turn"] = "user_judge"
    else:
        # AI judge
        feedback = judge_debate(state["transcript"])
        append_message(state, "AI Judge", feedback)
        append_message(state, "System", "Debate ended. AI judge has provided feedback.")
        state["end_debate"] = True
        state["who_turn"] = "none"

def ai_speak(state):
    mode = state["mode"]
    if state["who_turn"] == "ai_pro":
        state["round_count"] += 1
        prompt = f"Present your argument (round {state['round_count']}) for the PRO side of: '{state['topic']}'."
        if mode == "4" and state["user_side"] == "con":
            prompt += " The user is con, so respond accordingly."
        reply = generate_ai_response(prompt)
        append_message(state, "AI Debater (Pro)", reply)

        if mode in ["1", "2"]:
            state["who_turn"] = "ai_con"
        elif mode == "4":
            state["who_turn"] = "user_con"

    elif state["who_turn"] == "ai_con":
        prompt = (
            f"Present your argument (round {state['round_count']}) for the CON side of: '{state['topic']}'. "
            "Respond to the Pro's last statement."
        )
        reply = generate_ai_response(prompt)
        append_message(state, "AI Debater (Con)", reply)

        if mode in ["1", "2"]:
            if state["round_count"] >= 6:
                end_debate_with_judge(state)
            else:
                state["who_turn"] = "ai_pro"
        elif mode == "4":
            state["who_turn"] = "user_pro"

    return state

###############################################################################
# 4) Gradio Callbacks
###############################################################################
def format_messages_for_gradio(messages):
    result = []
    for role, text in messages:
        if role.startswith("User"):
            result.append(("user", f"{role}: {text}"))
        else:
            result.append(("assistant", f"{role}: {text}"))
    return result

def on_continue(state):
    if not state["end_debate"] and state["who_turn"] in ["ai_pro", "ai_con"]:
        state = ai_speak(state)
    return state, format_messages_for_gradio(state["messages"])

def on_finish(state):
    if not state["end_debate"]:
        end_debate_with_judge(state)
    return state, format_messages_for_gradio(state["messages"])

def on_user_message(state, user_text):
    if state["end_debate"] or state["who_turn"] == "none":
        # Possibly final user_judge
        if state["mode"] == "2" and state["who_turn"] == "user_judge":
            append_message(state, "User Judge", user_text)
            state["end_debate"] = True
            state["who_turn"] = "none"
        return state, format_messages_for_gradio(state["messages"]), ""

    if user_text.strip().lower() == "done":
        end_debate_with_judge(state)
        return state, format_messages_for_gradio(state["messages"]), ""

    # mode logic...
    # user_pro / user_con flow...
    # ...
    # (Same as your existing code)

    return state, format_messages_for_gradio(state["messages"]), ""

###############################################################################
# 5) The Key Part: A "Starting debate..." System Message
###############################################################################
def on_start(mode, topic):
    """
    Immediately add "System: Starting debate..." so user sees something
    while the AI call is processing. Then proceed with AI logic if needed.
    """
    # 1) Initialize an empty state
    state = init_debate(mode, topic)

    # 2) Immediately append a system message
    append_message(state, "System", "Starting debate...")

    # 3) If it's AI vs AI, do an AI turn
    if state["who_turn"] in ["ai_pro", "ai_con"]:
        state = ai_speak(state)

    # Return final
    return state, format_messages_for_gradio(state["messages"])

###############################################################################
# 6) Gradio Interface
###############################################################################
def debate_interface():
    with gr.Blocks() as demo:
        gr.Markdown("# DebateSim\nA minimal debate simulation with immediate feedback on Start.")

        mode_dd = gr.Dropdown(
            choices=["1","2","3","4"],
            label="Debate Mode",
            value="1"
        )
        topic_tb = gr.Textbox(
            label="Debate Topic",
            value="Is AI beneficial to society?"
        )
        start_button = gr.Button("Start Debate")

        debate_state = gr.State({})

        chatbot = gr.Chatbot(label="Debate Transcript", visible=False)
        continue_btn = gr.Button("Continue (AI)", visible=False)
        finish_btn = gr.Button("Finish", visible=False)
        user_input = gr.Textbox(label="Your message (DONE to end)", visible=False)

        # Once debate starts, we decide what to show
        def start_debate(mode, topic):
            s, msgs = on_start(mode, topic)
            # If mode=1 => show continue/finish, hide user input
            show_chat = True
            show_continue = (mode == "1")
            show_finish = (mode == "1")
            show_input = (mode != "1")
            return (
                s,
                msgs,
                gr.update(visible=show_chat),
                gr.update(visible=show_continue),
                gr.update(visible=show_finish),
                gr.update(visible=show_input)
            )

        start_button.click(
            fn=start_debate,
            inputs=[mode_dd, topic_tb],
            outputs=[
                debate_state,
                chatbot,
                chatbot,        # show chat
                continue_btn,   # show/hide continue
                finish_btn,     # show/hide finish
                user_input      # show/hide user input
            ]
        )

        continue_btn.click(on_continue, [debate_state], [debate_state, chatbot])
        finish_btn.click(on_finish, [debate_state], [debate_state, chatbot])
        user_input.submit(on_user_message, [debate_state, user_input], [debate_state, chatbot, user_input])

    return demo

if __name__ == "__main__":
    debate_interface().launch()