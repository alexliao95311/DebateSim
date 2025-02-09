import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import { app } from "./firebaseConfig"; // adjust if you export app from firebaseConfig.js

const db = getFirestore(app);

export const createUserDocument = async (user) => {
  if (!user) return;
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);
  // If user doc doesn't exist, create it.
  if (!userSnap.exists()) {
    await setDoc(userRef, {
      displayName: user.displayName,
      email: user.email,
      createdAt: new Date().toISOString(),
    });
    console.log("User document created for", user.displayName);
  } else {
    console.log("User document exists for", user.displayName);
  }
};