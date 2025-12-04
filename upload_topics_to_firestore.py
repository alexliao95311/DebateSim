#!/usr/bin/env python3
"""
Script to upload topics from topics.txt to Firebase Firestore.

Usage:
    python upload_topics_to_firestore.py

This script reads topics from topics.txt and uploads them to Firestore
in the 'topics' collection with proper indexing and metadata.
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

def read_topics_file():
    """Read topics from topics.txt file."""
    topics_file = project_root / "topics.txt"
    
    if not topics_file.exists():
        print(f"Error: topics.txt not found at {topics_file}")
        sys.exit(1)
    
    with open(topics_file, 'r', encoding='utf-8') as f:
        topics = [line.strip() for line in f if line.strip()]
    
    print(f"Found {len(topics)} topics in topics.txt")
    return topics

def categorize_topic(topic):
    """Categorize a topic based on keywords."""
    topic_lower = topic.lower()
    
    categories = []
    
    # Political/Government
    if any(word in topic_lower for word in ['vote', 'election', 'president', 'government', 'political', 'congress', 'senate', 'democracy', 'republic', 'monarchy']):
        categories.append('politics')
    
    # Education
    if any(word in topic_lower for word in ['school', 'education', 'student', 'teacher', 'college', 'university', 'homework', 'curriculum']):
        categories.append('education')
    
    # Technology/AI
    if any(word in topic_lower for word in ['ai', 'artificial intelligence', 'technology', 'robot', 'digital', 'internet', 'social media', 'algorithm', 'data']):
        categories.append('technology')
    
    # Environment
    if any(word in topic_lower for word in ['climate', 'environment', 'carbon', 'pollution', 'renewable', 'energy', 'nuclear', 'fossil', 'green', 'emission']):
        categories.append('environment')
    
    # Healthcare
    if any(word in topic_lower for word in ['health', 'medical', 'healthcare', 'hospital', 'doctor', 'vaccine', 'drug', 'medicine', 'treatment']):
        categories.append('healthcare')
    
    # Economics
    if any(word in topic_lower for word in ['economy', 'economic', 'tax', 'wage', 'income', 'money', 'financial', 'market', 'trade', 'business']):
        categories.append('economics')
    
    # Social Issues
    if any(word in topic_lower for word in ['social', 'society', 'rights', 'equality', 'discrimination', 'justice', 'law', 'legal', 'crime', 'prison']):
        categories.append('social')
    
    # Ethics/Philosophy
    if any(word in topic_lower for word in ['ethical', 'moral', 'philosophy', 'should', 'right', 'wrong', 'justify', 'justifiable']):
        categories.append('ethics')
    
    # Science
    if any(word in topic_lower for word in ['science', 'research', 'scientist', 'experiment', 'genetic', 'cloning', 'space', 'mars', 'planet']):
        categories.append('science')
    
    # Culture/Arts
    if any(word in topic_lower for word in ['art', 'culture', 'music', 'literature', 'book', 'film', 'media', 'entertainment']):
        categories.append('culture')
    
    # Default category if none match
    if not categories:
        categories.append('general')
    
    return categories

def upload_topics_to_firestore(db, topics, batch_size=500):
    """Upload topics to Firestore in batches."""
    topics_ref = db.collection('topics')
    
    # Check if topics already exist
    existing_topics = set()
    existing_docs = topics_ref.stream()
    for doc in existing_docs:
        existing_topics.add(doc.to_dict().get('text', '').strip())
    
    print(f"Found {len(existing_topics)} existing topics in Firestore")
    
    # Filter out existing topics
    new_topics = [t for t in topics if t not in existing_topics]
    
    if not new_topics:
        print("All topics already exist in Firestore. No new topics to upload.")
        return
    
    print(f"Uploading {len(new_topics)} new topics...")
    
    # Upload in batches
    total_uploaded = 0
    for i in range(0, len(new_topics), batch_size):
        batch = db.batch()
        batch_topics = new_topics[i:i + batch_size]
        
        for topic in batch_topics:
            # Create document with topic text as ID (sanitized)
            doc_id = topic[:100].replace('/', '_').replace('\\', '_')  # Firestore ID limitations
            
            # Use a hash-based ID to avoid collisions
            import hashlib
            doc_id = hashlib.md5(topic.encode()).hexdigest()
            
            doc_ref = topics_ref.document(doc_id)
            
            categories = categorize_topic(topic)
            
            batch.set(doc_ref, {
                'text': topic,
                'categories': categories,
                'createdAt': firestore.SERVER_TIMESTAMP,
                'used': False,  # Track if topic has been used in a debate
                'usageCount': 0  # Count how many times topic has been used
            })
        
        # Commit batch
        batch.commit()
        total_uploaded += len(batch_topics)
        print(f"Uploaded batch: {total_uploaded}/{len(new_topics)} topics")
    
    print(f"\n✅ Successfully uploaded {total_uploaded} topics to Firestore!")
    print(f"Total topics in database: {len(existing_topics) + total_uploaded}")

def main():
    """Main function."""
    print("=" * 60)
    print("Uploading Topics to Firebase Firestore")
    print("=" * 60)
    
    # Initialize Firebase
    print("\n1. Initializing Firebase...")
    db = initialize_firebase()
    print("✅ Firebase initialized")
    
    # Read topics
    print("\n2. Reading topics.txt...")
    topics = read_topics_file()
    
    # Upload topics
    print("\n3. Uploading topics to Firestore...")
    upload_topics_to_firestore(db, topics)
    
    print("\n" + "=" * 60)
    print("✅ Upload complete!")
    print("=" * 60)

if __name__ == "__main__":
    main()

