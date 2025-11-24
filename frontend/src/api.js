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

export const generateAIResponse = async (debater, prompt, model, billDescription = '', fullTranscript = '', roundNum = 1, persona = 'default', debateFormat = 'default', speakingOrder = 'pro-first') => {
  try {
    console.log(`🚀 Generating AI response for ${debater} using ${model} (Round ${roundNum})`);
    console.log(`🔍 DEBUG [frontend]: Full transcript length: ${fullTranscript.length} chars`);
    console.log(`🔍 DEBUG [frontend]: Bill description length: ${billDescription.length} chars`);
    console.log(`🔍 DEBUG [frontend]: Round number: ${roundNum}`);
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
      round_num: roundNum, // Pass the current round number
      persona: persona, // Pass the persona name for logging
      debate_format: debateFormat, // Pass the debate format
      speaking_order: speakingOrder, // Pass the speaking order for public forum
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

// Dedicated Trainer: Speech Efficiency Analysis (separate chain)
export const analyzeSpeechEfficiency = async (speech, options = {}) => {
  try {
    const payload = {
      speech,
      // Allow passing a model or fall back to a safe default
      model: options.model || "openai/gpt-4o-mini",
      // Optional flags to make backend select non-debate pipeline
      mode: "trainer-speech-efficiency",
      persona: "none",
      debate_format: options.debate_format || "none",
      speaking_order: "none",
      round_num: options.round_num || 0,
      speech_type: options.speech_type || "",
      speech_number: options.speech_number || 0,
    };
    const response = await apiClient.post('/trainer/speech-efficiency', payload);
    if (!response?.data || typeof response.data.response !== 'string') {
      throw new Error('Invalid response from server');
    }
    return response.data.response;
  } catch (error) {
    // Normalize axios error details
    const status = error?.response?.status;
    const detail = error?.response?.data?.detail || error?.message || 'Unknown error';
    console.error("Error analyzing speech efficiency:", status, detail);
    const err = new Error(`Analyze failed${status ? ` (${status})` : ''}: ${detail}`);
    err.status = status;
    err.detail = detail;
    throw err;
  }
};