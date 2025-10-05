import React, { useState, useRef, useEffect } from 'react';
import EnhancedVoiceOutput from './EnhancedVoiceOutput';
import { TTS_CONFIG } from '../config/tts';
import './VoiceOutput.css';

const VoiceOutput = ({ 
  text, 
  disabled = false, 
  showLabel = false, 
  buttonStyle = 'default',
  onSpeechStart = null,
  onSpeechEnd = null,
  onSpeechError = null,
  useGoogleTTS = true,
  ttsApiUrl = TTS_CONFIG.apiUrl
}) => {
  // If Google TTS is enabled, use the enhanced component
  if (useGoogleTTS) {
    return (
      <EnhancedVoiceOutput
        text={text}
        disabled={disabled}
        showLabel={showLabel}
        buttonStyle={buttonStyle}
        onSpeechStart={onSpeechStart}
        onSpeechEnd={onSpeechEnd}
        onSpeechError={onSpeechError}
        useGoogleTTS={true}
        ttsApiUrl={ttsApiUrl}
      />
    );
  }

  // Fallback to original browser TTS implementation
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

  const handlePause = () => {
    if (synthRef.current && isPlaying) {
      synthRef.current.pause();
    }
  };

  const handleResume = () => {
    if (synthRef.current && isPaused) {
      synthRef.current.resume();
    }
  };

  const handleStop = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsPlaying(false);
      setIsPaused(false);
      if (onSpeechEnd) onSpeechEnd();
    }
  };

  // Browser TTS fallback UI
  if (!isSupported) {
    return (
      <div className="voice-output-error">
        <span>❌ TTS not supported</span>
        {error && <div className="error-message">{error}</div>}
      </div>
    );
  }

  if (disabled) {
    return (
      <div className="voice-output-disabled">
        <span>🔇 Disabled</span>
      </div>
    );
  }

  return (
    <div className="voice-output">
      {showLabel && <div className="voice-output-label">🔊</div>}
      
      <div className="voice-controls">
        {!isPlaying && !isPaused && (
          <button
            onClick={handlePlay}
            className="voice-button play-button"
            title="Play speech"
            aria-label="Play text as speech"
          >
            ▶️
          </button>
        )}
        
        {isPlaying && !isPaused && (
          <button
            onClick={handlePause}
            className="voice-button pause-button"
            title="Pause speech"
            aria-label="Pause speech"
          >
            ⏸️
          </button>
        )}
        
        {isPaused && (
          <button
            onClick={handleResume}
            className="voice-button resume-button"
            title="Resume speech"
            aria-label="Resume speech"
          >
            ▶️
          </button>
        )}
        
        {(isPlaying || isPaused) && (
          <button
            onClick={handleStop}
            className="voice-button stop-button"
            title="Stop speech"
            aria-label="Stop speech"
          >
            ⏹️
          </button>
        )}
      </div>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
    </div>
  );
};

export default VoiceOutput;