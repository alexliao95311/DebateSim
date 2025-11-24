from langchain_core.language_models import BaseChatModel
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.outputs import ChatGeneration, ChatResult
from typing import List, Any, Mapping, Optional
from pydantic import Field
import os
import aiohttp
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("OPENROUTER_API_KEY")
if not API_KEY:
  raise ValueError("Please set OPENROUTER_API_KEY before starting.")


class OpenRouterChat(BaseChatModel):
  """Custom LangChain chat model for OpenRouter API (Trainer)."""

  def _ensure_full_model_name(self, name: str) -> str:
    if "/" in name:
      return name
    provider_map = {
      "deepseek": "deepseek",
      "openai": "openai",
      "google": "google",
      "mistral": "mistralai",
      "meta": "meta",
    }
    root_token = name.split("-", 1)[0]
    provider = provider_map.get(root_token)
    return f"{provider}/{name}" if provider else name

  model_name: str = Field(default="openai/gpt-4o-mini")
  temperature: float = Field(default=0.3)
  api_key: str = Field(default=API_KEY)
  api_base: str = Field(default="https://openrouter.ai/api/v1/chat/completions")

  class Config:
    arbitrary_types_allowed = True

  def _generate(self, messages: List[Any], stop: Optional[List[str]] = None, **kwargs):
    headers = {
      "Authorization": f"Bearer {self.api_key}",
      "Content-Type": "application/json",
      "HTTP-Referer": "https://debatesim.app",
    }

    formatted_messages = []
    for message in messages:
      if isinstance(message, SystemMessage):
        formatted_messages.append({"role": "system", "content": message.content})
      elif isinstance(message, HumanMessage):
        formatted_messages.append({"role": "user", "content": message.content})
      elif isinstance(message, AIMessage):
        formatted_messages.append({"role": "assistant", "content": message.content})
      else:
        formatted_messages.append({"role": "user", "content": str(message)})

    payload = {
      "model": self._ensure_full_model_name(self.model_name),
      "messages": formatted_messages,
      "temperature": self.temperature,
      "max_tokens": 1200,
    }
    if stop:
      payload["stop"] = stop

    import requests

    resp = requests.post(self.api_base, headers=headers, json=payload)
    if resp.status_code != 200:
      try:
        err_detail = resp.json().get("error", {}).get("message", "Unknown error")
      except Exception:
        err_detail = resp.text
      raise ValueError(f"OpenRouter API error: {resp.status_code} - {err_detail}")

    data = resp.json()
    content = data["choices"][0]["message"]["content"]
    return ChatResult(
      generations=[
        ChatGeneration(
          message=AIMessage(content=content)
        )
      ]
    )

  async def _agenerate(self, messages: List[Any], stop: Optional[List[str]] = None, **kwargs):
    headers = {
      "Authorization": f"Bearer {self.api_key}",
      "Content-Type": "application/json",
      "HTTP-Referer": "https://debatesim.app",
    }

    formatted_messages = []
    for message in messages:
      if isinstance(message, SystemMessage):
        formatted_messages.append({"role": "system", "content": message.content})
      elif isinstance(message, HumanMessage):
        formatted_messages.append({"role": "user", "content": message.content})
      elif isinstance(message, AIMessage):
        formatted_messages.append({"role": "assistant", "content": message.content})
      else:
        formatted_messages.append({"role": "user", "content": str(message)})

    payload = {
      "model": self._ensure_full_model_name(self.model_name),
      "messages": formatted_messages,
      "temperature": self.temperature,
      "max_tokens": 1200,
    }
    if stop:
      payload["stop"] = stop

    async with aiohttp.ClientSession() as session:
      async with session.post(self.api_base, headers=headers, json=payload) as resp:
        if resp.status != 200:
          try:
            err_data = await resp.json()
            err_detail = err_data.get("error", {}).get("message", "Unknown error")
          except Exception:
            err_detail = await resp.text()
          raise ValueError(f"OpenRouter API error: {resp.status} - {err_detail}")
        data = await resp.json()
        content = data["choices"][0]["message"]["content"]

    return ChatResult(
      generations=[
        ChatGeneration(
          message=AIMessage(content=content)
        )
      ]
    )

  @property
  def _llm_type(self) -> str:
    return "openrouter-trainer-chat"

  @property
  def _identifying_params(self) -> Mapping[str, Any]:
    return {
      "model_name": self._ensure_full_model_name(self.model_name),
      "temperature": self.temperature,
    }


