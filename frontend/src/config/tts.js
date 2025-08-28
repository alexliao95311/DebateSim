// TTS Configuration for DebateSim
// This file centralizes all TTS settings and makes it easy to change voices

export const TTS_CONFIG = {
  // Google TTS API settings - now consolidated with main backend
  apiUrl: 'http://localhost:8000',
  
  // TTS endpoint paths
  endpoints: {
    health: '/tts/health',
    voices: '/tts/voices',
    synthesize: '/tts/synthesize',
    test: '/tts/test'
  },
  
  // Default voice selection
  defaultVoice: 'en-US-Neural2-C', // Female voice - clear and articulate
  
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
      voice: 'en-US-Neural2-C',        // Female voice - clear for debates
      rate: 0.9,                       // Slightly slower for comprehension
      pitch: 0,                        // Neutral pitch
      volume: 1.0                      // Full volume
    },
    
    analysis: {
      voice: 'en-US-Neural2-C',        // Female voice - clear for analysis
      rate: 0.85,                      // Slower for complex content
      pitch: 0,                        // Neutral pitch
      volume: 1.0                      // Full volume
    },
    
    general: {
      voice: 'en-US-Neural2-C',        // Default female voice
      rate: 1.0,                       // Normal speed
      pitch: 0,                        // Neutral pitch
      volume: 1.0                      // Full volume
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

// Helper function to get voice for context
export const getVoiceForContext = (context = 'general') => {
  return TTS_CONFIG.contexts[context] || TTS_CONFIG.contexts.general;
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
