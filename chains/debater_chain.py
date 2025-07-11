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
import re
from dotenv import load_dotenv
load_dotenv()

API_KEY = os.getenv("OPENROUTER_API_KEY")
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
        # If the string already contains a provider prefix, return as is
        if "/" in name:
            return name

        # Heuristic inference – extend this map as you add more providers.
        provider_map = {
            "deepseek": "deepseek",
            "openai": "openai",
            "google": "google",
            "mistral": "mistralai",
            "meta": "meta",
        }
        root_token = name.split("-", 1)[0]  # e.g. "deepseek" from "deepseek-prover-v2:free"
        provider = provider_map.get(root_token)
        if provider:
            return f"{provider}/{name}"

        # Fall‑back: return the original string unchanged.
        return name

    model_name: str = Field(default="openai/gpt-4o")
    temperature: float = Field(default=0.7)
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
        }
        
        if stop:
            payload["stop"] = stop
        
        # Synchronous call to OpenRouter API
        import requests
        response = requests.post(self.api_base, headers=headers, json=payload)
        
        if response.status_code != 200:
            error_detail = response.json().get("error", {}).get("message", "Unknown error")
            raise ValueError(f"OpenRouter API error: {response.status_code} - {error_detail}")
        
        result = response.json()
        assistant_message = result["choices"][0]["message"]["content"]
        
        # Convert the assistant text into LangChain's ChatResult/ChatGeneration structure
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
        }
        
        if stop:
            payload["stop"] = stop
        
        # Use aiohttp for async API calls
        async with aiohttp.ClientSession() as session:
            async with session.post(self.api_base, headers=headers, json=payload) as response:
                if response.status != 200:
                    try:
                        error_data = await response.json()
                        error_detail = error_data.get("error", {}).get("message", "Unknown error")
                    except:
                        error_detail = await response.text()
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

# --- Prompt templates ----------------------------------------------------

# Template for bill debates - includes evidence requirements
bill_debate_template = """
You are **{debater_role}**, engaged in a 5‑round public‑forum style debate on **"{topic}"**.

BILL CONTEXT (for reference):
{bill_description}

EVIDENCE AND CITATION REQUIREMENTS:
• **MANDATORY**: Support every argument with specific textual evidence from the bill. Quote relevant sections directly to strengthen your position.
• **Citation format**: When referencing the bill, use phrases like "The bill states..." or "Section X clearly indicates..." or "According to [specific section/paragraph]..." followed by brief, accurate quotes.
• **Evidence integration**: Don't just quote - explain how the evidence supports your argument. Connect the bill's language to your position.
• **Multiple sources**: Use evidence from different sections of the bill to build a comprehensive argument.
• **Accuracy**: Ensure all quotes are accurate. If paraphrasing, clearly indicate this with phrases like "The bill essentially argues that..."
• **Context**: When citing, provide enough context so readers understand the relevance of the quoted material.
• **Limitations**: If the bill text appears truncated (marked with [Content truncated] or similar), focus on the available sections and note when referencing limitations.

CRITICAL: You must respond ONLY with properly formatted markdown content. Do NOT include any parameter names, technical information, or raw data in your response.

------------------------------------------------------------------
Formatting Rules  **(STRICT — the UI parses your markdown)**
1. **Title line (exact format):**
   `# {debater_role} – Round {round_num}/5`
   
2. After the title, produce *at most* **200 words** total.

3. Use only *level‑3* markdown headings (`###`) for your main points.
   – No other markdown syntax (no lists, tables, code blocks, or images).
   
4. Keep paragraphs short (≤ 3 sentences).

5. Do not add extra blank lines at the end of the message.

6. **NEVER include parameter names, variable information, or any technical details in your response.**

------------------------------------------------------------------
Content Guidelines
• **REBUTTAL RULES**: Only include a rebuttal if the history section below contains actual opponent arguments. If the history is empty or contains no opponent arguments, start directly with your main arguments.
• Present **up to three** main arguments using `### 1. Title`, `### 2. Title`, `### 3. Title` format.
• Close with a **one‑sentence** summary that clearly states why your side is ahead.

Previous opponent argument (for context only):  
{history}

IMPORTANT: If the history section above is empty or contains no opponent arguments, do NOT include any rebuttal. Start directly with your main arguments. Only rebut if there are actual opponent arguments to respond to.
"""

