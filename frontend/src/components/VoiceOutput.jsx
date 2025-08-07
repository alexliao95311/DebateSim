import React, { useState, useRef, useEffect } from 'react';
import './VoiceOutput.css';

const VoiceOutput = ({ 
  text, 
  disabled = false, 
  showLabel = false, 
  buttonStyle = 'default',
  onSpeechStart = null,
  onSpeechEnd = null,
  onSpeechError = null
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState('');
  const [isSupported, setIsSupported] = useState(true);
  const utteranceRef = useRef(null);
  const synthRef = useRef(null);

  // Initialize speech synthesis
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
      setIsSupported(true);
    } else {
      setIsSupported(false);
      setError('Text-to-speech is not supported in this browser');
    }

    // Cleanup on unmount
    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  // Handle speech synthesis events
  const setupUtteranceEvents = (utterance) => {
    utterance.onstart = () => {
      setIsPlaying(true);
      setIsPaused(false);
      setError('');
      if (onSpeechStart) onSpeechStart();
    };

    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
      if (onSpeechEnd) onSpeechEnd();
    };

    utterance.onerror = (event) => {
      setIsPlaying(false);
      setIsPaused(false);
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

  const handlePlay = () => {
    if (!isSupported || !text || !synthRef.current) {
      setError('Cannot play speech: text-to-speech not available');
      return;
    }

    try {
      // Stop any current speech
      synthRef.current.cancel();
      
      // Create new utterance
      const utterance = new SpeechSynthesisUtterance(text);
      utteranceRef.current = utterance;
      
      // Configure speech settings
      utterance.rate = 0.9; // Slightly slower for better comprehension
      utterance.pitch = 1;
      utterance.volume = 1;
      
      // Set up event handlers
      setupUtteranceEvents(utterance);
      
      // Start speaking
      synthRef.current.speak(utterance);
      
    } catch (err) {
      const errorMessage = `Failed to start speech: ${err.message}`;
      setError(errorMessage);
      if (onSpeechError) onSpeechError(err.message);
      console.error('Speech synthesis error:', err);
    }
  };

  const handleStop = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    setIsPlaying(false);
    setIsPaused(false);
    setError('');
  };

  const handlePause = () => {
    if (synthRef.current && isPlaying && !isPaused) {
      synthRef.current.pause();
    }
  };

  const handleResume = () => {
    if (synthRef.current && isPlaying && isPaused) {
      synthRef.current.resume();
    }
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
    <div className="voice-output-container">
      <div className="voice-output-controls">
        {!isPlaying ? (
          <button
            onClick={handlePlay}
            disabled={disabled}
            className={`voice-output-play-button ${getButtonClass()}`}
            title="Play speech"
            aria-label="Play text as speech"
          >
            <img 
              src="/images/play.png" 
              alt="Play" 
              className="voice-output-icon"
              onError={(e) => {
                // Fallback to emoji if image fails to load
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'inline';
              }}
            />
            <span className="voice-output-emoji-fallback" style={{ display: 'none' }}>
              🔊
            </span>
            {showLabel && <span className="voice-output-label">Play</span>}
          </button>
        ) : (
          <>
            {isPaused ? (
              <button
                onClick={handleResume}
                disabled={disabled}
                className={`voice-output-resume-button ${getButtonClass()}`}
                title="Resume speech"
                aria-label="Resume speech"
              >
                <img 
                  src="/images/play.png" 
                  alt="Resume" 
                  className="voice-output-icon"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'inline';
                  }}
                />
                <span className="voice-output-emoji-fallback" style={{ display: 'none' }}>
                  ▶️
                </span>
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
                <span className="voice-output-emoji">⏸️</span>
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
              <img 
                src="/images/stop.png" 
                alt="Stop" 
                className="voice-output-icon"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'inline';
                }}
              />
              <span className="voice-output-emoji-fallback" style={{ display: 'none' }}>
                ⏹️
              </span>
              {showLabel && <span className="voice-output-label">Stop</span>}
            </button>
          </>
        )}
      </div>
      
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
      
      {isPlaying && (
        <div className="voice-output-status">
          <span className="voice-output-indicator">
            🔊 {isPaused ? 'Paused' : 'Playing...'}
          </span>
        </div>
      )}
    </div>
  );
};

export default VoiceOutput;