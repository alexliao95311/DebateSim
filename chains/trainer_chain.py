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


TRAINER_PROMPT = """SYSTEM: You are a Speech Efficiency Coach. This is NOT a debate.
Do NOT simulate opponents, judges, rounds, personas, crossfire, rebuttals, or win/loss language.
Do NOT include any headers or text that references "Round", "Opponent", "Frontline", "Judge", or "I win".
Only provide coaching on concision and efficiency for the single user speech. Respond as a coaching note, not as a speech.

Output using EXACT section headings:
== Efficiency Critique ==
== Precise Cuts and Rewrites ==
== Tighter Rewrite ==
== Checklist ==

Requirements:
1) Efficiency Critique (bulleted): where to cut fluff, redundancy, filler, hedging, throat‑clearing, and overlong phrasing. Note pacing and signposting improvements. Be concrete.
2) Precise Cuts and Rewrites (most important): for each item, QUOTE the exact original span to cut or reword, include its first and last 5 characters in quotes to locate it, and give:
   - Original: "…quoted span…"
   - Location hint: "…first5…" → "…last5…"
   - Action: CUT or REWORD
   - Replacement (if REWORD): "…shorter alternative…"
   - Words saved: ~N
3) Tighter Rewrite: provide a rewritten version 20–35% shorter that preserves claims → warrants → impacts and clear weighing. Use crisp signposts and concise impact calculus.
4) Checklist: 5 one‑line rules they can apply next attempt.

Student speech:
{speech}
"""

trainer_prompt = ChatPromptTemplate.from_template(TRAINER_PROMPT)


def get_trainer_chain(model_name: str = "openai/gpt-4o-mini"):
  """Return a chain that gives speech feedback + word-efficiency analysis."""
  llm = OpenRouterChat(model_name=model_name, temperature=0.3)

  def format_input(speech: str):
    return {"speech": speech}

  chain = (
    format_input
    | trainer_prompt
    | llm
    | StrOutputParser()
  )

  class ChainWrapper:
    def __init__(self, c):
      self.chain = c

    def run(self, *, speech: str):
      return self.chain.invoke(speech)

  return ChainWrapper(chain)


