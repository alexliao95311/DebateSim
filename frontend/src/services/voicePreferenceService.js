// Voice Preference Service
// Centralized service for managing user voice preferences across the app

import { getFirestore, doc, getDoc } from 'firebase/firestore';

class VoicePreferenceService {
  constructor() {
    this.currentVoice = 'en-US-Chirp3-HD-Achernar'; // Default voice
    this.isLoaded = false;
    this.listeners = new Set();
  }

  // Load voice preference for the current user
  async loadVoicePreference(user) {
    if (!user) {
      // For guests, try localStorage
      const savedVoice = localStorage.getItem('tts-voice-preference');
      if (savedVoice) {
        this.currentVoice = savedVoice;
      }
      this.isLoaded = true;
      this.notifyListeners();
      return this.currentVoice;
    }

    if (user.isGuest) {
      // Guest user - use localStorage
      const savedVoice = localStorage.getItem('tts-voice-preference');
      if (savedVoice) {
        this.currentVoice = savedVoice;
      }
      this.isLoaded = true;
      this.notifyListeners();
      return this.currentVoice;
    }

    try {
      // Authenticated user - load from Firestore
      const db = getFirestore();
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.voicePreference) {
          this.currentVoice = userData.voicePreference;
        }
      }
    } catch (error) {
      console.error('Error loading voice preference:', error);
      // Fallback to localStorage
      const savedVoice = localStorage.getItem('tts-voice-preference');
      if (savedVoice) {
        this.currentVoice = savedVoice;
      }
    }

    this.isLoaded = true;
    this.notifyListeners();
    return this.currentVoice;
  }

  // Get current voice preference
  getCurrentVoice() {
    return this.currentVoice;
  }

  // Set voice preference (used when user changes it in settings)
  setCurrentVoice(voiceId) {
    this.currentVoice = voiceId;
    this.notifyListeners();
  }

  // Check if voice preference has been loaded
  isVoiceLoaded() {
    return this.isLoaded;
  }

  // Add listener for voice preference changes
  addListener(callback) {
    this.listeners.add(callback);
  }

  // Remove listener
  removeListener(callback) {
    this.listeners.delete(callback);
  }

  // Notify all listeners when voice changes
  notifyListeners() {
    this.listeners.forEach(callback => {
      try {
        callback(this.currentVoice);
      } catch (error) {
        console.error('Error in voice preference listener:', error);
      }
    });
  }

  // Get voice settings for TTS requests
  getVoiceSettings() {
    return {
      voice_name: this.currentVoice,
      rate: 1.0,
      pitch: 0,
      volume: 1.0
    };
  }
}

// Create singleton instance
const voicePreferenceService = new VoicePreferenceService();

export default voicePreferenceService;