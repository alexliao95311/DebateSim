#!/usr/bin/env python3
"""
Script to test and initialize models from models.txt to Firebase Firestore with default ELO ratings.

Usage:
    python initialize_models_firestore.py

This script:
1. Reads models from models.txt
2. Tests each model by making a simple API call to ensure it works
3. Initializes working models in Firestore with default ELO rating of 1500
"""

import os
import sys
import asyncio
import aiohttp
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add the project root to the path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
except ImportError:
    print("Error: firebase-admin not installed. Run: pip install firebase-admin")
    sys.exit(1)

API_BASE = os.getenv("API_BASE", "http://localhost:8000")

def initialize_firebase():
    """Initialize Firebase Admin SDK."""
    # Check if already initialized
    try:
        return firestore.client()
    except ValueError:
        pass
    
    # Get credentials path
    cred_path = project_root / "credentials" / "debatesim-6f403-55fd99aa753a-google-cloud.json"
    
    if not cred_path.exists():
        print(f"Error: Firebase credentials not found at {cred_path}")
        print("Please ensure your Firebase service account key is in the credentials/ directory")
        sys.exit(1)
    
    # Initialize Firebase
    cred = credentials.Certificate(str(cred_path))
    firebase_admin.initialize_app(cred)
    return firestore.client()

def read_models_file():
    """Read models from models.txt file."""
    models_file = project_root / "models.txt"
    
    if not models_file.exists():
        print(f"Error: models.txt not found at {models_file}")
        sys.exit(1)
    
    with open(models_file, 'r', encoding='utf-8') as f:
        models = [line.strip() for line in f if line.strip()]
    
    print(f"Found {len(models)} models in models.txt")
    return models

async def test_model(session, model):
    """Test if a model works by making a simple API call."""
    try:
        test_payload = {
            "debater": "Pro",
            "prompt": "Test prompt: Should AI be regulated?",
            "model": model,
            "bill_description": "",
            "full_transcript": "",
            "round_num": 1,
            "persona": "Default AI",
            "debate_format": "default",
            "speaking_order": "pro-first"
        }
        
        async with session.post(
            f"{API_BASE}/generate-response",
            json=test_payload,
            timeout=aiohttp.ClientTimeout(total=30)
        ) as response:
            if response.status == 200:
                data = await response.json()
                if data.get("response") and len(data.get("response", "")) > 0:
                    return True, None
                else:
                    return False, "Empty response"
            else:
                return False, f"HTTP {response.status}"
    except asyncio.TimeoutError:
        return False, "Timeout"
    except Exception as e:
        return False, str(e)

async def test_all_models(models):
    """Test all models and return only working ones."""
    print("\n3. Testing models...")
    working_models = []
    failed_models = []
    
    async with aiohttp.ClientSession() as session:
        for i, model in enumerate(models, 1):
            print(f"  Testing [{i}/{len(models)}] {model}...", end=" ", flush=True)
            success, error = await test_model(session, model)
            if success:
                print("✅ Working")
                working_models.append(model)
            else:
                print(f"❌ Failed: {error}")
                failed_models.append((model, error))
    
    print(f"\n✅ {len(working_models)} model(s) working")
    if failed_models:
        print(f"❌ {len(failed_models)} model(s) failed:")
        for model, error in failed_models:
            print(f"   - {model}: {error}")
    
    return working_models