TRAINER_PROMPT = """SYSTEM: You are a Debate Speech Coach providing concise, critical feedback. This is NOT a debate simulation.
Do NOT simulate opponents, judges, rounds, personas, crossfire, rebuttals, or win/loss language.
Do NOT include any headers or text that references "Round", "Opponent", "Frontline", "Judge", or "I win".
ONLY point out flaws and problems. Do NOT praise or say what's good. Be direct and concise.

{format_specific_instructions}

Follow the section headers specified in the format-specific instructions above. If no specific headers are provided, use these defaults:
== Content Analysis ==
== Efficiency Critique ==
== Precise Cuts and Rewrites ==
== Improvements ==

Requirements (BE CONCISE - no fluff):
1) Content sections: List ONLY problems and flaws in the areas specified. Be direct. No praise.

2) Efficiency Critique (bulleted): List ONLY inefficiencies - fluff, redundancy, filler, hedging, throat‑clearing, overlong phrasing. Be concrete and brief.

3) Precise Cuts and Rewrites (most important): For each problem, QUOTE the exact span and give:
   - Original: "…quoted span…"
   - Location: "…first5…" → "…last5…"
   - Action: CUT or REWORD
   - Replacement (if REWORD): "…shorter alternative…"
   - Words saved: ~N

4) Improvements: List 4-6 specific fixes to address the identified problems. Be concrete and actionable.

Student speech:
{speech}
"""

trainer_prompt = ChatPromptTemplate.from_template(TRAINER_PROMPT)


