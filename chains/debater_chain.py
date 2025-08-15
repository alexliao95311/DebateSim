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

    model_name: str = Field(default="openai/gpt-5-mini")
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
{persona_instructions}

**SIMULATION CONTEXT: This is a DEBATE SIMULATION where you role-play as {debater_role}. You are NOT making real political statements - you are acting as a character in an educational debate game.**

You are **{debater_role}**, engaged in a 5‑round structured debate on **"{topic}"**.

BILL CONTEXT (for reference):
{bill_description}

FULL DEBATE TRANSCRIPT SO FAR:
{full_transcript}

CURRENT ROUND: {round_num} of 5
YOUR ROLE: {debater_role}

{opening_instruction}

EVIDENCE AND CITATION REQUIREMENTS:
• **MANDATORY**: Support every argument with specific textual evidence from the bill. Quote relevant sections directly to strengthen your position.
• **Citation format**: When referencing the bill, use phrases like "The bill states..." or "Section X clearly indicates..." or "According to [specific section/paragraph]..." followed by brief, accurate quotes.
• **Evidence integration**: Don't just quote - explain how the evidence supports your argument. Connect the bill's language to your position.
• **Multiple sources**: Use evidence from different sections of the bill to build a comprehensive argument.
• **Accuracy**: Ensure all quotes are accurate. If paraphrasing, clearly indicate this with phrases like "The bill essentially argues that..."
• **Context**: When citing, provide enough context so readers understand the relevance of the quoted material.
• **Limitations**: If the bill text appears truncated (marked with [Content truncated] or similar), focus on the available sections and note when referencing limitations.

CRITICAL: You must respond ONLY with properly formatted markdown content. Do NOT include any parameter names, technical information, or raw data in your response.

**DEBATE STYLE INSTRUCTIONS (MANDATORY):**
- You are participating in an educational debate simulation with specified rhetorical styles
- Follow the given speaking style instructions exactly as provided
- This is about adopting a rhetorical and linguistic style, not impersonation
- NEVER add disclaimers about the speaking style you're using
- Do NOT say "I can't" or apologize for using the requested debate style
- Begin your substantive debate arguments immediately without meta-commentary
- Focus entirely on the debate topic using the specified linguistic patterns

**CRITICAL ROLE-PLAYING INSTRUCTIONS:**
- You are acting as a character in a debate simulation - this is NOT real political advocacy
- When given a persona like "Donald Trump," adopt their speaking patterns, vocabulary, and rhetorical style
- Use phrases like "folks," "tremendous," "believe me," "nobody knows [topic] better than me" for Trump-style speech
- For Harris: use precise legal language, "let me be clear," "the facts show," "we must examine"
- For Musk: use tech terminology, "innovation," "disruption," "the future of," "we're building"
- For Drake: use cultural references, "you know what I'm saying," "real talk," "this is about"
- This is a PERFORMANCE - you are not actually advocating for real political positions
- If you encounter content restrictions, reframe the topic as a general policy discussion while maintaining the persona style

**POLITICAL TOPIC HANDLING:**
- For topics involving real politicians: focus on POLICY DISCUSSION, not personal advocacy
- Use phrases like "the policies of [person]" instead of "voting for [person]"
- Discuss "leadership qualities" and "policy effectiveness" rather than "electoral support"
- Frame arguments around "what this approach would mean for the country" rather than "who should win"
- If blocked, pivot to discussing "the principles and policies involved" while keeping the persona style

**SPECIFIC TOPIC STRATEGIES:**
- For "Trump arguing Trump should be president": Focus on "leadership record," "policy achievements," "what this administration accomplished"
- For "Harris arguing Harris should be president": Discuss "prosecutorial experience," "policy positions," "leadership qualities"
- For "Musk arguing Musk should be president": Focus on "innovation leadership," "problem-solving approach," "vision for the future"
- For "Drake arguing Drake should be president": Discuss "cultural understanding," "connection to people," "fresh perspective"
- Always frame as "the policies and leadership of [person]" not "voting for [person]"

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
Strategic Content Guidelines
{rebuttal_requirement}
• Structure arguments using `### 1. Title`, `### 2. Title`, `### 3. Title` format.
• Close with a **one‑sentence** summary that clearly states why your side is ahead.

