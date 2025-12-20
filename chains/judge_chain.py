from langchain_core.language_models import BaseChatModel
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.outputs import ChatGeneration, ChatResult
from typing import List, Dict, Any, Mapping, Optional, ClassVar
from pydantic import Field
import os
import json
import aiohttp
import asyncio
import re
from dotenv import load_dotenv
load_dotenv(override=True)  # Force reload even if already loaded

API_KEY = os.getenv("OPENROUTER_API_KEY")
print(f"[JUDGE_CHAIN] Using API key: ...{API_KEY[-10:] if API_KEY else 'None'}")

# Global semaphore to limit concurrent OpenRouter API calls
# This prevents credit exhaustion from too many parallel requests
# Set to 2 to work with expensive models like Claude 3.5 Sonnet
_openrouter_semaphore = asyncio.Semaphore(2)
if not API_KEY:
    raise ValueError("Please set OPENROUTER_API_KEY before starting.")

# No response cleaning needed for standard models

# Create a custom OpenRouter chat model class that doesn't rely on OpenAI internals
class OpenRouterChat(BaseChatModel):
    """Custom LangChain chat model for OpenRouter API."""
    
    # --- Helper -----------------------------------------------------------
    def _ensure_full_model_name(self, name: str) -> str:
        """
        Guarantee that the provider prefix (e.g. ``deepseek/``) is present.

        OpenRouter expects model identifiers in the form ``provider/model-id``.
        If the caller accidentally supplies just ``model-id`` (without the
        provider), we try to infer it from the model-id's leading token and
        prepend the correct provider so the request does not break.
        """
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
    temperature: float = Field(default=0.5)
    api_key: str = Field(default=API_KEY)
    api_base: str = Field(default="https://openrouter.ai/api/v1/chat/completions")
    
    class Config:
        arbitrary_types_allowed = True
    
    def _generate(self, messages: List[Any], stop: Optional[List[str]] = None, **kwargs):
        """Generate a chat response using OpenRouter API."""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://debatesim.app",  # Use your actual site here
        }
        
        # Convert LangChain messages to OpenRouter format
        formatted_messages = []
        for message in messages:
            if isinstance(message, SystemMessage):
                formatted_messages.append({"role": "system", "content": message.content})
            elif isinstance(message, HumanMessage):
                formatted_messages.append({"role": "user", "content": message.content})
            elif isinstance(message, AIMessage):
                formatted_messages.append({"role": "assistant", "content": message.content})
            else:
                # Handle any other types of messages
                formatted_messages.append({"role": "user", "content": str(message)})
        
        payload = {
            "model": self._ensure_full_model_name(self.model_name),
            "messages": formatted_messages,
            "temperature": self.temperature,
            "max_tokens": 1200,  # Restored - original key supports longer prompts
        }

        if stop:
            payload["stop"] = stop

        # Synchronous call to OpenRouter API
        import requests
        response = requests.post(self.api_base, headers=headers, json=payload)

        if response.status_code != 200:
            error_detail = response.json().get("error", {}).get("message", "Unknown error")
            if response.status_code == 402:
                raise ValueError(
                    f"OpenRouter API 402 - Insufficient Credits: {error_detail}\n\n"
                    "This usually means:\n"
                    "1. Your API key has run out of credits\n"
                    "2. Multiple concurrent requests are reserving too many tokens\n"
                    "3. The max_tokens setting is too high for your remaining balance\n\n"
                    "Solutions:\n"
                    "- Add more credits to your OpenRouter account\n"
                    "- Reduce the number of concurrent debates\n"
                    "- Wait a few seconds for pending requests to complete"
                )
            raise ValueError(f"OpenRouter API error: {response.status_code} - {error_detail}")
        
        result = response.json()
        assistant_message = result["choices"][0]["message"]["content"]
        
        return ChatResult(
            generations=[
                ChatGeneration(
                    message=AIMessage(content=assistant_message)
                )
            ]
        )
    
    async def _agenerate(self, messages: List[Any], stop: Optional[List[str]] = None, **kwargs):
        """Async version of _generate for OpenRouter API."""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://debatesim.app",  # Use your actual site here
        }
        
        # Convert LangChain messages to OpenRouter format
        formatted_messages = []
        for message in messages:
            if isinstance(message, SystemMessage):
                formatted_messages.append({"role": "system", "content": message.content})
            elif isinstance(message, HumanMessage):
                formatted_messages.append({"role": "user", "content": message.content})
            elif isinstance(message, AIMessage):
                formatted_messages.append({"role": "assistant", "content": message.content})
            else:
                # Handle any other types of messages
                formatted_messages.append({"role": "user", "content": str(message)})
        
        payload = {
            "model": self._ensure_full_model_name(self.model_name),
            "messages": formatted_messages,
            "temperature": self.temperature,
            "max_tokens": 1200,  # Restored - original key supports longer prompts
        }

        if stop:
            payload["stop"] = stop

        # Use aiohttp for async API calls with semaphore to limit concurrency
        async with _openrouter_semaphore:
            async with aiohttp.ClientSession() as session:
                async with session.post(self.api_base, headers=headers, json=payload) as response:
                    if response.status != 200:
                        try:
                            error_data = await response.json()
                            error_detail = error_data.get("error", {}).get("message", "Unknown error")
                        except:
                            error_detail = await response.text()

                        if response.status == 402:
                            raise ValueError(
                                f"OpenRouter API 402 - Insufficient Credits: {error_detail}\n\n"
                                "This usually means:\n"
                                "1. Your API key has run out of credits\n"
                                "2. Multiple concurrent requests are reserving too many tokens\n"
                                "3. The max_tokens setting is too high for your remaining balance\n\n"
                                "Solutions:\n"
                                "- Add more credits to your OpenRouter account\n"
                                "- Reduce the number of concurrent debates\n"
                                "- Wait a few seconds for pending requests to complete"
                            )
                        raise ValueError(f"OpenRouter API error: {response.status} - {error_detail}")

                    result = await response.json()
                    assistant_message = result["choices"][0]["message"]["content"]

        return ChatResult(
            generations=[
                ChatGeneration(
                    message=AIMessage(content=assistant_message)
                )
            ]
        )
    
    # Required LangChain methods
    @property
    def _llm_type(self) -> str:
        return "openrouter-chat"

    @property
    def _identifying_params(self) -> Mapping[str, Any]:
        return {
            "model_name": self._ensure_full_model_name(self.model_name),
            "temperature": self.temperature,
        }

