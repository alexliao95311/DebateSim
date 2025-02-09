import React, { useState, useEffect } from "react";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import Login from "./components/Login";
import Home from "./components/Home";
import Debate from "./components/Debate";
import Judge from "./components/Judge";

function App() {
  const [mode, setMode] = useState("");
  const [topic, setTopic] = useState("");
  const [transcript, setTranscript] = useState("");
  const [showJudge, setShowJudge] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [judgeModel, setJudgeModel] = useState(
    "mistralai/mistral-small-24b-instruct-2501"
  );

  const auth = getAuth();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [auth]);

  const handleEndDebate = () => setShowJudge(true);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setMode("");
      setTopic("");
      setTranscript("");
      setShowJudge(false);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <div>
      {!mode ? (
        <Home 
          user={user} 
          setMode={setMode} 
          setTopic={setTopic} 
          onLogout={handleLogout} 
        />
      ) : !showJudge ? (
        <Debate
          mode={mode}
          topic={topic}
          transcript={transcript}
          setTranscript={setTranscript}
          judgeModel={judgeModel}
          setJudgeModel={setJudgeModel}
          endDebate={handleEndDebate}
        />
      ) : (
        <Judge 
          transcript={transcript} 
          topic={topic} 
          mode={mode} 
          judgeModel={judgeModel}
        />
      )}
    </div>
  );
}

export default App;