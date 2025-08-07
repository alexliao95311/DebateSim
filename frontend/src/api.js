import axios from "axios";

// Adjust the URL if using a custom port or domain
// Use the environment variable; default to local URL if not set
// frontend/src/api.js
const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
export default API_URL;

// Configure axios with optimized settings
const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 120000, // 2 minutes timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for optimization
apiClient.interceptors.request.use((config) => {
  // Add timestamp to prevent caching
  config.headers['X-Request-Time'] = Date.now();
  return config;
});

// Add response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED') {
      console.error('Request timeout - AI model may be slow');
    }
    return Promise.reject(error);
  }
);

export const generateAIResponse = async (debater, prompt, model, billDescription = '', fullTranscript = '') => {
  try {
    console.log(`🚀 Generating AI response for ${debater} using ${model}`);
    console.log(`🔍 DEBUG [frontend]: Full transcript length: ${fullTranscript.length} chars`);
    console.log(`🔍 DEBUG [frontend]: Bill description length: ${billDescription.length} chars`);
    console.log(`🔍 DEBUG [frontend]: Prompt: ${prompt}`);
    if (fullTranscript) {
      console.log(`🔍 DEBUG [frontend]: Full transcript preview: ${fullTranscript.substring(0, 300)}...`);
    }
    
    const startTime = Date.now();
    
    const response = await apiClient.post('/generate-response', {
      debater,
      prompt,
      model, // Pass along the chosen model
      bill_description: billDescription, // Pass bill text for evidence-based arguments
      full_transcript: fullTranscript, // Pass the full debate transcript for context
    });
    
    const duration = Date.now() - startTime;
    console.log(`✅ AI response generated in ${duration}ms`);
    
    return response.data.response;
  } catch (error) {
    console.error("Error generating AI response:", error);
    throw error;
  }
};

export const getAIJudgeFeedback = async (transcript, model) => {
  try {
    console.log(`🏛️ Generating judge feedback using ${model}`);
    const startTime = Date.now();
    
    const response = await apiClient.post('/judge-feedback', {
      transcript,
      model, // Pass along the chosen judge model
    });
    
    const duration = Date.now() - startTime;
    console.log(`✅ Judge feedback generated in ${duration}ms`);
    
    return response.data.response;
  } catch (error) {
    console.error("Error fetching AI judge feedback:", error);
    throw error;
  }
};

export const saveTranscript = async (transcript, topic, mode, judgeFeedback) => {
  try {
    const response = await apiClient.post('/save-transcript', {
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