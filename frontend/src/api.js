import axios from "axios";

// Adjust the URL if using a custom port or domain
const API_URL = "http://20.3.246.40:5000";

export const generateAIResponse = async (debater, prompt) => {
  try {
    const response = await axios.post(`${API_URL}/generate-response`, { debater, prompt });
    return response.data.response; // Ensure this matches the structure of your API response
  } catch (error) {
    console.error("Error generating AI response:", error);
    throw error;
  }
};

export const getAIJudgeFeedback = async (transcript) => {
  try {
    const response = await axios.post(`${API_URL}/judge-debate`, { transcript });
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
      judge_feedback: judgeFeedback, // Include judge feedback in the request
    });
    return response.data.message;
  } catch (error) {
    console.error("Error saving transcript:", error);
    throw error;
  }
};
