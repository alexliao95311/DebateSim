import React, { useState, useRef, useEffect } from 'react';

const SpeechTest = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const [debugLogs, setDebugLogs] = useState([]);
  const recognitionRef = useRef(null);

  const logDebug = (message, data = null) => {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}`;
    console.log(logEntry, data);
    setDebugLogs(prev => [...prev, { timestamp, message, data }]);
  };

  useEffect(() => {
    logDebug('SpeechTest component mounted');
    logDebug('User agent:', navigator.userAgent);
    logDebug('Online status:', navigator.onLine);
    
    // Check if it's Brave browser
    const isBrave = navigator.userAgent.includes('Brave') || 
                    (navigator.brave && navigator.brave.isBrave());
    logDebug('Is Brave browser:', isBrave);
    
    // Additional Brave-specific checks
    if (isBrave) {
      logDebug('Brave-specific checks:');
      logDebug('- navigator.brave:', navigator.brave);
      logDebug('- navigator.brave.isBrave():', navigator.brave?.isBrave());
      logDebug('- navigator.brave.isBrave.name:', navigator.brave?.isBrave?.name);
      
      // Check for additional Brave properties
      if (navigator.brave) {
        logDebug('Brave API available:', Object.keys(navigator.brave));
      }
    }
    
    // Check browser support
    const hasWebkitSpeechRecognition = 'webkitSpeechRecognition' in window;
    const hasSpeechRecognition = 'SpeechRecognition' in window;
    
    logDebug('SpeechRecognition support:', { hasWebkitSpeechRecognition, hasSpeechRecognition });
    
    if (!hasWebkitSpeechRecognition && !hasSpeechRecognition) {
      const errorMsg = 'Speech recognition is not supported in this browser.';
      logDebug('ERROR: ' + errorMsg);
      setError(errorMsg);
      return;
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
      return;
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
      // Try to set additional properties that might help with Brave
      try {
        recognition.grammars = null; // Clear any grammars
        logDebug('Cleared grammars for Brave');
      } catch (err) {
        logDebug('Could not clear grammars:', err);
      }
      
      // Try different language settings for Brave
      try {
        recognition.lang = 'en-US';
        logDebug('Set language to en-US for Brave');
      } catch (err) {
        logDebug('Could not set language:', err);
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
      setError('');
    };

    recognition.onresult = (event) => {
      logDebug('SpeechRecognition result received:', {
        resultIndex: event.resultIndex,
        resultsLength: event.results.length
      });
      
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        const isFinal = result.isFinal;
        
        logDebug(`Result ${i}:`, { transcript, isFinal, confidence: result[0].confidence });
        
        if (isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      const fullTranscript = finalTranscript + interimTranscript;
      logDebug('Transcript update:', { finalTranscript, interimTranscript, fullTranscript });
      
      setTranscript(fullTranscript);
    };

    recognition.onerror = (event) => {
      logDebug('SpeechRecognition ERROR:', {
        error: event.error,
        message: event.message,
        errorCode: event.errorCode,
        isBrave: isBrave
      });
      
      setIsListening(false);
      
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
            ? 'Network error in Brave. Try additional Brave settings or use Chrome/Safari.'
            : 'Network error. Please check your internet connection and try again.';
          break;
        case 'aborted':
          errorMessage = 'Speech recognition was aborted. Please try again.';
          break;
        case 'service-not-allowed':
          errorMessage = isBrave
            ? 'Speech recognition service not allowed in Brave. Try additional Brave settings or use Chrome/Safari.'
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
    };

    recognition.onaudiostart = () => {
      logDebug('Audio capture started');
    };

    recognition.onaudioend = () => {
      logDebug('Audio capture ended');
    };

    recognition.onsoundstart = () => {
      logDebug('Sound detected');
    };

    recognition.onsoundend = () => {
      logDebug('Sound ended');
    };

    recognition.onspeechstart = () => {
      logDebug('Speech started');
    };

    recognition.onspeechend = () => {
      logDebug('Speech ended');
    };

    recognition.onnomatch = () => {
      logDebug('No speech match found');
    };

    return () => {
      logDebug('Cleaning up SpeechRecognition');
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (err) {
          logDebug('Error stopping recognition during cleanup:', err);
        }
      }
    };
  }, []);

  const startListening = () => {
    logDebug('Starting speech recognition...');
    setError('');
    setTranscript('');
    
    // Additional Brave-specific checks before starting
    if (navigator.userAgent.includes('Brave')) {
      logDebug('=== BRAVE BROWSER TROUBLESHOOTING ===');
      logDebug('Checking Brave-specific settings...');
      
      // Check if we can access navigator.brave
      if (navigator.brave) {
        logDebug('Brave API available:', {
          isBrave: navigator.brave.isBrave(),
          isBraveName: navigator.brave.isBrave?.name,
          braveProperties: Object.keys(navigator.brave)
        });
      } else {
        logDebug('Brave API not available');
      }
      
      // Check network connectivity
      logDebug('Network status:', {
        online: navigator.onLine,
        connection: navigator.connection ? {
          effectiveType: navigator.connection.effectiveType,
          downlink: navigator.connection.downlink,
          rtt: navigator.connection.rtt
        } : 'Not available'
      });
      
      // Check if we can make a test request to Google's servers
      fetch('https://www.google.com/favicon.ico', { method: 'HEAD' })
        .then(() => logDebug('✅ Can reach Google servers'))
        .catch(err => logDebug('❌ Cannot reach Google servers:', err.message));
    }
    
    // Check microphone permissions
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
        }
      })
      .catch(err => {
        logDebug('ERROR: Microphone access denied:', err);
        setError('Microphone access denied. Please allow microphone access and try again.');
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
  };

  const clearLogs = () => {
    setDebugLogs([]);
  };

  return (
    <div style={{
      padding: '2rem',
      maxWidth: '800px',
      margin: '0 auto',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1 style={{ color: '#333', textAlign: 'center', marginBottom: '2rem' }}>
        🎤 Speech Recognition Test
      </h1>
      
      {/* Brave Browser Warning */}
      {navigator.userAgent.includes('Brave') && (
        <div style={{
          padding: '1rem',
          backgroundColor: '#fff3cd',
          border: '1px solid #ffeaa7',
          borderRadius: '8px',
          marginBottom: '2rem'
        }}>
          <h3 style={{ color: '#856404', margin: '0 0 0.5rem 0' }}>⚠️ Brave Browser Detected</h3>
          <p style={{ color: '#856404', margin: '0 0 1rem 0' }}>
            Brave browser's privacy features may block speech recognition. Try these solutions:
          </p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                const url = 'chrome://settings/content/microphone';
                window.open(url, '_blank');
              }}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              🔧 Open Brave Settings
            </button>
            <button
              onClick={() => {
                const url = 'chrome://settings/content/sound';
                window.open(url, '_blank');
              }}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              🎵 Sound Settings
            </button>
            <button
              onClick={() => {
                const url = 'chrome://settings/content/cookies';
                window.open(url, '_blank');
              }}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#ffc107',
                color: 'black',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              🍪 Cookie Settings
            </button>
          </div>
        </div>
      )}
      
      <div style={{
        backgroundColor: '#f5f5f5',
        padding: '1.5rem',
        borderRadius: '8px',
        marginBottom: '2rem'
      }}>
        <h2 style={{ margin: '0 0 1rem 0', color: '#333' }}>Test Controls</h2>
        
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <button
            onClick={isListening ? stopListening : startListening}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: isListening ? '#dc3545' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            {isListening ? '🛑 Stop Recording' : '🎤 Start Recording'}
          </button>
          
          <button
            onClick={() => setTranscript('')}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            Clear Transcript
          </button>
        </div>
        
        {isListening && (
          <div style={{
            padding: '1rem',
            backgroundColor: '#d4edda',
            color: '#155724',
            borderRadius: '4px',
            marginBottom: '1rem'
          }}>
            🎤 Listening... Speak now!
          </div>
        )}
        
        {error && (
          <div style={{
            padding: '1rem',
            backgroundColor: '#f8d7da',
            color: '#721c24',
            borderRadius: '4px',
            marginBottom: '1rem'
          }}>
            ❌ Error: {error}
            {error.includes('Brave') && (
              <div style={{ marginTop: '0.5rem' }}>
                <strong>Quick Fix:</strong>
                <ol style={{ margin: '0.5rem 0 0 1rem', fontSize: '0.9rem' }}>
                  <li>Click the lion icon (🦁) in the address bar</li>
                  <li>Set "Shields" to "Down"</li>
                  <li>Refresh the page and try again</li>
                </ol>
              </div>
            )}
          </div>
        )}
        
        <div style={{ marginBottom: '1rem' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#333' }}>Transcript:</h3>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            style={{
              width: '100%',
              minHeight: '100px',
              padding: '0.75rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '1rem',
              fontFamily: 'monospace'
            }}
            placeholder="Transcript will appear here..."
          />
        </div>
      </div>
      
      <div style={{
        backgroundColor: '#f8f9fa',
        padding: '1.5rem',
        borderRadius: '8px',
        border: '1px solid #dee2e6'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, color: '#333' }}>Debug Logs</h2>
          <button
            onClick={clearLogs}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.8rem'
            }}
          >
            Clear Logs
          </button>
        </div>
        
        <div style={{
          backgroundColor: '#fff',
          border: '1px solid #dee2e6',
          borderRadius: '4px',
          padding: '1rem',
          maxHeight: '400px',
          overflow: 'auto',
          fontFamily: 'monospace',
          fontSize: '0.8rem',
          lineHeight: '1.4'
        }}>
          {debugLogs.length === 0 ? (
            <p style={{ color: '#6c757d', margin: 0 }}>No logs yet. Start recording to see debug information.</p>
          ) : (
            debugLogs.map((log, index) => (
              <div key={index} style={{ marginBottom: '0.5rem' }}>
                <span style={{ color: '#6c757d' }}>{log.timestamp}</span>
                <span style={{ color: '#333' }}> {log.message}</span>
                {log.data && (
                  <div style={{ color: '#666', marginLeft: '1rem', fontSize: '0.7rem' }}>
                    {JSON.stringify(log.data, null, 2)}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
      
      <div style={{
        marginTop: '2rem',
        padding: '1rem',
        backgroundColor: '#e7f3ff',
        borderRadius: '8px',
        border: '1px solid #b3d9ff'
      }}>
        <h3 style={{ margin: '0 0 0.5rem 0', color: '#0056b3' }}>Instructions:</h3>
        <ol style={{ margin: 0, color: '#0056b3' }}>
          <li>Click "Start Recording" to begin speech recognition</li>
          <li>Speak clearly into your microphone</li>
          <li>Watch the debug logs for detailed information</li>
          <li>If you get a network error, try disabling Brave Shields</li>
          <li>Check the browser console (F12) for additional logs</li>
        </ol>
      </div>
      
      {/* Brave Browser Solutions */}
      {navigator.userAgent.includes('Brave') && (
        <div style={{
          marginTop: '2rem',
          padding: '1rem',
          backgroundColor: '#fff3cd',
          borderRadius: '8px',
          border: '1px solid #ffeaa7'
        }}>
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#856404' }}>🔧 Brave Browser Solutions:</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
            <div>
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#856404' }}>Method 1: Disable Shields</h4>
              <ol style={{ margin: 0, fontSize: '0.9rem', color: '#856404' }}>
                <li>Click the lion icon (🦁) in the address bar</li>
                <li>Set "Shields" to "Down"</li>
                <li>Refresh the page</li>
                <li>Try speech recognition again</li>
              </ol>
            </div>
            <div>
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#856404' }}>Method 2: Allow Cookies</h4>
              <ol style={{ margin: 0, fontSize: '0.9rem', color: '#856404' }}>
                <li>Go to Settings > Shields > Site and shield settings</li>
                <li>Set "Cookies and site data" to "Allow all"</li>
                <li>Refresh the page</li>
                <li>Try speech recognition again</li>
              </ol>
            </div>
            <div>
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#856404' }}>Method 3: Use Chrome</h4>
              <ol style={{ margin: 0, fontSize: '0.9rem', color: '#856404' }}>
                <li>Open Chrome browser</li>
                <li>Go to the same URL</li>
                <li>Speech recognition should work immediately</li>
                <li>No additional settings needed</li>
              </ol>
            </div>
          </div>
          
          {/* Additional Brave Settings */}
          <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'rgba(255, 255, 255, 0.3)', borderRadius: '4px' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#856404' }}>🔍 If Shields Are Already Down:</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
              <div>
                <h5 style={{ margin: '0 0 0.25rem 0', color: '#856404', fontSize: '0.9rem' }}>Check These Settings:</h5>
                <ul style={{ margin: 0, fontSize: '0.8rem', color: '#856404' }}>
                  <li>Settings > Privacy and security > Site and shield settings</li>
                  <li>Set "Fingerprinting" to "Allow all"</li>
                  <li>Set "HTTPS Everywhere" to "Off"</li>
                  <li>Set "Scripts" to "Allow all"</li>
                </ul>
              </div>
              <div>
                <h5 style={{ margin: '0 0 0.25rem 0', color: '#856404', fontSize: '0.9rem' }}>Try These Steps:</h5>
                <ul style={{ margin: 0, fontSize: '0.8rem', color: '#856404' }}>
                  <li>Clear browser cache and cookies</li>
                  <li>Try incognito/private mode</li>
                  <li>Disable all extensions temporarily</li>
                  <li>Check if VPN is interfering</li>
                </ul>
              </div>
              <div>
                <h5 style={{ margin: '0 0 0.25rem 0', color: '#856404', fontSize: '0.9rem' }}>Alternative Browsers:</h5>
                <ul style={{ margin: 0, fontSize: '0.8rem', color: '#856404' }}>
                  <li>✅ Safari (you confirmed it works)</li>
                  <li>✅ Chrome (should work)</li>
                  <li>✅ Edge (should work)</li>
                  <li>⚠️ Firefox (limited support)</li>
                </ul>
              </div>
            </div>
          </div>
          
          {/* Quick Test Buttons */}
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                const url = 'chrome://settings/content/microphone';
                window.open(url, '_blank');
              }}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.8rem'
              }}
            >
              🔧 Microphone Settings
            </button>
            <button
              onClick={() => {
                const url = 'chrome://settings/content/cookies';
                window.open(url, '_blank');
              }}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.8rem'
              }}
            >
              🍪 Cookie Settings
            </button>
            <button
              onClick={() => {
                const url = 'chrome://settings/content/javascript';
                window.open(url, '_blank');
              }}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#ffc107',
                color: 'black',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.8rem'
              }}
            >
              📜 JavaScript Settings
            </button>
            <button
              onClick={() => {
                const url = 'chrome://settings/content/sound';
                window.open(url, '_blank');
              }}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#6f42c1',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.8rem'
              }}
            >
              🎵 Sound Settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SpeechTest; 