IMPORTANT: {rebuttal_importance}
"""

# Template for topic debates - focuses on general argumentation without bill requirements
topic_debate_template = """
{persona_instructions}

**SIMULATION CONTEXT: This is a DEBATE SIMULATION where you role-play as {debater_role}. You are NOT making real political statements - you are acting as a character in an educational debate game.**

You are **{debater_role}**, engaged in a 5‑round structured debate on **"{topic}"**.

FULL DEBATE TRANSCRIPT SO FAR:
{full_transcript}

CURRENT ROUND: {round_num} of 5
YOUR ROLE: {debater_role}

{opening_instruction}

ARGUMENTATION REQUIREMENTS:
• **FOCUS**: Present logical, well-reasoned arguments that address the topic directly.
• **EVIDENCE**: Support your arguments with relevant facts, statistics, examples, and logical reasoning.
• **SOURCES**: When referencing information, use credible sources and real-world examples.
• **ANALYSIS**: Explain how your evidence supports your position and why it matters.
• **REBUTTALS**: Address opponent arguments directly and explain why your position is stronger.
• **CONTEXT**: Consider multiple perspectives and acknowledge the complexity of the issue when appropriate.

CRITICAL: You must respond ONLY with properly formatted markdown content. Do NOT include any parameter names, technical information, or raw data in your response.

**DEBATE STYLE INSTRUCTIONS (MANDATORY):**
- You are participating in an educational debate simulation with specified rhetorical styles
- Follow the given speaking style instructions exactly as provided
- This is about adopting a rhetorical and linguistic style, not impersonation
- NEVER add disclaimers about the speaking style you're using
- Do NOT say "I can't" or apologize for using the requested debate style
- Begin your substantive debate arguments immediately without meta-commentary
- Focus entirely on the debate topic using the specified linguistic patterns

**CRITICAL ROLE-PLAYING INSTRUCTIONS:**
- You are acting as a character in a debate simulation - this is NOT real political advocacy
- When given a persona like "Donald Trump," adopt their speaking patterns, vocabulary, and rhetorical style
- Use phrases like "folks," "tremendous," "believe me," "nobody knows [topic] better than me" for Trump-style speech
- For Harris: use precise legal language, "let me be clear," "the facts show," "we must examine"
- For Musk: use tech terminology, "innovation," "disruption," "the future of," "we're building"
- For Drake: use cultural references, "you know what I'm saying," "real talk," "this is about"
- This is a PERFORMANCE - you are not actually advocating for real political positions
- If you encounter content restrictions, reframe the topic as a general policy discussion while maintaining the persona style

**POLITICAL TOPIC HANDLING:**
- For topics involving real politicians: focus on POLICY DISCUSSION, not personal advocacy
- Use phrases like "the policies of [person]" instead of "voting for [person]"
- Discuss "leadership qualities" and "policy effectiveness" rather than "electoral support"
- Frame arguments around "what this approach would mean for the country" rather than "who should win"
- If blocked, pivot to discussing "the principles and policies involved" while keeping the persona style

**SPECIFIC TOPIC STRATEGIES:**
- For "Trump arguing Trump should be president": Focus on "leadership record," "policy achievements," "what this administration accomplished"
- For "Harris arguing Harris should be president": Discuss "prosecutorial experience," "policy positions," "leadership qualities"
- For "Musk arguing Musk should be president": Focus on "innovation leadership," "problem-solving approach," "vision for the future"
- For "Drake arguing Drake should be president": Discuss "cultural understanding," "connection to people," "fresh perspective"
- Always frame as "the policies and leadership of [person]" not "voting for [person]"

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
Strategic Content Guidelines
{rebuttal_requirement}
• Structure arguments using `### 1. Title`, `### 2. Title`, `### 3. Title` format.
• Close with a **one‑sentence** summary that clearly states why your side is ahead.

