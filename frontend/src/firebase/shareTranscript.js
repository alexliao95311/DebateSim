// firebase/shareTranscript.js
import { getFirestore, collection, addDoc, doc, getDoc, updateDoc, getDocs } from "firebase/firestore";
import { auth } from "./firebaseConfig";

const db = getFirestore();

// Generate a unique share ID
const generateShareId = () => {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
};

// Share a transcript publicly
export const shareTranscript = async (transcriptId, transcriptData) => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User is not logged in!");
  }

  // Check if transcript has required fields - if not, it's likely corrupted/old
  if (!transcriptData.topic || !transcriptData.transcript) {
    throw new Error("This transcript is too old or corrupted to be shared. Please try sharing a more recent transcript.");
  }

  try {
    const shareId = generateShareId();
    
    // Create a public share document - ensure no undefined values
    const publicShareData = {
      shareId,
      transcript: transcriptData.transcript,
      topic: transcriptData.topic,
      mode: transcriptData.mode || "Unknown",
      activityType: transcriptData.activityType || "Unknown",
      createdAt: transcriptData.createdAt || new Date().toISOString(),
      sharedAt: new Date().toISOString(),
      sharedBy: user.uid,
      isActive: true
    };

    // Remove any undefined values before sending to Firestore
    Object.keys(publicShareData).forEach(key => {
      if (publicShareData[key] === undefined) {
        delete publicShareData[key];
      }
    });

    // Add to public shares collection
    await addDoc(collection(db, "publicShares"), publicShareData);
    
    // Update the original transcript to mark it as shared
    const transcriptRef = doc(db, "users", user.uid, "transcripts", transcriptId);
    await updateDoc(transcriptRef, {
      isShared: true,
      shareId: shareId,
      sharedAt: new Date().toISOString()
    });

    // Return the share URL
    const shareUrl = `${window.location.origin}/shared/${shareId}`;
    return { shareId, shareUrl };
  } catch (error) {
    console.error("Error sharing transcript:", error);
    throw error;
  }
};

// Get a shared transcript by share ID
export const getSharedTranscript = async (shareId) => {
  try {
    const publicSharesRef = collection(db, "publicShares");
    const snapshot = await getDocs(publicSharesRef);
    
    let sharedTranscript = null;
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.shareId === shareId && data.isActive) {
        sharedTranscript = { id: doc.id, ...data };
      }
    });

    // Note: View count functionality removed for privacy

    return sharedTranscript;
  } catch (error) {
    console.error("Error fetching shared transcript:", error);
    throw error;
  }
};

// Unshare a transcript
export const unshareTranscript = async (transcriptId, shareId) => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User is not logged in!");
  }

  try {
    // Find and deactivate the public share
    const publicSharesRef = collection(db, "publicShares");
    const snapshot = await getDocs(publicSharesRef);
    
    snapshot.forEach(async (docSnapshot) => {
      const data = docSnapshot.data();
      if (data.shareId === shareId && data.sharedBy === user.uid) {
        await updateDoc(doc(db, "publicShares", docSnapshot.id), {
          isActive: false
        });
      }
    });

    // Update the original transcript
    const transcriptRef = doc(db, "users", user.uid, "transcripts", transcriptId);
    await updateDoc(transcriptRef, {
      isShared: false,
      shareId: null,
      sharedAt: null
    });

    return true;
  } catch (error) {
    console.error("Error unsharing transcript:", error);
    throw error;
  }
};