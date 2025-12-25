# Firebase Security Rules for Share Feature

To enable the share feature, you need to update your Firebase Firestore security rules to allow public read access to the `publicShares` collection while keeping user transcripts private.

## Required Security Rules

Add these rules to your Firebase Firestore security rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own transcripts
    match /users/{userId}/transcripts/{transcriptId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Public shares are readable by anyone, but only writable by authenticated users
    match /publicShares/{shareId} {
      allow read: if true; // Anyone can read public shares
      allow write: if request.auth != null; // Only authenticated users can create/update shares
    }
    
    // Users collection rules (if you have user documents)
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## How to Update Rules

1. Go to your Firebase Console
2. Navigate to Firestore Database
3. Click on the "Rules" tab
4. Replace your existing rules with the rules above
5. Click "Publish" to deploy the changes

## Security Considerations

- **Public shares are read-only for anonymous users** - anyone with a share link can view the transcript
- **Only authenticated users can create shares** - prevents spam and abuse
- **User transcripts remain private** - only the owner can access their original transcripts
- **Share documents include minimal data** - only the transcript content and metadata needed for public viewing
- **Simulated debates are publicly readable** - AI vs AI debate history is accessible to all users

## Testing the Rules

After deploying the rules, test that:
1. Authenticated users can create shares ✅
2. Anonymous users can view shared transcripts ✅
3. Anonymous users cannot create or modify shares ❌
4. Users cannot access other users' private transcripts ❌