#!/usr/bin/env python3
"""
Test script to see exactly what text the backend API returns for H.R.1
"""

import asyncio
import aiohttp
import os
import re
from dotenv import load_dotenv

load_dotenv()
CONGRESS_API_KEY = os.getenv("CONGRESS_API_KEY")

async def test_bill_text_fetch():
    """Test fetching and processing bill text like the backend does"""

    if not CONGRESS_API_KEY:
        print("Error: CONGRESS_API_KEY not found in environment")
        return

    bill_type = "hr"  # Try using the short form like the backend might
    bill_number = "1"
    congress = 119

    try:
        async with aiohttp.ClientSession() as session:
            # Get bill text versions from Congress API (same as backend)
            url = f"https://api.congress.gov/v3/bill/{congress}/{bill_type.lower()}/{bill_number}/text"
            params = {
                "api_key": CONGRESS_API_KEY,
                "format": "json"
            }

            print(f"Fetching bill text versions from: {url}")

            async with session.get(url, params=params) as response:
                if response.status != 200:
                    print(f"Error: {response.status}")
                    return

                data = await response.json()
                text_versions = data.get("textVersions", [])

                print(f"Found {len(text_versions)} text versions")

                if not text_versions:
                    print("No text versions available")
                    return

                # Get the most recent text version (same as backend)
                latest_version = text_versions[0]
                text_url = latest_version.get("formats", [])

                print(f"Available formats: {[f.get('type') for f in text_url]}")

                # Look for formatted text first (same as backend)
                text_content = None
                for format_info in text_url:
                    if format_info.get("type") == "Formatted Text":
                        format_url = format_info.get("url")
                        if format_url:
                            print(f"Fetching formatted text from: {format_url}")
                            async with session.get(format_url) as text_response:
                                if text_response.status == 200:
                                    text_content = await text_response.text()
                                    break

                if not text_content:
                    print("No formatted text found, trying other formats...")
                    for format_info in text_url:
                        format_url = format_info.get("url")
                        if format_url:
                            print(f"Trying format: {format_info.get('type')} from {format_url}")
                            async with session.get(format_url) as text_response:
                                if text_response.status == 200:
                                    text_content = await text_response.text()
                                    break

                if not text_content:
                    print("Could not retrieve any bill text content")
                    return

                print(f"\n=== RAW TEXT ANALYSIS ===")
                print(f"Raw text length: {len(text_content)} characters")
                print(f"Raw text first 1000 chars:")
                print(repr(text_content[:1000]))

                # Apply the same cleaning as the backend
                print(f"\n=== APPLYING BACKEND CLEANING ===")

                # Basic HTML tag removal
                clean_text = re.sub(r'<[^>]+>', '', text_content)
                print(f"After HTML tag removal: {len(clean_text)} characters")

                # Remove HTML entities
                clean_text = re.sub(r'&lt;', '<', clean_text)
                clean_text = re.sub(r'&gt;', '>', clean_text)
                clean_text = re.sub(r'&amp;', '&', clean_text)
                clean_text = re.sub(r'&quot;', '"', clean_text)
                clean_text = re.sub(r'&apos;', "'", clean_text)
                print(f"After HTML entity removal: {len(clean_text)} characters")

                # Remove excessive whitespace (THIS IS THE PROBLEM!)
                print(f"Before whitespace cleaning:")
                print(repr(clean_text[:1000]))

                clean_text = re.sub(r'\s+', ' ', clean_text).strip()
                print(f"After whitespace removal: {len(clean_text)} characters")
                print(f"After whitespace cleaning:")
                print(repr(clean_text[:1000]))

                # Remove document metadata
                clean_text = re.sub(r'\[Congressional Bills.*?\]', '', clean_text)
                clean_text = re.sub(r'\[From the U\.S\. Government Publishing Office\]', '', clean_text)
                clean_text = re.sub(r'&lt;DOC&gt;.*?&lt;/DOC&gt;', '', clean_text, flags=re.DOTALL)

                print(f"Final cleaned text length: {len(clean_text)} characters")
                print(f"Final cleaned text first 1000 chars:")
                print(repr(clean_text[:1000]))

                # Test section detection on the cleaned text
                print(f"\n=== SECTION DETECTION TEST ===")

                # Current regex from the frontend
                header_pattern = r'(?:^|\n)\s*(SEC(?:TION)?\.?\s+\d+[A-Z]?\.?\s*[^\n]*)'

                # But this won't work because we removed all newlines!
                # Let's try different patterns
                patterns_to_test = [
                    (r'SEC\.?\s+\d+[A-Z]?\.?', 'SEC. N.'),
                    (r'SECTION\s+\d+[A-Z]?\.?', 'SECTION N.'),
                    (r'Sec\.?\s+\d+[A-Z]?\.?', 'Sec. N.'),
                    (r'Section\s+\d+[A-Z]?\.?', 'Section N.'),
                ]

                for pattern, description in patterns_to_test:
                    matches = list(re.finditer(pattern, clean_text, re.IGNORECASE))
                    print(f"{description}: {len(matches)} matches")

                    for i, match in enumerate(matches[:5]):
                        start = max(0, match.start() - 100)
                        end = min(len(clean_text), match.end() + 200)
                        context = clean_text[start:end]
                        print(f"  Match {i+1}: pos {match.start()}: {match.group()}")
                        print(f"    Context: ...{context}...")
                        print()

                # Save the cleaned text for analysis
                with open('cleaned_congress_text.txt', 'w', encoding='utf-8') as f:
                    f.write(clean_text)
                print(f"Saved cleaned text to: cleaned_congress_text.txt")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_bill_text_fetch())