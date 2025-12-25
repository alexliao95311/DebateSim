// Language Preference Service
// Centralized service for managing user language preferences across the app

import { getFirestore, doc, getDoc } from 'firebase/firestore';

class LanguagePreferenceService {
  constructor() {
    this.currentLanguage = 'en'; // Default language: English
    this.isLoaded = false;
    this.listeners = new Set();
  }

  // Load language preference for the current user
  async loadLanguagePreference(user) {
    if (!user) {
      // For guests, try localStorage
      const savedLanguage = localStorage.getItem('language-preference');
      if (savedLanguage) {
        this.currentLanguage = savedLanguage;
      }
      this.isLoaded = true;
      this.notifyListeners();
      return this.currentLanguage;
    }

    if (user.isGuest) {
      // Guest user - use localStorage
      const savedLanguage = localStorage.getItem('language-preference');
      if (savedLanguage) {
        this.currentLanguage = savedLanguage;
      }
      this.isLoaded = true;
      this.notifyListeners();
      return this.currentLanguage;
    }

    try {
      // Authenticated user - load from Firestore
      const db = getFirestore();
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.languagePreference) {
          this.currentLanguage = userData.languagePreference;
        }
      }
    } catch (error) {
      console.error('Error loading language preference:', error);
      // Fallback to localStorage
      const savedLanguage = localStorage.getItem('language-preference');
      if (savedLanguage) {
        this.currentLanguage = savedLanguage;
      }
    }

    this.isLoaded = true;
    this.notifyListeners();
    return this.currentLanguage;
  }

  // Get current language preference
  getCurrentLanguage() {
    return this.currentLanguage;
  }

  // Set language preference (used when user changes it in settings)
  setCurrentLanguage(languageCode) {
    this.currentLanguage = languageCode;
    // Also update localStorage to ensure persistence
    localStorage.setItem('language-preference', languageCode);
    this.notifyListeners();
  }

  // Check if language preference has been loaded
  isLanguageLoaded() {
    return this.isLoaded;
  }

  // Add listener for language preference changes
  addListener(callback) {
    this.listeners.add(callback);
  }

  // Remove listener
  removeListener(callback) {
    this.listeners.delete(callback);
  }

  // Notify all listeners when language changes
  notifyListeners() {
    this.listeners.forEach(callback => {
      try {
        callback(this.currentLanguage);
      } catch (error) {
        console.error('Error in language preference listener:', error);
      }
    });
  }

  // Get language name from code
  getLanguageName(code) {
    const languages = {
      'en': 'English',
      'zh': 'Mandarin Chinese'
    };
    return languages[code] || 'English';
  }
}

// Create singleton instance
const languagePreferenceService = new LanguagePreferenceService();

export default languagePreferenceService;

