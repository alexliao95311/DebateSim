#!/usr/bin/env python3
"""
Script to scrape Congress.gov bill text and analyze structure for section extraction
"""

import requests
from bs4 import BeautifulSoup
import re
import json

def scrape_bill_text(url):
    """Scrape bill text from Congress.gov"""
    print(f"Scraping: {url}")

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }

    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()

        soup = BeautifulSoup(response.content, 'html.parser')

        # Find the bill text content
        # Congress.gov typically puts bill text in specific containers
        text_containers = [
            soup.find('div', {'class': 'generated-html-container'}),
            soup.find('div', {'id': 'billTextContainer'}),
            soup.find('pre', {'id': 'billTextContainer'}),
            soup.find('div', {'class': 'bill-text'}),
            soup.select_one('.generated-html-container'),
            soup.select_one('#billTextContainer'),
        ]

        bill_text = None
        container_info = None

        for i, container in enumerate(text_containers):
            if container:
                bill_text = container.get_text()
                container_info = f"Container {i}: {container.name} with class/id: {container.get('class', [])} / {container.get('id', 'no-id')}"
                print(f"Found text in: {container_info}")
                break

        if not bill_text:
            # Fallback - get all text from body
            body = soup.find('body')
            if body:
                bill_text = body.get_text()
                container_info = "Fallback: full body text"
                print("Using fallback: full body text")

        return bill_text, container_info, soup

    except Exception as e:
        print(f"Error scraping {url}: {e}")
        return None, None, None

def analyze_text_structure(text):
    """Analyze the structure of the bill text"""
    if not text:
        return None

    print(f"\n=== TEXT ANALYSIS ===")
    print(f"Total length: {len(text)} characters")
    print(f"First 500 characters:")
    print(repr(text[:500]))
    print(f"\nLast 500 characters:")
    print(repr(text[-500:]))

    # Look for section patterns
    section_patterns = [
        (r'SEC\.\s*\d+[A-Z]?\.', 'SEC. N.'),
        (r'SECTION\s+\d+[A-Z]?\.', 'SECTION N.'),
        (r'Sec\.\s*\d+[A-Z]?\.', 'Sec. N.'),
        (r'Section\s+\d+[A-Z]?\.', 'Section N.'),
        (r'§\s*\d+[A-Z]?\.', '§ N.'),
        (r'TITLE\s+[IVX]+', 'TITLE Roman'),
        (r'CHAPTER\s+\d+', 'CHAPTER N'),
        (r'PART\s+[A-Z]+', 'PART Letter'),
        (r'SUBTITLE\s+[A-Z]+', 'SUBTITLE Letter'),
    ]

    print(f"\n=== SECTION PATTERN ANALYSIS ===")
    all_matches = []

    for pattern, description in section_patterns:
        matches = list(re.finditer(pattern, text, re.IGNORECASE | re.MULTILINE))
        if matches:
            print(f"\n{description} pattern '{pattern}': {len(matches)} matches")
            for i, match in enumerate(matches[:5]):  # Show first 5 matches
                start = max(0, match.start() - 50)
                end = min(len(text), match.end() + 100)
                context = text[start:end].replace('\n', '\\n').replace('\r', '\\r')
                print(f"  Match {i+1}: pos {match.start()}: ...{context}...")

                all_matches.append({
                    'pattern': description,
                    'position': match.start(),
                    'text': match.group(),
                    'context': context
                })

            if len(matches) > 5:
                print(f"  ... and {len(matches) - 5} more matches")

    # Sort all matches by position
    all_matches.sort(key=lambda x: x['position'])

    print(f"\n=== ALL MATCHES IN ORDER ===")
    for i, match in enumerate(all_matches[:20]):  # Show first 20
        print(f"  {i+1:2d}. pos {match['position']:6d}: {match['text']} ({match['pattern']})")

    if len(all_matches) > 20:
        print(f"  ... and {len(all_matches) - 20} more matches")

    # Analyze line structure
    lines = text.split('\n')
    print(f"\n=== LINE STRUCTURE ===")
    print(f"Total lines: {len(lines)}")

    # Look for lines that might be section headers
    potential_headers = []
    for i, line in enumerate(lines):
        line_stripped = line.strip()
        if line_stripped and any(re.search(pattern, line_stripped, re.IGNORECASE) for pattern, _ in section_patterns):
            potential_headers.append((i, line_stripped))

    print(f"Potential header lines: {len(potential_headers)}")
    for i, (line_num, line_text) in enumerate(potential_headers[:10]):
        print(f"  Line {line_num:4d}: {line_text}")

    if len(potential_headers) > 10:
        print(f"  ... and {len(potential_headers) - 10} more header lines")

    return {
        'total_length': len(text),
        'total_lines': len(lines),
        'section_matches': all_matches,
        'potential_headers': potential_headers
    }

def main():
    # Test URLs
    test_urls = [
        "https://www.congress.gov/bill/119th-congress/house-bill/1/text",
        # Add more test URLs if needed
    ]

    for url in test_urls:
        print(f"\n{'='*80}")
        print(f"ANALYZING: {url}")
        print(f"{'='*80}")

        text, container_info, soup = scrape_bill_text(url)

        if text:
            print(f"Successfully extracted text from: {container_info}")
            analysis = analyze_text_structure(text)

            # Save raw text for further analysis
            filename = f"congress_bill_text_{url.split('/')[-3]}_{url.split('/')[-2]}.txt"
            with open(filename, 'w', encoding='utf-8') as f:
                f.write(text)
            print(f"\nSaved raw text to: {filename}")

            # Save analysis
            analysis_filename = f"congress_bill_analysis_{url.split('/')[-3]}_{url.split('/')[-2]}.json"
            with open(analysis_filename, 'w', encoding='utf-8') as f:
                # Convert analysis to JSON-serializable format
                json_analysis = {
                    'url': url,
                    'container_info': container_info,
                    'total_length': analysis['total_length'],
                    'total_lines': analysis['total_lines'],
                    'section_matches_count': len(analysis['section_matches']),
                    'section_matches': analysis['section_matches'][:50],  # First 50 matches
                    'potential_headers_count': len(analysis['potential_headers']),
                    'potential_headers': analysis['potential_headers'][:50]  # First 50 headers
                }
                json.dump(json_analysis, f, indent=2, ensure_ascii=False)
            print(f"Saved analysis to: {analysis_filename}")

        else:
            print("Failed to extract text")

if __name__ == "__main__":
    main()