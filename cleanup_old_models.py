#!/usr/bin/env python3
"""
Script to remove old models from Firebase that are not in models.txt
"""

import os
import sys
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

def initialize_firebase():
    """Initialize Firebase Admin SDK."""
    try:
        return firestore.client()
    except ValueError:
        pass
    
    cred_path = project_root / "credentials" / "debatesim-6f403-55fd99aa753a-google-cloud.json"
    
    if not cred_path.exists():
        print(f"Error: Firebase credentials not found at {cred_path}")
        sys.exit(1)
    
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
    
    return set(models)  # Return as set for easy lookup

def cleanup_old_models():
    """Remove models from Firebase that are not in models.txt"""
    print("=" * 60)
    print("Cleaning up old models from Firebase")
    print("=" * 60)
    
    # Initialize Firebase
    print("\n1. Initializing Firebase...")
    db = initialize_firebase()
    print("✅ Firebase initialized")
    
    # Read current models
    print("\n2. Reading models.txt...")
    valid_models = read_models_file()
    print(f"Found {len(valid_models)} valid models in models.txt")
    
    # Get all models from Firebase
    print("\n3. Fetching models from Firebase...")
    models_ref = db.collection('models')
    all_docs = models_ref.stream()
    
    models_to_delete = []
    valid_count = 0
    
    for doc in all_docs:
        data = doc.to_dict()
        model_name = data.get('model', '')
        doc_id = doc.id
        
        if model_name in valid_models:
            valid_count += 1
            print(f"  ✅ {model_name} (valid)")
        else:
            models_to_delete.append((doc_id, model_name))
            print(f"  ❌ {model_name} (not in models.txt - will be deleted)")
    
    if not models_to_delete:
        print("\n✅ No old models to clean up!")
        return
    
    # Confirm deletion
    print(f"\n4. Found {len(models_to_delete)} old model(s) to delete:")
    for doc_id, model_name in models_to_delete:
        print(f"   - {model_name} (doc_id: {doc_id})")
    
    confirm = input("\nDelete these models? (yes/no): ").strip().lower()
    if confirm != 'yes':
        print("Cancelled.")
        return
    
    # Delete old models
    print("\n5. Deleting old models...")
    deleted_count = 0
    for doc_id, model_name in models_to_delete:
        try:
            doc_ref = models_ref.document(doc_id)
            doc_ref.delete()
            deleted_count += 1
            print(f"  ✅ Deleted {model_name}")
        except Exception as e:
            print(f"  ❌ Failed to delete {model_name}: {e}")
    
    print(f"\n✅ Successfully deleted {deleted_count} old model(s)")
    print(f"📊 Valid models remaining: {valid_count}")
    print(f"📊 Total models in database: {valid_count}")

if __name__ == "__main__":
    cleanup_old_models()

