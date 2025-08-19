// Google Cloud Text-to-Speech Service
// Provides high-quality, natural-sounding voices

class GoogleTTSService {
  constructor() {
    this.apiKey = process.env.REACT_APP_GOOGLE_CLOUD_API_KEY;
    this.baseUrl = 'https://texttospeech.googleapis.com/v1/text:synthesize';
    this.voices = [
      {
        name: 'en-US-Neural2-A',
        language: 'en-US',
        gender: 'FEMALE',
        description: 'Natural female voice (Neural2)'
      },
      {
        name: 'en-US-Neural2-C',
        language: 'en-US',
        gender: 'MALE',
        description: 'Natural male voice (Neural2)'
      },
      {
        name: 'en-US-Neural2-D',
        language: 'en-US',
        gender: 'MALE',
        description: 'Natural male voice (Neural2)'
      },
      {
        name: 'en-US-Neural2-E',
        language: 'en-US',
        gender: 'FEMALE',
        description: 'Natural female voice (Neural2)'
      },
      {
        name: 'en-US-Neural2-F',
        language: 'en-US',
        gender: 'FEMALE',
        description: 'Natural female voice (Neural2)'
      },
      {
        name: 'en-US-Neural2-G',
        language: 'en-US',
        gender: 'MALE',
        description: 'Natural male voice (Neural2)'
      },
      {
        name: 'en-US-Neural2-H',
        language: 'en-US',
        gender: 'FEMALE',
        description: 'Natural female voice (Neural2)'
      },
      {
        name: 'en-US-Neural2-I',
        language: 'en-US',
        gender: 'MALE',
        description: 'Natural male voice (Neural2)'
      },
      {
        name: 'en-US-Neural2-J',
        language: 'en-US',
        gender: 'MALE',
        description: 'Natural male voice (Neural2)'
      }
    ];
    
    this.defaultVoice = 'en-US-Neural2-A';
    this.currentVoice = this.defaultVoice;
  }

  // Get available voices
  getAvailableVoices() {
    return this.voices;
  }

  // Set current voice
  setVoice(voiceName) {
    const voice = this.voices.find(v => v.name === voiceName);
    if (voice) {
      this.currentVoice = voiceName;
      return true;
    }
    return false;
  }

  // Get current voice
  getCurrentVoice() {
    return this.voices.find(v => v.name === this.currentVoice);
  }

  // Synthesize speech using Google Cloud TTS
  async synthesizeSpeech(text, options = {}) {
    if (!this.apiKey) {
      throw new Error('Google Cloud API key not configured. Set REACT_APP_GOOGLE_CLOUD_API_KEY environment variable.');
    }

    const {
      voice = this.currentVoice,
      rate = 1.0,
      pitch = 0.0,
      volume = 1.0,
      audioEncoding = 'MP3'
    } = options;

    const requestBody = {
      input: { text },
      voice: {
        languageCode: 'en-US',
        name: voice,
        ssmlGender: 'NEUTRAL'
      },
      audioConfig: {
        audioEncoding,
        speakingRate: rate,
        pitch: pitch,
        volumeGainDb: volume > 0 ? Math.log10(volume) * 20 : -96,
        effectsProfileId: ['headphone-class-device'] // Optimized for headphones
      }
    };

    try {
      const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Google TTS API error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return data.audioContent; // Base64 encoded audio
    } catch (error) {
      console.error('Google TTS synthesis error:', error);
      throw error;
    }
  }

  // Play synthesized speech
  async playSpeech(text, options = {}) {
    try {
      const audioContent = await this.synthesizeSpeech(text, options);
      
      // Convert base64 to audio blob
      const audioBlob = new Blob(
        [Uint8Array.from(atob(audioContent), c => c.charCodeAt(0))],
        { type: 'audio/mp3' }
      );
      
      // Create audio element and play
      const audio = new Audio(URL.createObjectURL(audioBlob));
      
      return new Promise((resolve, reject) => {
        audio.onended = () => resolve();
        audio.onerror = (error) => reject(error);
        audio.play().catch(reject);
      });
    } catch (error) {
      console.error('Error playing speech:', error);
      throw error;
    }
  }

  // Fallback to browser TTS if Google TTS fails
  fallbackToBrowserTTS(text, options = {}) {
    if (!window.speechSynthesis) {
      throw new Error('Speech synthesis not supported in this browser');
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = options.rate || 0.9;
    utterance.pitch = options.pitch || 1;
    utterance.volume = options.volume || 1;

    // Try to find a good voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => 
      v.lang.startsWith('en-US') && 
      (v.name.includes('Neural') || v.name.includes('Premium') || v.name.includes('Enhanced'))
    );
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    window.speechSynthesis.speak(utterance);
    
    return new Promise((resolve, reject) => {
      utterance.onend = resolve;
      utterance.onerror = reject;
    });
  }
}

export default GoogleTTSService;
