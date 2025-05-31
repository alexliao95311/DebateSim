from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser
import os
from dotenv import load_dotenv
load_dotenv()

API_KEY = os.getenv("OPENROUTER_API_KEY")
if not API_KEY:
    raise ValueError("Please set OPENROUTER_API_KEY before starting.")

# Define a custom OpenRouter chat model class
class OpenRouterChat(ChatOpenAI):
    def __init__(self, model_name: str = "deepseek/deepseek-prover-v2:free", **kwargs):
        # Configure for OpenRouter API
        # Don't modify the model name - pass it directly to OpenRouter
        super().__init__(
            model_name=model_name,
            openai_api_base="https://openrouter.ai/api/v1",
            openai_api_key=API_KEY,
            **kwargs
        )

# Create a template for the debater prompts
template = """You are a professional debater taking the {debater_role} side on the topic: "{topic}".

{bill_description}

{history}

Please provide a strong, logical argument for your side. Structure your response with:
1. Clear claims and evidence
2. Logical reasoning
3. Organized paragraphs under clear headings (using markdown ### for headings)
4. Keep your response concise and focused (around 300-500 words)
"""

# Create the chat prompt template
chat_prompt = ChatPromptTemplate.from_template(template)

# Create a memory instance
memory_map = {}

# Function to create a debater chain with a specific model
def get_debater_chain(model_name="deepseek/deepseek-prover-v2:free"):
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

    # Build the runnable chain using LCEL
    chain = (
        {
            "debater_role": RunnablePassthrough(),
            "topic": RunnablePassthrough(),
            "bill_description": RunnablePassthrough(),
            "history": get_history,
        }
        | chat_prompt
        | llm
        | StrOutputParser()
    )
    
    # Create a wrapper object with run method to match the old API
    class ChainWrapper:
        def __init__(self, chain_func):
            self.chain = chain_func
            
        def run(self, **kwargs):
            response = self.chain.invoke(kwargs)
            
            # Add the response to memory
            chain_id = f"debater-{kwargs.get('debater_role')}-{kwargs.get('topic', '')[:20]}"
            if chain_id in memory_map:
                memory_map[chain_id].append({"role": "assistant", "content": response})
            
            return response
    
    # Return the wrapper object
    return ChainWrapper(chain)

# Create a default debater chain for backward compatibility
debater_chain = get_debater_chain()