# Template for topic debates - focuses on general argumentation without bill requirements
topic_debate_template = """
You are **{debater_role}**, engaged in a 5‑round public‑forum style debate on **"{topic}"**.

ARGUMENTATION REQUIREMENTS:
• **FOCUS**: Present logical, well-reasoned arguments that address the topic directly.
• **EVIDENCE**: Support your arguments with relevant facts, statistics, examples, and logical reasoning.
• **SOURCES**: When referencing information, use credible sources and real-world examples.
• **ANALYSIS**: Explain how your evidence supports your position and why it matters.
• **REBUTTALS**: Address opponent arguments directly and explain why your position is stronger.
• **CONTEXT**: Consider multiple perspectives and acknowledge the complexity of the issue when appropriate.

CRITICAL: You must respond ONLY with properly formatted markdown content. Do NOT include any parameter names, technical information, or raw data in your response.

------------------------------------------------------------------
Formatting Rules  **(STRICT — the UI parses your markdown)**
1. **Title line (exact format):**
   `# {debater_role} – Round {round_num}/5`
   
2. After the title, produce *at most* **200 words** total.

3. Use only *level‑3* markdown headings (`###`) for your main points.
   – No other markdown syntax (no lists, tables, code blocks, or images).
   
4. Keep paragraphs short (≤ 3 sentences).

5. Do not add extra blank lines at the end of the message.

6. **NEVER include parameter names, variable information, or any technical details in your response.**

------------------------------------------------------------------
Content Guidelines
• **REBUTTAL RULES**: Only include a rebuttal if the history section below contains actual opponent arguments. If the history is empty or contains no opponent arguments, start directly with your main arguments.
• Present **up to three** main arguments using `### 1. Title`, `### 2. Title`, `### 3. Title` format.
• Close with a **one‑sentence** summary that clearly states why your side is ahead.

Previous opponent argument (for context only):  
{history}

IMPORTANT: If the history section above is empty or contains no opponent arguments, do NOT include any rebuttal. Start directly with your main arguments. Only rebut if there are actual opponent arguments to respond to.
"""

# Create chat prompt templates for both types
bill_debate_prompt = ChatPromptTemplate.from_template(bill_debate_template)
topic_debate_prompt = ChatPromptTemplate.from_template(topic_debate_template)

# Create a memory instance
memory_map = {}

# Function to create a debater chain with a specific model
def get_debater_chain(model_name="openai/gpt-4o", *, round_num: int = 1, debate_type: str = "topic"):
    # Initialize the OpenRouter API model with user's selected model
    llm = OpenRouterChat(
        model_name=model_name,
        temperature=0.7
    )

    # Use the new langchain pattern with LCEL
    def get_history(inputs):
        chain_id = f"debater-{inputs['debater_role']}-{inputs['topic'][:20]}"
        
        if chain_id not in memory_map:
            # Initialize memory for this chain
            memory_map[chain_id] = []
            
        if 'history' in inputs and inputs['history']:
            # Add the history to memory
            memory_map[chain_id].append({"role": "user", "content": inputs['history']})
        
        # Return the memory formatted as a string
        history_str = ""
        for entry in memory_map[chain_id]:
            history_str += f"{entry['role']}: {entry['content']}\n\n"
            
        # Update memory with current input
        memory_map[chain_id].append({"role": "system", "content": f"Context: {inputs['topic']}, {inputs['debater_role']} role"})
        
        return history_str

    # Select the appropriate prompt template based on debate type
    selected_prompt = bill_debate_prompt if debate_type == "bill" else topic_debate_prompt
    
    # Build the runnable chain using LCEL
    chain = (
        {
            "debater_role": lambda inputs: inputs.get("debater_role", ""),
            "topic": lambda inputs: inputs.get("topic", ""),
            "bill_description": lambda inputs: inputs.get("bill_description", ""),
            "history": lambda inputs: inputs.get("history", ""),
            "round_num": lambda inputs: inputs.get("round_num", round_num),
        }
        | selected_prompt
        | llm
        | StrOutputParser()
    )
    
    # Create a wrapper object with run method to match the old API
    class ChainWrapper:
        def __init__(self, chain_func):
            self.chain = chain_func

        def run(self, **kwargs):
            """
            Execute the LCEL chain. We must pass **one positional dict** to
            `invoke()`, so we assemble that here from the kwargs. The caller may
            specify `round_num`; otherwise we fall back to the default captured
            in the closure.
            """
            local_round = kwargs.get("round_num", round_num)
            input_dict = dict(kwargs)
            input_dict["round_num"] = local_round

            # Invoke the chain
            response = self.chain.invoke(input_dict)

            # Persist assistant output to memory
            chain_id = f"debater-{kwargs.get('debater_role')}-{kwargs.get('topic', '')[:20]}"
            if chain_id not in memory_map:
                memory_map[chain_id] = []
            memory_map[chain_id].append({"role": "assistant", "content": response})

            return response
    
    # Return the wrapper object
    return ChainWrapper(chain)

# Create a default debater chain for backward compatibility
debater_chain = get_debater_chain(model_name="openai/gpt-4o", round_num=1, debate_type="topic")