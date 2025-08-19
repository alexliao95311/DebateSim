import React, { useState, useRef, useEffect } from 'react';
import { TTS_CONFIG, getVoiceForContext, getTTSEndpoint } from '../config/tts';
import './VoiceOutput.css';

// Function to strip markdown syntax from text
const stripMarkdown = (text) => {
  if (!text) return '';
  
  return text
    // Remove headers (###, ##, #)
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold/italic markers (**text**, *text*)
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    // Remove code blocks (```code```)
    .replace(/```[\s\S]*?```/g, '')
    // Remove inline code (`code`)
    .replace(/`([^`]+)`/g, '$1')
    // Remove links [text](url)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove images ![alt](url)
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    // Remove horizontal rules (---, ***)
    .replace(/^[-*_]{3,}$/gm, '')
    // Remove blockquotes (> text)
    .replace(/^>\s+/gm, '')
    // Remove list markers (- item, * item, 1. item)
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    // Remove emphasis markers (_text_)
    .replace(/_(.*?)_/g, '$1')
    // Remove strikethrough (~~text~~)
    .replace(/~~(.*?)~~/g, '$1')
    // Clean up extra whitespace
    .replace(/\n\s*\n/g, '\n')
    .replace(/\s+/g, ' ')
    .trim();
};

// Function to add pauses after headings
const addHeadingPauses = (text) => {
  if (!text) return '';
  
  // Add pauses after numbered headings (1., 2., etc.) and other headings
  return text
    // Add pause after numbered headings like "1. Heading"
    .replace(/(\d+\.\s+[^\n]+)/g, '$1... [PAUSE]')
    // Add pause after markdown headers
    .replace(/(#{1,6}\s+[^\n]+)/g, '$1... [PAUSE]')
    // Add pause after standalone headings (lines that end with colon or are all caps)
    .replace(/([A-Z][A-Z\s]+:?)\n/g, '$1... [PAUSE]\n')
    // Add pause after debate structure markers
    .replace(/(Opening Statement|Closing Statement|Rebuttal|Cross-Examination|Summary)/gi, '$1... [PAUSE]');
};

const EnhancedVoiceOutput = ({ 
  text, 
  disabled = false, 
  showLabel = false, 
  buttonStyle = 'default',
  onSpeechStart = null,
  onSpeechEnd = null,
  onSpeechError = null,
  useGoogleTTS = true,
  ttsApiUrl = TTS_CONFIG.apiUrl,
  defaultVoice = null,
  context = 'general'
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSupported, setIsSupported] = useState(true);
  const [isGoogleTTSAvailable, setIsGoogleTTSAvailable] = useState(false);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(defaultVoice || getVoiceForContext(context).voice);
  const [showVoiceSelector, setShowVoiceSelector] = useState(false);
  
  const utteranceRef = useRef(null);
  const synthRef = useRef(null);
  const audioRef = useRef(null);
  const currentAudioUrl = useRef(null);

  // Initialize speech synthesis
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
      setIsSupported(true);
    } else {
      setIsSupported(false);
      setError('Text-to-speech is not supported in this browser');
    }

    if (useGoogleTTS) {
      initializeGoogleTTS();
    }

    // Cleanup on unmount
    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      // Clean up any existing audio URLs
      if (currentAudioUrl.current) {
        URL.revokeObjectURL(currentAudioUrl.current);
      }
    };
  }, [useGoogleTTS, ttsApiUrl, defaultVoice, selectedVoice]);

  // Update selectedVoice when defaultVoice changes
  useEffect(() => {
    if (defaultVoice && defaultVoice !== selectedVoice) {
      setSelectedVoice(defaultVoice);
    }
  }, [defaultVoice, selectedVoice]);

  const initializeGoogleTTS = async () => {
    try {
      const healthResponse = await fetch(getTTSEndpoint('health'));
      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        if (healthData.status === 'healthy') {
          setIsGoogleTTSAvailable(true);
          
          // Fetch available voices
          const voicesResponse = await fetch(getTTSEndpoint('voices'));
          if (voicesResponse.ok) {
            const voicesData = await voicesResponse.json();
            setAvailableVoices(voicesData.voices);
            
            // Set default voice if not already set
            if (!selectedVoice) {
              setSelectedVoice(voicesData.default_voice);
            }
          }
        }
      }
    } catch (err) {
      console.log('Google TTS not available, falling back to browser TTS:', err);
      setIsGoogleTTSAvailable(false);
    }
  };

  // Handle speech synthesis events
  const setupUtteranceEvents = (utterance) => {
    utterance.onstart = () => {
      setIsPlaying(true);
      setIsPaused(false);
      setIsLoading(false);
      setError('');
      if (onSpeechStart) onSpeechStart();
    };

    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
      setIsLoading(false);
      if (onSpeechEnd) onSpeechEnd();
    };

    utterance.onerror = (event) => {
      setIsPlaying(false);
      setIsPaused(false);
      setIsLoading(false);
      const errorMessage = `Speech error: ${event.error}`;
      setError(errorMessage);
      if (onSpeechError) onSpeechError(event.error);
      console.error('Speech synthesis error:', event);
    };

    utterance.onpause = () => {
      setIsPaused(true);
    };

    utterance.onresume = () => {
      setIsPaused(false);
    };
  };

  const handlePlay = async () => {
    if (!isSupported || !text) {
      setError('Cannot play speech: text-to-speech not available');
      return;
    }

    try {
      // Clear any previous errors
      setError('');
      
      // Stop any current speech
      if (synthRef.current) {
        synthRef.current.cancel();
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }

      // Clean up any existing audio URLs
      if (currentAudioUrl.current) {
        URL.revokeObjectURL(currentAudioUrl.current);
        currentAudioUrl.current = null;
      }

      // Clean the text by removing markdown syntax and add heading pauses
      const cleanText = stripMarkdown(text);
      const textWithPauses = addHeadingPauses(cleanText);

      // Set loading state
      setIsLoading(true);

      // Try Google TTS first if available
      if (useGoogleTTS && isGoogleTTSAvailable) {
        try {
          const success = await playGoogleTTS(textWithPauses);
          if (success) return;
        } catch (googleTTSError) {
          console.log('Google TTS failed, falling back to browser TTS:', googleTTSError);
          // Fall through to browser TTS
        }
      }

      // Fallback to browser TTS
      if (synthRef.current) {
        const utterance = new SpeechSynthesisUtterance(textWithPauses);
        utteranceRef.current = utterance;
        
        // Configure speech settings from context
        const contextSettings = getVoiceForContext(context);
        utterance.rate = contextSettings.rate;
        utterance.pitch = contextSettings.pitch;
        utterance.volume = contextSettings.volume;
        
        // Set up event handlers
        setupUtteranceEvents(utterance);
        
        // Start speaking
        synthRef.current.speak(utterance);
      }
      
    } catch (err) {
      const errorMessage = `Failed to start speech: ${err.message}`;
      setError(errorMessage);
      setIsLoading(false);
      if (onSpeechError) onSpeechError(err.message);
      console.error('Speech synthesis error:', err);
    }
  };

  const playGoogleTTS = async (text) => {
    try {
      const contextSettings = getVoiceForContext(context);
      
      const response = await fetch(getTTSEndpoint('synthesize'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          voice_name: selectedVoice,
          rate: contextSettings.rate,
          pitch: contextSettings.pitch,
          volume: contextSettings.volume
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && data.audio_content) {
        // Convert base64 to audio and play
        const audioBlob = new Blob([
          Uint8Array.from(atob(data.audio_content), c => c.charCodeAt(0))
        ], { type: 'audio/mp3' });
        
        const audioUrl = URL.createObjectURL(audioBlob);
        currentAudioUrl.current = audioUrl;
        
        if (audioRef.current) {
          audioRef.current.src = audioUrl;
          audioRef.current.onloadedmetadata = () => {
            audioRef.current.play();
            setIsPlaying(true);
            setIsLoading(false);
            if (onSpeechStart) onSpeechStart();
          };
          
          audioRef.current.onended = () => {
            setIsPlaying(false);
            setIsLoading(false);
            if (onSpeechEnd) onSpeechEnd();
            // Clean up audio URL
            if (currentAudioUrl.current === audioUrl) {
              URL.revokeObjectURL(audioUrl);
              currentAudioUrl.current = null;
            }
          };
          
          // Only show error for actual audio playback failures, not normal stops
          audioRef.current.onerror = () => {
            // Only show error if we're actually trying to play, not when stopping
            if (isPlaying && !isLoading) {
              setIsPlaying(false);
              setIsLoading(false);
              setError('Audio playback failed');
              if (onSpeechError) onSpeechError('Audio playback failed');
            }
            // Clean up audio URL
            if (currentAudioUrl.current === audioUrl) {
              URL.revokeObjectURL(audioUrl);
              currentAudioUrl.current = null;
            }
          };
        }
        
        return true;
      } else {
        throw new Error(data.error || 'Failed to synthesize speech');
      }
    } catch (error) {
      console.error('Google TTS error:', error);
      throw error;
    }
  };

  const handlePause = () => {
    if (audioRef.current && isPlaying) {
      audioRef.current.pause();
      setIsPaused(true);
    } else if (synthRef.current && isPlaying) {
      synthRef.current.pause();
    }
  };

  const handleResume = () => {
    if (audioRef.current && isPaused) {
      audioRef.current.play();
      setIsPaused(false);
    } else if (synthRef.current && isPaused) {
      synthRef.current.resume();
    }
  };

  const handleStop = () => {
    // Clear loading state
    setIsLoading(false);
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    
    // Clean up audio URL
    if (currentAudioUrl.current) {
      URL.revokeObjectURL(currentAudioUrl.current);
      currentAudioUrl.current = null;
    }
    
    setIsPlaying(false);
    setIsPaused(false);
    // Don't clear errors here - let them persist if they're real errors
    
    if (onSpeechEnd) onSpeechEnd();
  };

  // Don't render if not supported
  if (!isSupported) {
    return null;
  }

  // Don't render if no text provided
  if (!text || text.trim().length === 0) {
    return null;
  }

  const getButtonClass = () => {
    switch (buttonStyle) {
      case 'compact':
        return 'voice-output-button-compact';
      case 'large':
        return 'voice-output-button-large';
      default:
        return 'voice-output-button-default';
    }
  };

  return (
    <div className={`voice-output-container ${isLoading ? 'voice-output-loading' : ''}`}>
      {/* Voice Selector - Improved dropdown design */}
      {useGoogleTTS && isGoogleTTSAvailable && availableVoices.length > 1 && (
        <div className="voice-selector-container">
          <button
            onClick={() => setShowVoiceSelector(!showVoiceSelector)}
            className="voice-selector-toggle"
            title="Select voice"
            aria-label="Select TTS voice"
            aria-expanded={showVoiceSelector}
            disabled={isLoading}
          >
            <span className="voice-selector-icon">🎭</span>
            <span className="voice-selector-text">{selectedVoice}</span>
            <span className="voice-selector-arrow">▼</span>
          </button>
          
          {showVoiceSelector && (
            <div className="voice-selector-dropdown">
              {availableVoices.map((voice) => (
                <button
                  key={voice.name}
                  onClick={() => {
                    setSelectedVoice(voice.name);
                    setShowVoiceSelector(false);
                  }}
                  className={`voice-option ${voice.name === selectedVoice ? 'selected' : ''}`}
                >
                  <span className="voice-gender-icon">
                    {voice.gender === 'FEMALE' ? '👩' : '👨'}
                  </span>
                  <span className="voice-name">{voice.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="voice-output-controls">
        {!isPlaying && !isLoading ? (
          <button
            onClick={handlePlay}
            disabled={disabled}
            className={`voice-output-play-button ${getButtonClass()}`}
            title="Play speech"
            aria-label="Play text as speech"
          >
            <span className="voice-button-icon">▶️</span>
            {showLabel && <span className="voice-output-label">Play</span>}
          </button>
        ) : isLoading ? (
          <button
            disabled={true}
            className={`voice-output-play-button ${getButtonClass()}`}
            title="Loading speech..."
            aria-label="Loading speech"
          >
            <span className="voice-button-icon">⏳</span>
            {showLabel && <span className="voice-output-label">Loading...</span>}
          </button>
        ) : (
          <div className="voice-output-playing-controls">
            {isPaused ? (
              <button
                onClick={handleResume}
                disabled={disabled}
                className={`voice-output-resume-button ${getButtonClass()}`}
                title="Resume speech"
                aria-label="Resume speech"
              >
                <span className="voice-button-icon">▶️</span>
                {showLabel && <span className="voice-output-label">Resume</span>}
              </button>
            ) : (
              <button
                onClick={handlePause}
                disabled={disabled}
                className={`voice-output-pause-button ${getButtonClass()}`}
                title="Pause speech"
                aria-label="Pause speech"
              >
                <span className="voice-button-icon">⏸️</span>
                {showLabel && <span className="voice-output-label">Pause</span>}
              </button>
            )}
            
            <button
              onClick={handleStop}
              disabled={disabled}
              className={`voice-output-stop-button ${getButtonClass()}`}
              title="Stop speech"
              aria-label="Stop speech"
            >
              <span className="voice-button-icon">⏹️</span>
              {showLabel && <span className="voice-output-label">Stop</span>}
            </button>
          </div>
        )}
      </div>
      
      {/* Error Display - Improved styling */}
      {error && (
        <div className="voice-output-error">
          <span className="voice-output-error-text">{error}</span>
          <button 
            onClick={() => setError('')}
            className="voice-output-error-dismiss"
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}
      
      {/* Status Display - Better visual feedback */}
      {isPlaying && (
        <div className="voice-output-status">
          <span className="voice-output-indicator">
            🔊 {isPaused ? 'Paused' : 'Playing...'}
          </span>
        </div>
      )}

      {/* Hidden audio element for Google TTS */}
      <audio ref={audioRef} style={{ display: 'none' }} />
    </div>
  );
};

export default EnhancedVoiceOutput;
