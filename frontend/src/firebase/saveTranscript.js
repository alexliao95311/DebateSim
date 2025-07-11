// firebase/saveTranscript.js
import { getFirestore, collection, addDoc } from "firebase/firestore";
import { auth } from "./firebaseConfig"; // Adjust the path if needed

const db = getFirestore();

export const saveTranscriptToUser = async (transcript, topic = null, mode = null, activityType = null, grades = null, model = null) => {
  // Get the current logged-in user
  const user = auth.currentUser;
  if (!user) {
    console.error("User is not logged in!");
    return;
  }
  
  // Debug logging
  console.log("Saving transcript with model:", model);
  
  try {
    // Create a reference to the user's transcripts subcollection
    const transcriptsRef = collection(db, "users", user.uid, "transcripts");

    // Add a new transcript document with the transcript text and a timestamp
    const documentData = {
      transcript,
      createdAt: new Date().toISOString(),
    };
    
    // Add topic, mode, activityType, grades, and model if provided
    if (topic) documentData.topic = topic;
    if (mode) documentData.mode = mode;
    if (activityType) documentData.activityType = activityType;
    if (grades) documentData.grades = grades;
    if (model) documentData.model = model;
    
    // Debug logging
    console.log("Document data to save:", documentData);

    await addDoc(transcriptsRef, documentData);
    console.log(`${activityType || mode || 'Activity'} saved successfully!`);
  } catch (error) {
    console.error("Error saving transcript:", error);
  }
};