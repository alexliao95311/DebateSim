#!/usr/bin/env python3
"""
Test script to verify credentials path resolution
"""

import os
from pathlib import Path

def test_credentials_path():
    """Test the credentials path resolution"""
    print("🔍 Testing credentials path resolution...")
    print("=" * 50)
    
    # Current file location
    current_file = __file__
    print(f"Current file: {current_file}")
    
    # Current working directory
    cwd = os.getcwd()
    print(f"Current working directory: {cwd}")
    
    # Method 1: Using os.path.join
    path1 = os.path.join(os.path.dirname(__file__), "..", "credentials", "debatesim-6f403-55fd99aa753a-google-cloud.json")
    abs_path1 = os.path.abspath(path1)
    print(f"\nMethod 1 (os.path.join):")
    print(f"  Relative path: {path1}")
    print(f"  Absolute path: {abs_path1}")
    print(f"  Exists: {os.path.exists(abs_path1)}")
    
    # Method 2: Using pathlib
    path2 = Path(__file__).parent.parent / "credentials" / "debatesim-6f403-55fd99aa753a-google-cloud.json"
    abs_path2 = path2.resolve()
    print(f"\nMethod 2 (pathlib):")
    print(f"  Relative path: {path2}")
    print(f"  Absolute path: {abs_path2}")
    print(f"  Exists: {path2.exists()}")
    
    # Check if both methods give the same result
    if abs_path1 == str(abs_path2):
        print(f"\n✅ Both methods resolve to the same path")
    else:
        print(f"\n❌ Methods resolve to different paths")
    
    # List contents of credentials directory if it exists
    creds_dir = Path(__file__).parent.parent / "credentials"
    if creds_dir.exists():
        print(f"\n📁 Contents of credentials directory:")
        for file in creds_dir.iterdir():
            print(f"  - {file.name}")
    else:
        print(f"\n❌ Credentials directory not found: {creds_dir}")
    
    # Check if the specific credentials file exists
    if os.path.exists(abs_path1):
        print(f"\n✅ Credentials file found!")
        print(f"   Path: {abs_path1}")
        print(f"   Size: {os.path.getsize(abs_path1)} bytes")
    else:
        print(f"\n❌ Credentials file not found!")
        print(f"   Expected: {abs_path1}")
        
        # Try to find any .json files in the project
        print(f"\n🔍 Searching for JSON files in project root...")
        root_dir = Path(__file__).parent.parent
        json_files = list(root_dir.rglob("*.json"))
        if json_files:
            print(f"   Found {len(json_files)} JSON files:")
            for json_file in json_files:
                print(f"     - {json_file}")
        else:
            print(f"   No JSON files found in project root")

if __name__ == "__main__":
    test_credentials_path()
