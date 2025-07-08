// firebase/saveTranscript.js
import { getFirestore, collection, addDoc } from "firebase/firestore";
import { auth } from "./firebaseConfig"; // Adjust the path if needed

const db = getFirestore();

export const saveTranscriptToUser = async (transcript, topic = null, mode = null, activityType = null, grades = null) => {
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
    const documentData = {
      transcript,
      createdAt: new Date().toISOString(),
    };
    
    // Add topic, mode, activityType, and grades if provided
    if (topic) documentData.topic = topic;
    if (mode) documentData.mode = mode;
    if (activityType) documentData.activityType = activityType;
    if (grades) documentData.grades = grades;

    await addDoc(transcriptsRef, documentData);
    console.log(`${activityType || mode || 'Activity'} saved successfully!`);
  } catch (error) {
    console.error("Error saving transcript:", error);
  }
};