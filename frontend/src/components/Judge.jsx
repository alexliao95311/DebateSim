import React, { useEffect, useState } from "react";
import { getAIJudgeFeedback, saveTranscript } from "../api";

function Judge({ transcript, topic, mode }) {
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    const fetchFeedback = async () => {
      const result = await getAIJudgeFeedback(transcript);
      setFeedback(result);
    };
    fetchFeedback();
  }, [transcript]);

  const handleSaveTranscript = async () => {
    const message = await saveTranscript(transcript, topic, mode);
    alert(message);
  };

  return (
    <div>
      <h2>AI Judge Feedback</h2>
      <pre>{feedback}</pre>
      <button onClick={handleSaveTranscript}>Save Transcript</button>
    </div>
  );
}

export default Judge;