#!/usr/bin/env python3
"""Test a single debate with the cheapest model."""
import asyncio
import aiohttp
import json

API_BASE = "http://localhost:8000"

async def test_single_debate():
    print("Testing single debate with GPT-4o-mini (cheapest model)...")
    
    url = f"{API_BASE}/leaderboard/run-debate-stream"
    payload = {
        "topic": "Should AI be regulated?",
        "model1": "openai/gpt-4o-mini",
        "model2": "openai/gpt-4o-mini",
        "judge_model": "openai/gpt-4o-mini",
        "debate_format": "default",
        "max_rounds": 2,
        "language": "en"
    }

    async with aiohttp.ClientSession() as session:
        async with session.post(url, json=payload) as response:
            if response.status != 200:
                print(f"❌ ERROR: Status {response.status}")
                text = await response.text()
                print(f"Response: {text}")
                return
            
            async for line in response.content:
                line_str = line.decode('utf-8').strip()
                if line_str.startswith('data: '):
                    data = json.loads(line_str[6:])
                    if data.get('type') == 'complete':
                        print(f"✅ SUCCESS! Winner: {data.get('winner')}")
                        return
                    elif data.get('type') == 'error':
                        print(f"❌ ERROR: {data.get('message')}")
                        return
                    elif data.get('type') == 'speech':
                        print(f"  Speech from {data.get('speaker', 'unknown')}")

if __name__ == "__main__":
    asyncio.run(test_single_debate())
