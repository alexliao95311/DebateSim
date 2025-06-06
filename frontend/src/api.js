import axios from "axios";

// Adjust the URL if using a custom port or domain
// Use the environment variable; default to local URL if not set
// frontend/src/api.js
const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
export default API_URL;

export const generateAIResponse = async (debater, prompt, model) => {
  try {
    const response = await axios.post(`${API_URL}/generate-response`, {
      debater,
      prompt,
      model, // Pass along the chosen model
    });
    return response.data.response;
  } catch (error) {
    console.error("Error generating AI response:", error);
    throw error;
  }
};

export const getAIJudgeFeedback = async (transcript, model) => {
  try {
    const response = await axios.post(`${API_URL}/judge-debate`, {
      transcript,
      model, // Pass along the chosen judge model
    });
    return response.data.feedback;
  } catch (error) {
    console.error("Error fetching AI judge feedback:", error);
    throw error;
  }
};

export const saveTranscript = async (transcript, topic, mode, judgeFeedback) => {
  try {
    const response = await axios.post(`${API_URL}/save-transcript`, {
      transcript,
      topic,
      mode,
      judge_feedback: judgeFeedback, // Include judge feedback
    });
    return response.data.message;
  } catch (error) {
    console.error("Error saving transcript:", error);
    throw error;
  }
};