#!/usr/bin/env python3
"""
Script to initialize models from models.txt to Firebase Firestore with default ELO ratings.

Usage:
    python initialize_models_firestore.py

This script reads models from models.txt and initializes them in Firestore
in the 'models' collection with default ELO rating of 1500.
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

def initialize_models_in_firestore(db, models, default_elo=1500):
    """Initialize models in Firestore with default ELO ratings."""
    models_ref = db.collection('models')
    
    # Check existing models
    existing_models = {}
    existing_docs = models_ref.stream()
    for doc in existing_docs:
        data = doc.to_dict()
        existing_models[data.get('model', '')] = doc.id
    
    print(f"Found {len(existing_models)} existing models in Firestore")
    
    # Initialize or update models
    total_initialized = 0
    total_updated = 0
    
    for model in models:
        # Use model name as document ID (sanitized)
        import hashlib
        doc_id = hashlib.md5(model.encode()).hexdigest()
        
        doc_ref = models_ref.document(doc_id)
        doc_snapshot = doc_ref.get()
        
        if doc_snapshot.exists():
            # Model exists, check if we need to update
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
            print(f"  Initialized {model} with ELO {default_elo}")
    
    print(f"\n✅ Successfully initialized {total_initialized} new models")
    print(f"✅ Updated {total_updated} existing models")
    print(f"Total models in database: {len(existing_models) + total_initialized}")

def main():
    """Main function."""
    print("=" * 60)
    print("Initializing Models in Firebase Firestore")
    print("=" * 60)
    
    # Initialize Firebase
    print("\n1. Initializing Firebase...")
    db = initialize_firebase()
    print("✅ Firebase initialized")
    
    # Read models
    print("\n2. Reading models.txt...")
    models = read_models_file()
    
    # Initialize models
    print("\n3. Initializing models in Firestore...")
    initialize_models_in_firestore(db, models)
    
    print("\n" + "=" * 60)
    print("✅ Initialization complete!")
    print("=" * 60)

if __name__ == "__main__":
    main()

