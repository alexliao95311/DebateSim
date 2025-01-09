import React, { useState } from "react";
import Home from "./components/Home";
import Debate from "./components/Debate";

function App() {
  const [mode, setMode] = useState("");
  const [topic, setTopic] = useState("");

  const handleEndDebate = () => {
    alert("Debate ended. Judging will follow.");
  };

  return (
    <div>
      {!mode ? (
        <Home setMode={setMode} setTopic={setTopic} />
      ) : (
        <Debate mode={mode} topic={topic} endDebate={handleEndDebate} />
      )}
    </div>
  );
}

export default App;