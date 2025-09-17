// TTS Configuration for DebateSim
// This file centralizes all TTS settings and makes it easy to change voices

export const TTS_CONFIG = {
  // Google TTS API settings - now consolidated with main backend
  apiUrl: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000',
  
  // TTS endpoint paths
  endpoints: {
    health: '/tts/health',
    voices: '/tts/voices',
    synthesize: '/tts/synthesize',
    test: '/tts/test'
  },
  
  // Default voice selection
  defaultVoice: 'en-US-Chirp3-HD-Achernar', // High-quality Chirp3 voice
  
  // Alternative voices for different use cases
  voices: {
    // Male voices - good for formal debates
    male: {
      default: 'en-US-Neural2-A',      // Deep, authoritative
      alternative: 'en-US-Neural2-D',   // Clear, professional
      energetic: 'en-US-Neural2-I'     // Dynamic, engaging
    },
    
    // Female voices - good for variety and different perspectives
    female: {
      default: 'en-US-Neural2-C',      // Clear, articulate
      alternative: 'en-US-Neural2-E',   // Warm, approachable
      professional: 'en-US-Neural2-F'   // Confident, authoritative
    }
  },
  
  // Voice settings for different contexts
  contexts: {
    debate: {
      voice: 'en-US-Chirp3-HD-Achernar',  // High-quality Chirp3 voice for debates
      rate: 1.0,                           // Regular speed
      pitch: 0,                            // Neutral pitch
      volume: 1.0                          // Full volume
    },
    
    analysis: {
      voice: 'en-US-Chirp3-HD-Achernar',  // High-quality Chirp3 voice for analysis
      rate: 1.0,                           // Regular speed
      pitch: 0,                            // Neutral pitch
      volume: 1.0                          // Full volume
    },
    
    general: {
      voice: 'en-US-Chirp3-HD-Achernar',  // High-quality Chirp3 voice as default
      rate: 1.0,                           // Regular speed
      pitch: 0,                            // Neutral pitch
      volume: 1.0                          // Full volume
    },
    
    judge: {
      voice: 'en-US-Chirp3-HD-Achernar',  // High-quality Chirp3 voice for judge feedback
      rate: 1.0,                           // Regular speed
      pitch: 0,                            // Neutral pitch
      volume: 1.0                          // Full volume
    }
  },
  
  // Fallback settings
  fallback: {
    enabled: true,                     // Enable browser TTS fallback
    voice: 'default',                  // Use browser's default voice
    rate: 0.9,                         // Slightly slower
    pitch: 1,                          // Normal pitch
    volume: 1                          // Full volume
  }
};

// Helper function to get voice for context with user preference
export const getVoiceForContext = (context = 'general', userVoice = null) => {
  const contextConfig = TTS_CONFIG.contexts[context] || TTS_CONFIG.contexts.general;

  // If user has a voice preference, use it; otherwise use context default
  if (userVoice) {
    return {
      ...contextConfig,
      voice: userVoice
    };
  }

  return contextConfig;
};

// Helper function to get all available voices
export const getAvailableVoices = () => {
  return TTS_CONFIG.voices;
};

// Helper function to get default voice
export const getDefaultVoice = () => {
  return TTS_CONFIG.defaultVoice;
};

// Helper function to get full endpoint URLs
export const getTTSEndpoint = (endpoint) => {
  return `${TTS_CONFIG.apiUrl}${TTS_CONFIG.endpoints[endpoint]}`;
};

export default TTS_CONFIG;
