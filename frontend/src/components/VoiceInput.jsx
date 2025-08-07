import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Loader2, HelpCircle } from 'lucide-react';
import VoiceInputTroubleshooting from './VoiceInputTroubleshooting';

const VoiceInput = ({ onTranscript, disabled = false, placeholder = "Click to start speaking..." }) => {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [displayTranscript, setDisplayTranscript] = useState(''); 
  const [finalTranscript, setFinalTranscript] = useState('');
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');
  const recognitionRef = useRef(null);
  const isInitializedRef = useRef(false);

  // Debug function to log information
  const logDebug = (message, data = null) => {
    const timestamp = new Date().toISOString();
    const debugMessage = `[${timestamp}] ${message}`;
    console.log(debugMessage, data);
    setDebugInfo(prev => prev + debugMessage + '\n');
  };

  const initializeSpeechRecognition = () => {
    if (isInitializedRef.current) {
      logDebug('SpeechRecognition already initialized');
      return true;
    }
    logDebug('Initializing SpeechRecognition');
    logDebug('User agent:', navigator.userAgent);
    logDebug('Browser language:', navigator.language);
    logDebug('Online status:', navigator.onLine);
    
    // Check if it's Brave browser
    const isBrave = navigator.userAgent.includes('Brave') || 
                    (navigator.brave && navigator.brave.isBrave());
    logDebug('Is Brave browser:', isBrave);
    
    // Check browser support
    const hasWebkitSpeechRecognition = 'webkitSpeechRecognition' in window;
    const hasSpeechRecognition = 'SpeechRecognition' in window;
    
    logDebug('SpeechRecognition support:', { hasWebkitSpeechRecognition, hasSpeechRecognition });
    
    if (!hasWebkitSpeechRecognition && !hasSpeechRecognition) {
      const errorMsg = 'Speech recognition is not supported in this browser. Please use Chrome or Edge.';
      logDebug('ERROR: ' + errorMsg);
      setError(errorMsg);
      return false;
    }

    // Initialize speech recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    logDebug('Using SpeechRecognition constructor:', SpeechRecognition.name);
    
    try {
      recognitionRef.current = new SpeechRecognition();
      logDebug('SpeechRecognition instance created successfully');
    } catch (err) {
      logDebug('ERROR: Failed to create SpeechRecognition instance:', err);
      setError(`Failed to initialize speech recognition: ${err.message}`);
      return false;
    }
    
    const recognition = recognitionRef.current;
    
    // Configure recognition
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;
    
    // Brave-specific settings
    if (isBrave) {
      logDebug('Applying Brave-specific settings');
      try {
        recognition.grammars = null; // Clear any grammars
        logDebug('Cleared grammars for Brave');
      } catch (err) {
        logDebug('Could not clear grammars:', err);
      }
    }
    
    logDebug('SpeechRecognition configured:', {
      continuous: recognition.continuous,
      interimResults: recognition.interimResults,
      lang: recognition.lang,
      maxAlternatives: recognition.maxAlternatives,
      isBrave: isBrave
    });

    recognition.onstart = () => {
      logDebug('SpeechRecognition started');
      setIsListening(true);
      setIsProcessing(false);
      setError('');
      setRetryCount(0);
    };

    recognition.onresult = (event) => {
      logDebug('SpeechRecognition result received:', {
        resultIndex: event.resultIndex,
        resultsLength: event.results.length
      });
      
      let newFinalTranscript = '';
      let newInterimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        const isFinal = result.isFinal;
        
        logDebug(`Result ${i}:`, { transcript, isFinal, confidence: result[0].confidence });
        
        if (isFinal) {
          newFinalTranscript += transcript;
        } else {
          newInterimTranscript += transcript;
        }
      }
      if (newFinalTranscript) {
        setFinalTranscript(prevFinal => {
          const updatedFinal = prevFinal + (prevFinal ? ' ' : '') + newFinalTranscript.trim();
          logDebug('Final transcript updated:', { prevFinal, newFinalTranscript, updatedFinal });
          
          // Also need the one that displays the transcript
          const newDisplay = updatedFinal + (newInterimTranscript ? (updatedFinal ? ' ' : '') + newInterimTranscript : '');
          setDisplayTranscript(newDisplay);
          
          // Send only the NEW final transcript to parent (not the full accumulated)
          logDebug('Calling onTranscript with new final transcript:', newFinalTranscript.trim());
          if (onTranscript) {
            onTranscript(newFinalTranscript.trim());
          }
          
          return updatedFinal;
        });
      } else if (newInterimTranscript) {
        // does w/ only interim to update
        setFinalTranscript(currentFinal => {
          const newDisplay = currentFinal + (newInterimTranscript ? (currentFinal ? ' ' : '') + newInterimTranscript : '');
          setDisplayTranscript(newDisplay);
          
          logDebug('Interim transcript update:', { 
            currentFinal,
            newInterimTranscript, 
            newDisplay 
          });
          
          return currentFinal; // doesn't change final js adds
        });
      }
    };

    recognition.onerror = (event) => {
      logDebug('SpeechRecognition ERROR:', {
        error: event.error,
        message: event.message,
        errorCode: event.errorCode,
        isBrave: isBrave
      });
      
      setIsListening(false);
      setIsProcessing(false);
      
      let errorMessage = '';
      switch (event.error) {
        case 'no-speech':
          errorMessage = 'No speech detected. Please try again.';
          break;
        case 'audio-capture':
          errorMessage = 'Microphone access denied. Please allow microphone access.';
          break;
        case 'not-allowed':
          errorMessage = 'Microphone access denied. Please allow microphone access.';
          break;
        case 'network':
          errorMessage = isBrave 
            ? 'Network error in Brave. Try disabling Brave Shields or use Chrome. Check your internet connection.'
            : 'Network error. Please check your internet connection and try again.';
          break;
        case 'aborted':
          errorMessage = 'Speech recognition was aborted. Please try again.';
          break;
        case 'service-not-allowed':
          errorMessage = isBrave
            ? 'Speech recognition service not allowed in Brave. Try disabling Brave Shields or use Chrome.'
            : 'Speech recognition service not allowed. Please check your browser settings.';
          break;
        case 'bad-grammar':
          errorMessage = 'Speech recognition grammar error. Please try again.';
          break;
        case 'language-not-supported':
          errorMessage = 'Language not supported. Please try again.';
          break;
        default:
          errorMessage = `Speech recognition error: ${event.error}. Please try again.`;
      }
      
      logDebug('Setting error message:', errorMessage);
      setError(errorMessage);
    };

    recognition.onend = () => {
      logDebug('SpeechRecognition ended');
      setIsListening(false);
      setIsProcessing(false);
    };

    recognition.onaudiostart = () => logDebug('Audio capture started');
    recognition.onaudioend = () => logDebug('Audio capture ended');
    recognition.onsoundstart = () => logDebug('Sound detected');
    recognition.onsoundend = () => logDebug('Sound ended');
    recognition.onspeechstart = () => logDebug('Speech started');
    recognition.onspeechend = () => logDebug('Speech ended');
    recognition.onnomatch = () => logDebug('No speech match found');

    isInitializedRef.current = true;
    return true;
  };

  useEffect(() => {
    logDebug('VoiceInput component mounted');
    initializeSpeechRecognition();

    return () => {
      logDebug('Cleaning up SpeechRecognition');
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (err) {
          logDebug('Error stopping recognition during cleanup:', err);
        }
      }
      isInitializedRef.current = false;
    };
  }, []);

  const startListening = () => {    
    logDebug('Starting speech recognition...');
    setError('');
    setIsProcessing(true);
    if (!initializeSpeechRecognition()) {
      setIsProcessing(false);
      return;
    } //resets interim but not final/displayed

    // Check mic perms
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        logDebug('Microphone access granted');
        stream.getTracks().forEach(track => track.stop()); // Stop the stream
        
        try {
          logDebug('Calling recognition.start()');
          recognitionRef.current?.start();
        } catch (error) {
          logDebug('ERROR: Failed to start recognition:', error);
          setError(`Failed to start speech recognition: ${error.message}`);
          setIsProcessing(false);
        }
      })
      .catch(err => {
        logDebug('ERROR: Microphone access denied:', err);
        setError('Microphone access denied. Please allow microphone access and try again.');
        setIsProcessing(false);
      });
  };

  const stopListening = () => {
    logDebug('Stopping speech recognition...');
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        logDebug('ERROR: Failed to stop recognition:', err);
      }
    }
    setIsListening(false);
    setIsProcessing(false);
  };

  const clearTranscript = () => {
    logDebug('Clearing transcript');
    setDisplayTranscript('');
    setFinalTranscript('');
    if (onTranscript) {
      onTranscript('');
    }
  };

  const retrySpeechRecognition = () => {
    logDebug('Retrying speech recognition, attempt:', retryCount + 1);
    setError('');
    setRetryCount(prev => prev + 1);
    
    // Wait a moment before retrying
    setTimeout(() => {
      startListening();
    }, 1000);
  };

  const clearDebugInfo = () => {
    setDebugInfo('');
  };

  if (error && !isListening) {
    return (
      <div className="voice-input-error">
        <p>{error}</p>
        <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button onClick={() => setError('')}>
            Dismiss
          </button>
          {error.includes('Network') || error.includes('service') ? (
            <button 
              onClick={retrySpeechRecognition}
              style={{
                padding: '0.25rem 0.5rem',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '0.8rem'
              }}
            >
              Retry
            </button>
          ) : null}
          <button
            onClick={() => setShowTroubleshooting(true)}
            style={{
              padding: '0.25rem 0.5rem',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}
          >
            <HelpCircle size={12} />
            Help
          </button>
        </div>
        
        {/* Debug info for development */}
        {process.env.NODE_ENV === 'development' && (
          <details style={{ marginTop: '1rem' }}>
            <summary style={{ cursor: 'pointer', color: '#666' }}>Debug Info</summary>
            <div style={{ 
              marginTop: '0.5rem', 
              padding: '0.5rem', 
              backgroundColor: '#f5f5f5', 
              borderRadius: '4px',
              fontSize: '0.8rem',
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              maxHeight: '200px',
              overflow: 'auto'
            }}>
              {debugInfo}
              <button 
                onClick={clearDebugInfo}
                style={{
                  marginTop: '0.5rem',
                  padding: '0.25rem 0.5rem',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '0.7rem'
                }}
              >
                Clear Debug
              </button>
            </div>
          </details>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="voice-input-container">
        <div className="voice-input-controls">
          <button
            onClick={isListening ? stopListening : startListening}
            disabled={disabled || isProcessing}
            className={`voice-input-button ${isListening ? 'stop' : 'start'}`}
          >
            {isProcessing ? (
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
            ) : isListening ? (
              <MicOff size={16} />
            ) : (
              <Mic size={16} />
            )}
            {isProcessing ? 'Starting...' : isListening ? 'Stop Recording' : 'Start Voice Input'}
          </button>
          
          {displayTranscript && (
            <button
              onClick={clearTranscript}
              className="voice-input-clear"
            >
              Clear
            </button>
          )}
          
          <button
            onClick={() => {
              console.log('Help button clicked');
              setShowTroubleshooting(true);
            }}
            style={{
              padding: '0.5rem',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              color: 'white',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Voice Input Help"
          >
            <HelpCircle size={16} />
          </button>
        </div>
        
        {isListening && (
          <div className="voice-input-listening">
            <p>🎤 Listening... Speak now</p>
            <button
              onClick={stopListening}
              style={{
                marginTop: '0.5rem',
                padding: '0.5rem 1rem',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}
            >
              🛑 Stop Recording
            </button>
          </div>
        )}
        
        {displayTranscript && (
          <div className="voice-input-transcript">
            <p>
              <strong>Transcript:</strong> {displayTranscript}
            </p>
          </div>
        )}
        
        {!isListening && !displayTranscript && (
          <p className="voice-input-placeholder">
            {placeholder}
          </p>
        )}
        
        {retryCount > 0 && (
          <p style={{ 
            fontSize: '0.8rem', 
            color: 'rgba(255, 255, 255, 0.6)', 
            marginTop: '0.5rem',
            fontStyle: 'italic'
          }}>
            Retry attempt: {retryCount}
          </p>
        )}
        
        {/* Debug info for development */}
        {process.env.NODE_ENV === 'development' && (
          <details style={{ marginTop: '1rem' }}>
            <summary style={{ cursor: 'pointer', color: 'rgba(255, 255, 255, 0.7)' }}>Debug Info</summary>
            <div style={{ 
              marginTop: '0.5rem', 
              padding: '0.5rem', 
              backgroundColor: 'rgba(0, 0, 0, 0.3)', 
              borderRadius: '4px',
              fontSize: '0.8rem',
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              maxHeight: '200px',
              overflow: 'auto',
              color: 'rgba(255, 255, 255, 0.8)'
            }}>
              {debugInfo}
              <button 
                onClick={clearDebugInfo}
                style={{
                  marginTop: '0.5rem',
                  padding: '0.25rem 0.5rem',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '0.7rem'
                }}
              >
                Clear Debug
              </button>
            </div>
          </details>
        )}
      </div>
      
      {showTroubleshooting && (
        <VoiceInputTroubleshooting 
          onClose={() => {
            console.log('Closing troubleshooting');
            setShowTroubleshooting(false);
          }} 
        />
      )}
    </>
  );
};
export default VoiceInput; 