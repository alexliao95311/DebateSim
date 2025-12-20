#!/usr/bin/env python3
"""
Test script to verify that multiple debates can run concurrently.
This tests the async fix for the blocking backend issue.
"""
import asyncio
import aiohttp
import time
import json

API_BASE = "http://localhost:8000"

async def start_debate(session, debate_id, model1, model2, topic):
    """Start a debate via the streaming endpoint and wait for completion."""
    start_time = time.time()
    print(f"[Debate {debate_id}] Starting: {model1} vs {model2}")

    url = f"{API_BASE}/leaderboard/run-debate-stream"
    payload = {
        "topic": topic,
        "model1": model1,
        "model2": model2,
        "judge_model": "anthropic/claude-3.5-sonnet",
        "debate_format": "default",
        "max_rounds": 2,  # Use 2 rounds for faster testing
        "language": "en"
    }

    try:
        async with session.post(url, json=payload) as response:
            if response.status != 200:
                print(f"[Debate {debate_id}] ERROR: Status {response.status}")
                return None

            # Read the SSE stream
            async for line in response.content:
                line_str = line.decode('utf-8').strip()
                if line_str.startswith('data: '):
                    data = json.loads(line_str[6:])
                    if data.get('type') == 'complete':
                        elapsed = time.time() - start_time
                        print(f"[Debate {debate_id}] ✅ COMPLETED in {elapsed:.1f}s - Winner: {data.get('winner')}")
                        return elapsed
                    elif data.get('type') == 'error':
                        print(f"[Debate {debate_id}] ❌ ERROR: {data.get('message')}")
                        return None
    except Exception as e:
        print(f"[Debate {debate_id}] ❌ EXCEPTION: {e}")
        return None

async def test_concurrent_debates():
    """Test running multiple debates concurrently."""
    print("=" * 60)
    print("Testing Concurrent Debates")
    print("=" * 60)
    print("\nStarting 3 debates in parallel...")
    print("If async is working, all 3 should run concurrently.")
    print("If blocking, they'll run sequentially (much slower).\n")

    start_time = time.time()

    async with aiohttp.ClientSession() as session:
        tasks = [
            start_debate(session, 1, "openai/gpt-4o-mini", "meta-llama/llama-3.3-70b-instruct",
                        "Should AI be regulated?"),
            start_debate(session, 2, "google/gemini-2.0-flash-001", "openai/gpt-4o-mini",
                        "Should voting be mandatory?"),
            start_debate(session, 3, "anthropic/claude-3.5-sonnet", "meta-llama/llama-3.3-70b-instruct",
                        "Should college be free?"),
        ]

        results = await asyncio.gather(*tasks)

    total_time = time.time() - start_time

    print("\n" + "=" * 60)
    print("RESULTS:")
    print("=" * 60)
    print(f"Total wall clock time: {total_time:.1f}s")

    if all(results):
        avg_debate_time = sum(results) / len(results)
        print(f"Average debate time: {avg_debate_time:.1f}s")

        # If running concurrently, total time should be close to the longest debate
        # If running sequentially, total time would be sum of all debates
        expected_sequential = sum(results)
        print(f"\nExpected if sequential: {expected_sequential:.1f}s")
        print(f"Actual (concurrent): {total_time:.1f}s")

        if total_time < expected_sequential * 0.7:
            print("\n✅ SUCCESS: Debates ran concurrently! (Async is working)")
        else:
            print("\n⚠️  WARNING: Debates may have run sequentially (blocking issue)")
    else:
        print("\n❌ Some debates failed. Check the errors above.")

if __name__ == "__main__":
    asyncio.run(test_concurrent_debates())
