import React, { useState } from "react";
import "./FeedbackModal.css";

export default function FeedbackModal({ onClose }) {
  const [feedback, setFeedback] = useState("");
  const [status, setStatus] = useState(null);

  const submitFeedback = async () => {
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: feedback, page: "Legislation" }),
      });
      setStatus(res.ok ? "success" : "error");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="modal">
      <div className="modal-content">
        <h2>Send Feedback</h2>
        <textarea
          rows="6"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="What would you like to share?"
        />
        <button onClick={submitFeedback}>Submit</button>
        <button onClick={onClose}>Cancel</button>
        {status === "success" && <p>✅ Sent. Thank you!</p>}
        {status === "error" && <p>❌ Something went wrong.</p>}
      </div>
    </div>
  );
}