def initialize_models_in_firestore(db, models, default_elo=1500):
    """Initialize models in Firestore with default ELO ratings.
    
    Uses the same document ID format as the frontend: model_name.replace('/', '_')
    """
    models_ref = db.collection('models')
    
    # Check existing models (handle permission errors gracefully)
    existing_models = {}
    try:
        existing_docs = models_ref.stream()
        for doc in existing_docs:
            data = doc.to_dict()
            existing_models[data.get('model', '')] = doc.id
        print(f"\n4. Found {len(existing_models)} existing models in Firestore")
    except Exception as e:
        print(f"\n4. Warning: Could not read existing models: {e}")
        print("   Continuing to initialize models anyway...")
    
    # Initialize or update models
    total_initialized = 0
    total_updated = 0
    
    for model in models:
        # Use same document ID format as frontend: replace '/' with '_'
        doc_id = model.replace('/', '_')
        
        doc_ref = models_ref.document(doc_id)
        
        try:
            # Try to read existing document first (skip if permission denied)
            doc_snapshot = None
            try:
                doc_snapshot = doc_ref.get()
            except Exception as read_error:
                # If we can't read, just try to write directly
                doc_snapshot = None
            
            if doc_snapshot and doc_snapshot.exists:
                # Model exists, update if needed
                existing_data = doc_snapshot.to_dict()
                if 'elo' not in existing_data or existing_data.get('elo') is None:
                    # Update with default ELO if missing
                    doc_ref.update({
                        'elo': default_elo,
                        'wins': existing_data.get('wins', 0),
                        'losses': existing_data.get('losses', 0),
                        'draws': existing_data.get('draws', 0),
                        'updatedAt': firestore.SERVER_TIMESTAMP
                    })
                    total_updated += 1
                    print(f"  Updated {model} with default ELO")
                else:
                    # Reset ELO and stats for existing models
                    doc_ref.update({
                        'model': model,
                        'elo': default_elo,
                        'wins': 0,
                        'losses': 0,
                        'draws': 0,
                        'updatedAt': firestore.SERVER_TIMESTAMP
                    })
                    total_updated += 1
                    print(f"  ✅ Reset {model} to ELO {default_elo} (wins/losses/draws = 0)")
            else:
                # Create new model document
                doc_ref.set({
                    'model': model,
                    'elo': default_elo,
                    'wins': 0,
                    'losses': 0,
                    'draws': 0,
                    'createdAt': firestore.SERVER_TIMESTAMP,
                    'updatedAt': firestore.SERVER_TIMESTAMP
                })
                total_initialized += 1
                print(f"  ✅ Initialized {model} with ELO {default_elo}")
        except Exception as e:
            print(f"  ❌ Failed to initialize {model}: {e}")
            continue
    
    print(f"\n✅ Successfully initialized {total_initialized} new model(s)")
    if total_updated > 0:
        print(f"✅ Updated {total_updated} existing model(s)")
    
    # Count total models (handle permission errors gracefully)
    try:
        all_docs = models_ref.stream()
        total_count = sum(1 for _ in all_docs)
        print(f"📊 Total models in database: {total_count}")
    except Exception as e:
        print(f"📊 Could not count total models: {e}")

async def main_async(skip_testing=False):
    """Main async function."""
    print("=" * 60)
    if skip_testing:
        print("Initializing Models in Firebase Firestore")
    else:
        print("Testing and Initializing Models in Firebase Firestore")
    print("=" * 60)
    
    # Initialize Firebase
    print("\n1. Initializing Firebase...")
    db = initialize_firebase()
    print("✅ Firebase initialized")
    
    # Read models
    print("\n2. Reading models.txt...")
    all_models = read_models_file()
    
    if skip_testing:
        # Skip testing, initialize all models
        print(f"\n3. Initializing all {len(all_models)} model(s) in Firestore (skipping tests)...")
        initialize_models_in_firestore(db, all_models)
    else:
        # Test models
        working_models = await test_all_models(all_models)
        
        if not working_models:
            print("\n❌ No working models found. Cannot initialize.")
            return
        
        # Initialize working models
        print(f"\n5. Initializing {len(working_models)} working model(s) in Firestore...")
        initialize_models_in_firestore(db, working_models)
    
    print("\n" + "=" * 60)
    print("✅ Initialization complete!")
    print("=" * 60)

def main():
    """Main function."""
    import sys
    # Check if --skip-testing flag is provided
    skip_testing = '--skip-testing' in sys.argv or '--no-test' in sys.argv
    asyncio.run(main_async(skip_testing=skip_testing))

if __name__ == "__main__":
    main()

