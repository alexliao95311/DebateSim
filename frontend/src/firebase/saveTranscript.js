// firebase/saveTranscript.js
import { getFirestore, collection, addDoc } from "firebase/firestore";
import { auth } from "./firebaseConfig"; // Adjust the path if needed

const db = getFirestore();

export const saveTranscriptToUser = async (transcript) => {
  // Get the current logged-in user
  const user = auth.currentUser;
  if (!user) {
    console.error("User is not logged in!");
    return;
  }
  
  try {
    // Create a reference to the user's transcripts subcollection
    const transcriptsRef = collection(db, "users", user.uid, "transcripts");

    // Add a new transcript document with the transcript text and a timestamp
    await addDoc(transcriptsRef, {
      transcript,
      createdAt: new Date().toISOString(),
    });
    console.log("Transcript saved successfully!");
  } catch (error) {
    console.error("Error saving transcript:", error);
  }
};