def get_format_specific_instructions(debate_format: str, round_num: int, speech_type: str, speech_number: int = 0) -> str:
  """Generate format-specific coaching instructions with speech-type-specific prompts."""
  if debate_format == "public-forum":
    if speech_type == "Constructive":
      return f"""
PUBLIC FORUM CONSTRUCTIVE (Round {round_num} of 4)

Speech Purpose: A PF constructive MUST:
- Present the case
- Introduce framework/value/weighing if used
- Present contentions with claims → warrants → impacts
- Provide all offense for the round
- Include evidence citations and internal links

It should NOT respond to opponents (none exist yet).

FEEDBACK FOCUS: Identify ONLY problems and flaws in:
- Case structure and clarity
- Evidence quality and warrant development
- Logic and internal links
- Impact analysis
- Strategic value (what will matter later)

Use these section headers:
== Case Structure & Clarity ==
== Evidence & Warrant Quality ==
== Logic & Internal Links ==
== Impact Analysis ==
== Strategic Value ==
== Efficiency Critique ==
== Precise Cuts and Rewrites ==
== Improvements ==
"""
    elif speech_type == "Rebuttal" and round_num == 2 and speech_number == 3:
      return f"""
PUBLIC FORUM FIRST REBUTTAL (Round {round_num} of 4)

Speech Purpose: First rebuttal MUST:
- Respond ONLY to the opponent's case
- Provide refutation (link takeouts, impact takeouts, evidence comparison)
- No extensions of your own case yet
- No frontlining (that happens in second rebuttal)
- No collapse or weighing (summary does that)

FEEDBACK FOCUS: Identify ONLY problems and flaws in:
- Direct refutation quality
- Evidence comparison and logic
- Clash and coverage
- Strategic layering (grouping, prioritization)

Use these section headers:
== Direct Refutation Quality ==
== Evidence Comparison & Logic ==
== Clash & Coverage ==
== Strategic Layering ==
== Efficiency Critique ==
== Precise Cuts and Rewrites ==
== Improvements ==
"""
    elif speech_type == "Rebuttal" and round_num == 2 and speech_number == 4:
      return f"""
PUBLIC FORUM SECOND REBUTTAL (Round {round_num} of 4)

Speech Purpose: Second rebuttal MUST:
- Frontline attacks from opponent's rebuttal
- Defend your own case (clean, warranted, direct)
- Respond to opponent's case (same as first rebuttal)
- Begin laying groundwork for collapse
- NO extensions yet
- Very light weighing allowed but not required

FEEDBACK FOCUS: Identify ONLY problems and flaws in:
- Frontline quality and case defense
- Refutation of opponent's case
- Coverage, clarity, and prioritization
- Setup for summary (weighing setups, collapse prep)

Use these section headers:
== Frontline Quality & Case Defense ==
== Refutation of Opponent's Case ==
== Coverage, Clarity, and Prioritization ==
== Setup for Summary ==
== Efficiency Critique ==
== Precise Cuts and Rewrites ==
== Improvements ==
"""
    elif speech_type == "Rebuttal":
      # Fallback for rebuttals that don't match specific speech numbers
      # Default to first rebuttal guidance
      return f"""
PUBLIC FORUM REBUTTAL (Round {round_num} of 4)

Speech Purpose: Rebuttal MUST respond to opponent arguments and provide refutation.

FEEDBACK FOCUS: Identify ONLY problems and flaws in:
- Direct refutation quality
- Evidence comparison and logic
- Clash and coverage
- Strategic approach

Use these section headers:
== Direct Refutation Quality ==
== Evidence Comparison & Logic ==
== Clash & Coverage ==
== Efficiency Critique ==
== Precise Cuts and Rewrites ==
== Improvements ==
"""
    elif speech_type == "Summary":
      return f"""
PUBLIC FORUM SUMMARY (Round {round_num} of 4)

Speech Purpose: Summary MUST:
- Collapse — choose 1 or 2 winning arguments
- Extend offense with full warrants + impacts
- Extend frontlines to keep your case alive
- Refute any remaining key responses
- Introduce weighing
- Create the round vision for the judge

It should NOT introduce new responses.

FEEDBACK FOCUS: Identify ONLY problems and flaws in:
- Collapse and prioritization
- Extensions (warrants, links, impacts)
- Weighing quality (comparative)
- Frontline extensions
- Strategic refutation coverage

Use these section headers:
== Collapse & Prioritization ==
== Extensions (warrants, links, impacts) ==
== Weighing Quality (comparative) ==
== Frontline Extensions ==
== Strategic Refutation Coverage ==
== Efficiency Critique ==
== Precise Cuts and Rewrites ==
== Improvements ==
"""
    elif speech_type == "Final Focus":
      return f"""
PUBLIC FORUM FINAL FOCUS (Round {round_num} of 4)

Speech Purpose: Final Focus MUST:
- Be consistent with the summary (no new arguments)
- Re-extend ONLY the collapsed offense
- Provide sharp weighing
- Give clean voters
- Tell the judge exactly how to sign the ballot
- Be short, crisp, and fully comparative

No new responses or evidence.

FEEDBACK FOCUS: Identify ONLY problems and flaws in:
- Crystallization and round vision
- Weighing quality (probability, magnitude, timeframe)
- Voters and judge instruction
- Consistency with summary

Use these section headers:
== Crystallization & Round Vision ==
== Weighing Quality (probability, magnitude, timeframe) ==
== Voters & Judge Instruction ==
== Consistency With Summary ==
== Efficiency Critique ==
== Precise Cuts and Rewrites ==
== Improvements ==
"""
    else:
      return f"""
PUBLIC FORUM CONTEXT:
- Round: {round_num} of 4
- Speech Type: {speech_type}

Provide feedback appropriate to this Public Forum speech type.
"""
  else:
    return f"""
DEBATE CONTEXT:
- Round: {round_num}
- Speech Type: {speech_type}
- Format: {debate_format}

Provide feedback appropriate to this debate format and round type.
"""


def get_trainer_chain(model_name: str = "openai/gpt-4o-mini"):
  """Return a chain that gives comprehensive speech feedback (content + efficiency)."""
  llm = OpenRouterChat(model_name=model_name, temperature=0.3)

  def format_input(speech: str, debate_format: str = "none", round_num: int = 0, speech_type: str = "", speech_number: int = 0):
    format_instructions = get_format_specific_instructions(debate_format, round_num, speech_type, speech_number)
    return {
      "speech": speech,
      "format_specific_instructions": format_instructions
    }

  chain = (
    format_input
    | trainer_prompt
    | llm
    | StrOutputParser()
  )

  class ChainWrapper:
    def __init__(self, c):
      self.chain = c

    def run(self, *, speech: str, debate_format: str = "none", round_num: int = 0, speech_type: str = "", speech_number: int = 0):
      return self.chain.invoke({
        "speech": speech,
        "debate_format": debate_format,
        "round_num": round_num,
        "speech_type": speech_type,
        "speech_number": speech_number
      })

  return ChainWrapper(chain)