# Helper function to get language instructions for prompts
def get_language_instructions(language_code: str) -> str:
    """Generate language-specific instructions for judge prompts."""
    if language_code == 'zh':
        return """
**LANGUAGE REQUIREMENT:**
- You MUST respond entirely in Mandarin Chinese (中文).
- All your evaluation, feedback, and decision must be written in Chinese.
- Use proper Chinese grammar, vocabulary, and sentence structure.
- Maintain the same evaluation quality and depth as you would in English.
- If you reference English terms or proper nouns, you may include them in parentheses for clarity, but the main content must be in Chinese.

**IMPORTANT - JUDGING CRITERIA LABELS (Use Chinese translations):**
When referencing judging criteria, use these Chinese translations:
- "Argument Strength" → "论据强度"
- "Evidence Quality" → "证据质量"
- "Rebuttals" → "反驳"
- "Rhetorical Effectiveness" → "修辞效果"
- "Bias Neutrality" → "偏见中立性"
- "Framework Analysis" → "框架分析"
- "Logical Structure" → "逻辑结构"
- "Philosophical Depth" → "哲学深度"
- "Comparative Weighing" → "比较权衡"
- "Clash Resolution" → "冲突解决"
- "Crystallization" → "结晶化"
- "Speaker Points" → "发言者得分"
"""
    return ''  # No language instructions needed for English

# New standardized judge prompt
JUDGE_PROMPT = """
You are an AI judge evaluating a debate round. Follow these judging standards:

1. Evaluate **only** what was actually said in the round.
   - Do NOT fill in missing links, assume arguments, or interpret unstated logic.

2. Decision structure:
   - Begin with a **clear, concise decision at the top** ("Decision: Affirmative wins" or "Decision: Negative wins").
   - Follow with a structured justification explaining why — referencing specific arguments and comparative weighing.

3. Feedback:
   - Provide **critical and actionable** feedback for both debaters.
   - Highlight what each did well, what they could improve, and how to better execute strategy or weighing next time.
   - Be concrete, not generic.

Maintain objectivity, depth, and clarity throughout your evaluation.
"""