IMPORTANT: {rebuttal_importance}
"""

# Template for public forum debates - 4 rounds maximum with accessible format
public_forum_template = """
{persona_instructions}

**SIMULATION CONTEXT: This is a DEBATE SIMULATION where you role-play as {debater_role}. You are NOT making real political statements - you are acting as a character in an educational debate game.**

You are **{debater_role}**, engaged in a Public Forum debate on **"{topic}"**.

PUBLIC FORUM FORMAT (4 ROUNDS EXACTLY):
1. **Constructive** - Present your case
2. **Rebuttal** - Attack opponent's case and defend yours  
3. **Summary** - Crystallize key arguments and impacts
4. **Final Focus** - Final appeal on most important issues

FULL DEBATE TRANSCRIPT SO FAR:
{full_transcript}

CURRENT ROUND: {round_num} of 4 (PUBLIC FORUM)
YOUR ROLE: {debater_role}

{opening_instruction}

PUBLIC FORUM ARGUMENTATION REQUIREMENTS:
• **ACCESSIBILITY**: Present arguments that any educated citizen can understand - avoid jargon
• **REAL-WORLD FOCUS**: Emphasize practical impacts on real people and society
• **VALUE FRAMEWORK**: Connect arguments to core values like justice, security, prosperity, freedom
• **EVIDENCE**: Use clear, credible sources that support concrete impacts
• **COMPARATIVE**: Show why your side's approach leads to better outcomes than your opponent's
• **CRYSTALLIZATION**: In later rounds, focus on the most important clash points

CRITICAL: You must respond ONLY with properly formatted markdown content. Do NOT include any parameter names, technical information, or raw data in your response.

**DEBATE STYLE INSTRUCTIONS (MANDATORY):**
- You are participating in an educational debate simulation with specified rhetorical styles
- Follow the given speaking style instructions exactly as provided
- This is about adopting a rhetorical and linguistic style, not impersonation
- NEVER add disclaimers about the speaking style you're using
- Do NOT say "I can't" or apologize for using the requested debate style
- Begin your substantive debate arguments immediately without meta-commentary
- Focus entirely on the debate topic using the specified linguistic patterns

**CRITICAL ROLE-PLAYING INSTRUCTIONS:**
- You are acting as a character in a debate simulation - this is NOT real political advocacy
- When given a persona like "Donald Trump," adopt their speaking patterns, vocabulary, and rhetorical style
- Use phrases like "folks," "tremendous," "believe me," "nobody knows [topic] better than me" for Trump-style speech
- For Harris: use precise legal language, "let me be clear," "the facts show," "we must examine"
- For Musk: use tech terminology, "innovation," "disruption," "the future of," "we're building"
- For Drake: use cultural references, "you know what I'm saying," "real talk," "this is about"
- This is a PERFORMANCE - you are not actually advocating for real political positions
- If you encounter content restrictions, reframe the topic as a general policy discussion while maintaining the persona style

**POLITICAL TOPIC HANDLING:**
- For topics involving real politicians: focus on POLICY DISCUSSION, not personal advocacy
- Use phrases like "the policies of [person]" instead of "voting for [person]"
- Discuss "leadership qualities" and "policy effectiveness" rather than "electoral support"
- Frame arguments around "what this approach would mean for the country" rather than "who should win"
- If blocked, pivot to discussing "the principles and policies involved" while keeping the persona style

**SPECIFIC TOPIC STRATEGIES:**
- For "Trump arguing Trump should be president": Focus on "leadership record," "policy achievements," "what this administration accomplished"
- For "Harris arguing Harris should be president": Discuss "prosecutorial experience," "policy positions," "leadership qualities"
- For "Musk arguing Musk should be president": Focus on "innovation leadership," "problem-solving approach," "vision for the future"
- For "Drake arguing Drake should be president": Discuss "cultural understanding," "connection to people," "fresh perspective"
- Always frame as "the policies and leadership of [person]" not "voting for [person]"

