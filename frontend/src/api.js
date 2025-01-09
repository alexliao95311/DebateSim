import axios from "axios";

const API_URL = "http://127.0.0.1:8000"; // Backend URL

export const getAIResponse = async (debater, prompt) => {
  try {
    const response = await axios.post(`${API_URL}/generate-response`, {
      debater,
      prompt,
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching AI response:", error);
    throw error;
  }
};

export const getAIJudgeFeedback = async (transcript) => {
  try {
    const response = await axios.post(`${API_URL}/judge-debate`, { transcript });
    return response.data;
  } catch (error) {
    console.error("Error fetching AI judge feedback:", error);
    throw error;
  }
};

export const saveTranscript = async (transcript, topic, mode) => {
  try {
    const response = await axios.post(`${API_URL}/save-transcript`, {
      transcript,
      topic,
      mode,
    });
    return response.data;
  } catch (error) {
    console.error("Error saving transcript:", error);
    throw error;
  }
};