# Define the template for the judge
template = """{judge_prompt}

{language_instructions}

DEBATE TRANSCRIPT:
{transcript}

STANDARD DEBATE JUDGING CRITERIA:
- **Argument Strength**: Logical, well-reasoned arguments
- **Evidence Quality**: Facts, statistics, examples, reasoning
- **Rebuttals**: Directly addressing opponent arguments
- **Rhetorical Effectiveness**: Persuasive delivery and style
- **Bias Neutrality**: Objective, fair analysis

Please provide your judgement with the following sections:
1. Summary of Main Arguments from both sides
2. Strengths and Weaknesses Analysis for each debater
3. Decision on who won the debate with reasoning

Format your response with clear headings using markdown (###).
"""

# Define the Lincoln-Douglas specific judge template
ld_judge_template = """{judge_prompt}

{language_instructions}

You are an expert Lincoln-Douglas debate judge with deep knowledge of philosophical argumentation, ethical frameworks, and LD debate theory.

DEBATE TRANSCRIPT:
{transcript}

LINCOLN-DOUGLAS JUDGING CRITERIA:
- **Framework Analysis**: Evaluate the value premises, value criteria, and how well debaters uphold their frameworks
- **Logical Structure**: Assess syllogistic reasoning, argument construction, and logical consistency
- **Philosophical Depth**: Consider ethical principles, moral reasoning, and philosophical sophistication
- **Comparative Weighing**: Judge which framework better achieves the stated values and why
- **Evidence Quality**: Evaluate philosophical arguments, ethical principles, and real-world examples
- **Clash Resolution**: Determine which side better addressed opponent arguments and won key clashes
- **Crystallization**: Assess how well each side crystallized voting issues and made final appeals

Please provide your judgement with the following sections:
1. **Framework Analysis**: Evaluate each debater's value premise, criterion, and framework consistency
2. **Argument Quality**: Assess logical structure, philosophical depth, and evidence quality for both sides
3. **Clash Resolution**: Analyze how well each side addressed opponent arguments and won key debates
4. **Comparative Weighing**: Determine which framework better achieves the stated values and why
5. **Decision**: Who won the debate and why, with specific reference to LD criteria
6. **Speaker Points**: Award points (26-30) based on argument quality, clarity, and strategic execution

Format your response with clear headings using markdown (###).
"""

# Create the chat prompt templates
chat_prompt = ChatPromptTemplate.from_template(template)
ld_judge_prompt = ChatPromptTemplate.from_template(ld_judge_template)

# Function to get a judge chain with a specific model
def get_judge_chain(model_name="openai/gpt-4o-mini", debate_format="default", language="en"):
    # Initialize the OpenRouter API model with user's selected model
    llm = OpenRouterChat(
        model_name=model_name,
        temperature=0.5
    )
    
    # Get language instructions
    language_instructions = get_language_instructions(language)
    
    # Select the appropriate template based on debate format
    if debate_format == "lincoln-douglas":
        selected_prompt = ld_judge_prompt
    else:
        selected_prompt = chat_prompt
    
    # Build the runnable chain using LCEL
    def format_prompt(transcript):
        return {
            "transcript": transcript, 
            "judge_prompt": JUDGE_PROMPT,
            "language_instructions": language_instructions
        }
    
    chain = (
        format_prompt
        | selected_prompt
        | llm
        | StrOutputParser()
    )
    
    # Create a wrapper class with run method to match the old API
    class ChainWrapper:
        def __init__(self, chain_func):
            self.chain = chain_func
            
        def run(self, **kwargs):
            """
            LangChain Runnable chains created with a mapping like
            ``{"transcript": RunnablePassthrough()}`` expect **one positional
            input** (the transcript string). Passing keyword args through to
            ``invoke`` therefore triggers ``missing 1 required positional
            argument: 'input'``.

            We accept exactly one keyword—grab its value and forward it as the
            single positional argument.
            """
            if len(kwargs) != 1:
                raise ValueError(
                    "judge_chain.run() expects exactly one argument (e.g. "
                    "`transcript=<str>`)."
                )
            # Extract the sole provided value
            (inp,) = kwargs.values()
            return self.chain.invoke(inp)

        async def arun(self, **kwargs):
            """
            Async version of run() - execute the judge chain asynchronously.
            This allows multiple judge evaluations to run concurrently without blocking.
            """
            if len(kwargs) != 1:
                raise ValueError(
                    "judge_chain.arun() expects exactly one argument (e.g. "
                    "`transcript=<str>`)."
                )
            # Extract the sole provided value
            (inp,) = kwargs.values()
            return await self.chain.ainvoke(inp)
    
    # Return the wrapper object
    return ChainWrapper(chain)

# Create a default judge chain for backward compatibility
judge_chain = get_judge_chain()