------------------------------------------------------------------
Formatting Rules  **(STRICT — the UI parses your markdown)**
1. **Title line (exact format):**
   `# {debater_role} – Round {round_num}/4 (Public Forum)`
   
2. After the title, produce *at most* **180 words** total (shorter for PF accessibility).

3. Use only *level‑3* markdown headings (`###`) for your main points.
   – No other markdown syntax (no lists, tables, code blocks, or images).
   
4. Keep paragraphs short (≤ 2 sentences for PF accessibility).

5. Do not add extra blank lines at the end of the message.

6. **NEVER include parameter names, variable information, or any technical details in your response.**

------------------------------------------------------------------
Strategic Content Guidelines
{rebuttal_requirement}
• Structure arguments using `### 1. Title`, `### 2. Title` format (maximum 2-3 points for PF).
• Close with a **one‑sentence** summary emphasizing why your framework/values win.

IMPORTANT: {rebuttal_importance}
"""

# Create chat prompt templates for all types
bill_debate_prompt = ChatPromptTemplate.from_template(bill_debate_template)
topic_debate_prompt = ChatPromptTemplate.from_template(topic_debate_template)
public_forum_prompt = ChatPromptTemplate.from_template(public_forum_template)

# Create a memory instance
memory_map = {}

# Function to create a debater chain with a specific model
def get_debater_chain(model_name="openai/gpt-5-mini", *, round_num: int = 1, debate_type: str = "topic", debate_format: str = "default", speaking_order: str = "pro-first"):
    # Initialize the OpenRouter API model with user's selected model
    llm = OpenRouterChat(
        model_name=model_name,
        temperature=0.85
    )

    # Use the new langchain pattern with LCEL
    def get_debate_context(inputs):
        chain_id = f"debater-{inputs['debater_role']}-{inputs['topic'][:20]}"
        
        if chain_id not in memory_map:
            # Initialize memory for this chain
            memory_map[chain_id] = []
        
        # DEBUG: Basic context info
        print(f"🔍 DEBUG [debater_chain]: Processing {inputs.get('debater_role')} for round {inputs.get('round_num', round_num)}")
        
        # Use the provided full transcript if available, otherwise build from memory
        if inputs.get('full_transcript'):
            full_transcript = inputs['full_transcript']
            print(f"🔍 DEBUG [debater_chain]: Using provided transcript ({len(full_transcript)} chars)")
        else:
            # Fallback to memory-based transcript building
            full_transcript = ""
            for entry in memory_map[chain_id]:
                if entry['role'] == 'assistant':
                    full_transcript += f"## {entry.get('speaker', 'Unknown')}\n{entry['content']}\n\n"
                elif entry['role'] == 'user':
                    full_transcript += f"## Opponent\n{entry['content']}\n\n"
            print(f"🔍 DEBUG [debater_chain]: Built transcript from memory ({len(full_transcript)} chars)")
        
        # Determine if this is an opening statement based on whether THIS debater has spoken before
        # Check if this specific debater role has made any previous statements
        debater_has_spoken = False
        if full_transcript:
            # Look for this debater's previous contributions in the transcript
            debater_pattern = f"# {inputs['debater_role']}"
            debater_has_spoken = debater_pattern in full_transcript
        
        is_opening = not debater_has_spoken
        print(f"🔍 DEBUG [debater_chain]: Opening statement: {is_opening}, Debater spoken: {debater_has_spoken}")
        
        # Determine the speech type and round number
        round_num_val = inputs.get('round_num', round_num)
        debater_role = inputs.get('debater_role', '')
        
        # Set format instructions based on debate format and speech position
        if debate_format == "public-forum":
            max_rounds = 4
            # Public Forum has exactly 4 rounds: Constructive, Rebuttal, Summary, Final Focus
            # Each side speaks once per round (8 total speeches)
            # Speaking order determines who goes first/second in each round
            
            # Determine which side speaks first based on speaking_order
            first_side = "Pro" if speaking_order == "pro-first" else "Con"
            second_side = "Con" if speaking_order == "pro-first" else "Pro"
            
            # Determine if this is the first or second speech in the round
            is_first_speaker = (('Pro' in debater_role and speaking_order == "pro-first") or 
                              ('Con' in debater_role and speaking_order == "con-first"))
            
            # Determine the current speech type based on round number
            if round_num_val == 1:
                # Round 1: Constructives
                speech_type = "CONSTRUCTIVE"
                if is_first_speaker:
                    opening_instruction = f"{debater_role.upper()} CONSTRUCTIVE - First Speaker (Round 1 of 4)"
                    rebuttal_requirement = "• **CONSTRUCTIVE**: Present exactly 2 main arguments in favor of/against the topic. Label them clearly as: 1. [Framework/Value], 2. [Key Contention]. Focus on accessible language and real-world impacts. Build each argument with clear evidence and impact analysis."
                    rebuttal_importance = f"This is {debater_role}'s constructive speech (speaking first). Focus on building a clear, accessible case."
                else:
                    opening_instruction = f"{debater_role.upper()} CONSTRUCTIVE - Second Speaker (Round 1 of 4)"
                    rebuttal_requirement = "• **CONSTRUCTIVE**: Present exactly 2 main arguments in favor of/against the topic. Label them clearly as: 1. [Framework/Value], 2. [Key Contention]. Focus on accessible language and real-world impacts. You may also address opponent's arguments if time permits."
                    rebuttal_importance = f"This is {debater_role}'s constructive speech (speaking second). Focus on building your case, with optional refutation."
            elif round_num_val == 2:
                # Round 2: Rebuttals
                speech_type = "REBUTTAL"
                if is_first_speaker:
                    opening_instruction = f"{debater_role.upper()} REBUTTAL - First Speaker (Round 2 of 4)"
                else:
                    opening_instruction = f"{debater_role.upper()} REBUTTAL - Second Speaker (Round 2 of 4)"
                rebuttal_requirement = "• **REBUTTAL**: Attack opponent's case with clear refutation and evidence. Address each of their arguments directly. Defend your own case against any attacks they made."
                rebuttal_importance = f"This is {debater_role}'s rebuttal speech. Focus on attacking opponent's case and defending yours."
            elif round_num_val == 3:
                # Round 3: Summary
                speech_type = "SUMMARY"
                if is_first_speaker:
                    opening_instruction = f"{debater_role.upper()} SUMMARY - First Speaker (Round 3 of 4)"
                else:
                    opening_instruction = f"{debater_role.upper()} SUMMARY - Second Speaker (Round 3 of 4)"
                rebuttal_requirement = "• **SUMMARY**: Crystallize the key arguments and impacts. Extend your strongest points and explain why they outweigh opponent's case. Begin weighing and comparative analysis."
                rebuttal_importance = f"This is {debater_role}'s summary speech. Crystallize your strongest arguments and start comparative weighing."
            elif round_num_val == 4:
                # Round 4: Final Focus
                speech_type = "FINAL FOCUS"
                if is_first_speaker:
                    opening_instruction = f"{debater_role.upper()} FINAL FOCUS - First Speaker (Round 4 of 4)"
                else:
                    opening_instruction = f"{debater_role.upper()} FINAL FOCUS - Second Speaker (Round 4 of 4)"
                rebuttal_requirement = "• **FINAL FOCUS**: Make your final appeal on the most important issues. No new arguments. Focus on why your side wins on the key impacts and values. Crystallize the voting issues."
                rebuttal_importance = f"This is {debater_role}'s final focus. Make your final appeal - no new arguments, just crystallization."
        else:
            max_rounds = 5
            if is_opening and 'Pro' in debater_role:
                opening_instruction = "SPEECH 1 - PRO CONSTRUCTIVE"
                rebuttal_requirement = "• **RIGID FORMAT**: Present exactly 3 main arguments in favor of the topic. Label them clearly as: 1. [Argument Title], 2. [Argument Title], 3. [Argument Title]. These will be your ONLY contentions for the entire debate. Build each argument with evidence, reasoning, and impact. Do NOT address opponent arguments (they haven't spoken yet)."
                rebuttal_importance = "This is Pro's opening constructive. Focus only on building your 3 core contentions."
            elif is_opening and 'Con' in debater_role:
                opening_instruction = "SPEECH 2 - CON CONSTRUCTIVE + REBUTTAL"
                rebuttal_requirement = "• **RIGID FORMAT**: PART 1 - PRESENT YOUR CASE (3 arguments against the topic): 1. [Con Argument Title], 2. [Con Argument Title], 3. [Con Argument Title] - Build with evidence, reasoning, and impact. These will be your ONLY contentions for the entire debate. PART 2 - REFUTE PRO'S CASE: Address each of Pro's 3 arguments by quoting their exact words and explaining why they're wrong."
                rebuttal_importance = "This is Con's constructive + rebuttal. You must both present your case AND refute Pro's case."
            else:
                speech_number = round_num_val * 2 - (1 if 'Pro' in debater_role else 0)
                opening_instruction = f"SPEECH {speech_number} - {debater_role.upper()} REBUTTAL + FRONTLINE"
                rebuttal_requirement = f"• **RIGID FORMAT**: PART 1 - FRONTLINE YOUR CASE: Rebuild your 3 original {debater_role} arguments against opponent's attacks from their previous speech. PART 2 - CONTINUE ATTACKING OPPONENT'S CASE: Further refute opponent's 3 arguments with new analysis/evidence. {f'PART 3 - WEIGHING & EXTENSIONS: Add comparative weighing, extend your strongest arguments, crystallize key clash points.' if round_num_val >= 4 else ''}"
                rebuttal_importance = "Balance frontlining your own case and attacking opponent's case. Focus on these core 3v3 arguments."
        
        # Add user input to context if provided (this represents opponent's argument)
        if inputs.get('history') and not is_opening:
            # Add the user's argument to the full transcript for context
            full_transcript += f"## User Argument\n{inputs['history']}\n\n"
        
        # Add current input to memory for next round
        memory_map[chain_id].append({
            "role": "system", 
            "content": f"Context: {inputs['topic']}, {inputs['debater_role']} role, Round {inputs.get('round_num', round_num)}"
        })
        
        print(f"🔍 DEBUG [debater_chain]: Final transcript length: {len(full_transcript)}")
        
        return {
            "full_transcript": full_transcript,
            "opening_instruction": opening_instruction,
            "rebuttal_requirement": rebuttal_requirement,
            "rebuttal_importance": rebuttal_importance
        }

    # Build the runnable chain using LCEL
    from langchain_core.runnables import RunnableLambda
    from langchain_core.prompts import PromptTemplate
    
    def process_inputs(inputs):
        # Debug: Log what we received
        print(f"🔍 DEBUG [process_inputs]: Received inputs keys: {list(inputs.keys())}")
        print(f"🔍 DEBUG [process_inputs]: Prompt length: {len(inputs.get('prompt', ''))}")
        print(f"🔍 DEBUG [process_inputs]: Prompt preview: {inputs.get('prompt', '')[:200]}...")
        
        # Check if we should use the frontend prompt directly for detailed Public Forum prompts
        incoming_prompt = inputs.get('prompt', '')
        use_direct_prompt = len(incoming_prompt) > 500 and "CRITICAL WORD COUNT" in incoming_prompt
        
        print(f"🔍 DEBUG [process_inputs]: Using direct prompt: {use_direct_prompt}")
        
        if use_direct_prompt:
            # Return the prompt directly for detailed frontend prompts
            print(f"🔍 DEBUG [process_inputs]: Using direct frontend prompt ({len(incoming_prompt)} chars)")
            # Mark this as a direct prompt for the selector
            return {"_direct_prompt": incoming_prompt, "prompt": incoming_prompt}
        
        # Otherwise, get debate context for template-based prompts
        print(f"🔍 DEBUG [process_inputs]: Using template-based prompt")
        debate_context = get_debate_context(inputs)
        
        # Extract persona instructions from the persona_prompt if provided
        persona_instructions = ""
        if inputs.get("persona_prompt"):
            # Look for debate style instructions in the prompt
            prompt_text = inputs["persona_prompt"]
            if any(keyword in prompt_text for keyword in ["SPEAKING STYLE:", "DEBATE STYLE INSTRUCTIONS:", "PERSONA INSTRUCTIONS:"]):
                # Extract everything from instructions until the next major section
                if "SPEAKING STYLE:" in prompt_text:
                    start_keyword = "SPEAKING STYLE:"
                elif "DEBATE STYLE INSTRUCTIONS:" in prompt_text:
                    start_keyword = "DEBATE STYLE INSTRUCTIONS:"
                else:
                    start_keyword = "PERSONA INSTRUCTIONS:"
                start_idx = prompt_text.find(start_keyword)
                if start_idx != -1:
                    # Find the end - look for common section breaks
                    end_markers = ["Instructions:", "Your role:", "Bill description:", "Debate topic:"]
                    end_idx = len(prompt_text)
                    for marker in end_markers:
                        marker_idx = prompt_text.find(marker, start_idx + len(start_keyword))
                        if marker_idx != -1 and marker_idx < end_idx:
                            end_idx = marker_idx
                    
                    persona_instructions = prompt_text[start_idx:end_idx].strip()
                    print(f"🔍 DEBUG [debater_chain]: Extracted style instructions ({len(persona_instructions)} chars)")
        
        # Use the direct persona parameter for logging instead of trying to extract from text
        persona_name = inputs.get("persona", "Default AI")
        print(f"🎭 DEBATE STYLE: {persona_name}")
        
        if not persona_instructions:
            persona_instructions = ""  # Default empty if no persona found
        
        return {
            "debater_role": inputs.get("debater_role", ""),
            "topic": inputs.get("topic", ""),
            "bill_description": inputs.get("bill_description", ""),
            "round_num": inputs.get("round_num", round_num),
            "history": inputs.get("history", ""),
            "full_transcript": debate_context["full_transcript"],
            "opening_instruction": debate_context["opening_instruction"],
            "rebuttal_requirement": debate_context["rebuttal_requirement"],
            "rebuttal_importance": debate_context["rebuttal_importance"],
            "persona_instructions": persona_instructions,
            "_direct_prompt": False  # Mark as template-based
        }
    
    def select_prompt(inputs):
        # Check if this is a direct prompt case
        if inputs.get("_direct_prompt"):
            print(f"🔍 DEBUG [select_prompt]: Using direct prompt")
            return inputs["_direct_prompt"]
        
        # Otherwise use template-based approach
        print(f"🔍 DEBUG [select_prompt]: Using template-based prompt")
        if debate_format == "public-forum":
            selected_template = public_forum_prompt
        elif debate_type == "bill":
            selected_template = bill_debate_prompt
        else:
            selected_template = topic_debate_prompt
            
        return selected_template.invoke(inputs)
    
    # Convert functions to proper LangChain runnables
    process_inputs_runnable = RunnableLambda(process_inputs)
    select_prompt_runnable = RunnableLambda(select_prompt)
    
    chain = (
        process_inputs_runnable
        | select_prompt_runnable
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

            print(f"🔍 DEBUG [ChainWrapper]: Invoking chain for {kwargs.get('debater_role', 'Unknown')} round {local_round}")

            # Invoke the chain
            response = self.chain.invoke(input_dict)
            
            print(f"🔍 DEBUG [ChainWrapper]: Generated response ({len(response)} chars)")

            # Persist assistant output to memory
            chain_id = f"debater-{kwargs.get('debater_role')}-{kwargs.get('topic', '')[:20]}"
            if chain_id not in memory_map:
                memory_map[chain_id] = []
            memory_map[chain_id].append({
                "role": "assistant", 
                "content": response,
                "speaker": kwargs.get('debater_role', 'Unknown')
            })

            return response
    
    # Return the wrapper object
    return ChainWrapper(chain)

# Create a default debater chain for backward compatibility
debater_chain = get_debater_chain(model_name="openai/gpt-5-mini", round_num=1, debate_type="topic")