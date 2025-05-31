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
            model=model_name,  # Use 'model' instead of 'model_name'
            openai_api_base="https://openrouter.ai/api/v1",
            openai_api_key=API_KEY,
            **kwargs
        )

# Define the template for the judge
template = """You are an expert debate judge. Analyze the following debate transcript and provide comprehensive feedback.

DEBATE TRANSCRIPT:
{transcript}

Please provide your judgment with the following sections:
1. Summary of Main Arguments from both sides
2. Strengths and Weaknesses Analysis for each debater
3. Decision on who won the debate with reasoning

Format your response with clear headings using markdown (###).
"""

# Create the chat prompt template
chat_prompt = ChatPromptTemplate.from_template(template)

# Function to get a judge chain with a specific model
def get_judge_chain(model_name="deepseek/deepseek-prover-v2:free"):
    # Initialize the OpenRouter API model with user's selected model
    llm = OpenRouterChat(
        model_name=model_name,
        temperature=0.5
    )
    
    # Build the runnable chain using LCEL
    chain = (
        {"transcript": RunnablePassthrough()}
        | chat_prompt
        | llm
        | StrOutputParser()
    )
    
    # Create a wrapper class with run method to match the old API
    class ChainWrapper:
        def __init__(self, chain_func):
            self.chain = chain_func
            
        def run(self, **kwargs):
            return self.chain.invoke(kwargs)
    
    # Return the wrapper object
    return ChainWrapper(chain)

# Create a default judge chain for backward compatibility
judge_chain = get_judge_chain()