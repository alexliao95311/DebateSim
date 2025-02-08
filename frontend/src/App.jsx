import React, { useState } from "react";
import Home from "./components/Home";
import Debate from "./components/Debate";
import Judge from "./components/Judge";

function App() {
  const [mode, setMode] = useState(""); // Debate mode
  const [topic, setTopic] = useState(""); // Debate topic
  const [transcript, setTranscript] = useState(""); // Full transcript
  const [showJudge, setShowJudge] = useState(false); // Toggle judging view

  // Lift judgeModel state so it’s available to both Debate and Judge
  const [judgeModel, setJudgeModel] = useState("mistralai/mistral-small-24b-instruct-2501");

  const handleEndDebate = () => setShowJudge(true); // End debate and show judging

  return (
    <div>
      {!mode ? (
        <Home setMode={setMode} setTopic={setTopic} />
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