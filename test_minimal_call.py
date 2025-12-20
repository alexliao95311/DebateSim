#!/usr/bin/env python3
"""
Minimal test: Single OpenRouter API call with no concurrency.
This will prove whether the key itself works.
"""
import os
from dotenv import load_dotenv
import aiohttp
import asyncio
import json

# FORCE load .env with override
load_dotenv(override=True)

API_KEY = os.getenv("OPENROUTER_API_KEY")
print("=" * 60)
print("TEST SCRIPT USING KEY:", API_KEY)
print("=" * 60)


async def test_single_api_call():
    """Make ONE API call to OpenRouter - absolutely minimal."""
    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://debatesim.app",
    }

    payload = {
        "model": "openai/gpt-4o-mini",
        "messages": [{"role": "user", "content": "Say 'ping'"}],
        "max_tokens": 10,  # Absolutely minimal
    }

    print("\n🔍 Making single minimal API call...")
    print(f"   Model: gpt-4o-mini")
    print(f"   Max tokens: 10")
    print(f"   Key: ...{API_KEY[-10:]}")

    async with aiohttp.ClientSession() as session:
        async with session.post(url, headers=headers, json=payload) as response:
            status = response.status

            if status == 200:
                result = await response.json()
                content = result["choices"][0]["message"]["content"]
                print(f"\n✅ SUCCESS!")
                print(f"   Status: {status}")
                print(f"   Response: {content}")
                return True
            else:
                error_text = await response.text()
                print(f"\n❌ FAILED!")
                print(f"   Status: {status}")
                print(f"   Error: {error_text}")
                return False

if __name__ == "__main__":
    success = asyncio.run(test_single_api_call())
    print("\n" + "=" * 60)
    if success:
        print("✅ KEY WORKS - The problem is elsewhere")
    else:
        print("❌ KEY DOESN'T WORK - Contact OpenRouter support")
    print("=" * 60)
