import React, { useState } from 'react';
import EnhancedVoiceOutput from './EnhancedVoiceOutput';
import { TTS_CONFIG, getVoiceForContext, getAvailableVoices } from '../config/tts';
import './TTSDemo.css';

const TTSDemo = () => {
  const [demoText, setDemoText] = useState('Welcome to DebateSim! This is a demonstration of the enhanced Google Cloud Text-to-Speech system.');
  const [customText, setCustomText] = useState('');
  const [useGoogleTTS, setUseGoogleTTS] = useState(true);
  const [ttsApiUrl, setTtsApiUrl] = useState(TTS_CONFIG.apiUrl);
  const [apiStatus, setApiStatus] = useState('unknown');
  const [selectedContext, setSelectedContext] = useState('debate');

  const sampleTexts = [
    {
      title: "Debate Speech",
      text: "Ladies and gentlemen, today we stand at a critical juncture in our nation's history. The resolution before us demands careful consideration of both its immediate impacts and long-term consequences. As we examine the evidence, we must ask ourselves: does this policy truly serve the common good?",
      context: "debate"
    },
    {
      title: "Bill Analysis",
      text: "This legislation proposes significant changes to our regulatory framework. The analysis reveals both potential benefits and risks that require careful evaluation. Key considerations include economic impact, implementation timeline, and stakeholder concerns.",
      context: "analysis"
    },
    {
      title: "General Information",
      text: "Text-to-speech technology has evolved significantly in recent years. Google Cloud TTS provides natural-sounding voices that enhance user experience across various applications.",
      context: "general"
    }
  ];

  const handleTextChange = (e) => {
    setCustomText(e.target.value);
  };

  const handleSampleText = (sample) => {
    setDemoText(sample.text);
    setSelectedContext(sample.context);
  };

  const checkApiStatus = async () => {
    try {
      const response = await fetch(`${ttsApiUrl}/health`);
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'healthy') {
          setApiStatus('healthy');
        } else {
          setApiStatus('unhealthy');
        }
      } else {
        setApiStatus('error');
      }
    } catch (error) {
      setApiStatus('error');
    }
  };

  const handleApiUrlChange = (e) => {
    setTtsApiUrl(e.target.value);
    setApiStatus('unknown');
  };

  const getStatusColor = () => {
    switch (apiStatus) {
      case 'healthy': return '#22c55e';
      case 'unhealthy': return '#f59e0b';
      case 'error': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusText = () => {
    switch (apiStatus) {
      case 'healthy': return '✅ API Healthy';
      case 'unhealthy': return '⚠️ API Unhealthy';
      case 'error': return '❌ API Error';
      default: return '❓ Status Unknown';
    }
  };

  const contexts = [
    { key: 'debate', name: 'Debate', description: 'Authoritative male voice for formal debates' },
    { key: 'analysis', name: 'Analysis', description: 'Clear female voice for detailed analysis' },
    { key: 'general', name: 'General', description: 'Default voice for general use' }
  ];

  const voices = getAvailableVoices();

  return (
    <div className="tts-demo-container">
      <div className="tts-demo-header">
        <h1>🎤 Google TTS Demo</h1>
        <p>Experience the enhanced text-to-speech system with natural-sounding voices</p>
      </div>

      {/* TTS Toggle */}
      <div className="tts-toggle">
        <label>
          <input
            type="checkbox"
            checked={useGoogleTTS}
            onChange={(e) => setUseGoogleTTS(e.target.checked)}
          />
          Use Google Cloud TTS (Enhanced Quality)
        </label>
      </div>

      {/* API Configuration */}
      {useGoogleTTS && (
        <div className="tts-api-config">
          <label>
            Backend TTS API URL:
            <input
              type="text"
              value={ttsApiUrl}
              onChange={handleApiUrlChange}
              placeholder="http://localhost:8000"
              className="api-url-input"
            />
          </label>
          <button onClick={checkApiStatus} className="check-api-button">
            Check Status
          </button>
          <div className="api-status" style={{ color: getStatusColor() }}>
            {getStatusText()}
          </div>
        </div>
      )}

      {/* Context Selection */}
      <div className="context-selection">
        <h3>🎭 Select Voice Context</h3>
        <div className="context-buttons">
          {contexts.map((context) => (
            <button
              key={context.key}
              onClick={() => setSelectedContext(context.key)}
              className={`context-button ${selectedContext === context.key ? 'active' : ''}`}
            >
              <div className="context-name">{context.name}</div>
              <div className="context-description">{context.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Sample Texts */}
      <div className="sample-texts">
        <h3>📝 Sample Texts</h3>
        <div className="sample-buttons">
          {sampleTexts.map((sample, index) => (
            <button
              key={index}
              onClick={() => handleSampleText(sample)}
              className={`sample-button ${demoText === sample.text ? 'active' : ''}`}
            >
              {sample.title}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Text Input */}
      <div className="custom-text-input">
        <h3>✍️ Custom Text</h3>
        <textarea
          value={customText}
          onChange={handleTextChange}
          placeholder="Enter your own text to test..."
          rows={4}
          className="custom-textarea"
        />
        <button
          onClick={() => setDemoText(customText)}
          disabled={!customText.trim()}
          className="use-custom-text-button"
        >
          Use This Text
        </button>
      </div>

      {/* Voice Output Component */}
      <div className="voice-output-demo">
        <h3>🔊 Test Voice Output</h3>
        <div className="current-context">
          <strong>Current Context:</strong> {contexts.find(c => c.key === selectedContext)?.name}
          <br />
          <strong>Voice:</strong> {getVoiceForContext(selectedContext).voice}
        </div>
        
        <EnhancedVoiceOutput
          text={demoText}
          useGoogleTTS={useGoogleTTS}
          ttsApiUrl={ttsApiUrl}
          context={selectedContext}
          buttonStyle="large"
          showLabel={true}
          onSpeechStart={() => console.log('Speech started')}
          onSpeechEnd={() => console.log('Speech ended')}
          onSpeechError={(error) => console.error('Speech error:', error)}
        />
      </div>

      {/* Features Overview */}
      <div className="features-overview">
        <h3>✨ Features</h3>
        <div className="features-grid">
          <div className="feature">
            <h4>🎯 Context-Aware Voices</h4>
            <p>Different voice settings for debates, analysis, and general use</p>
          </div>
          <div className="feature">
            <h4>🌐 Google Cloud TTS</h4>
            <p>High-quality Neural2 voices with natural intonation</p>
          </div>
          <div className="feature">
            <h4>🔄 Automatic Fallback</h4>
            <p>Falls back to browser TTS if Google TTS is unavailable</p>
          </div>
          <div className="feature">
            <h4>⚙️ Configurable Settings</h4>
            <p>Adjustable rate, pitch, and volume for each context</p>
          </div>
        </div>
      </div>

      {/* Setup Instructions */}
      <div className="setup-instructions">
        <h3>🚀 Setup Instructions</h3>
        <ol>
          <li>Ensure the TTS backend server is running: <code>python main.py</code></li>
          <li>Verify the API URL is correct (default: http://localhost:8000)</li>
          <li>Check that your Google Cloud credentials are properly configured</li>
          <li>Test with the sample texts above</li>
        </ol>
      </div>

      {/* Migration Guide */}
      <div className="migration-guide">
        <h3>🔄 Migration Guide</h3>
        <p>To use Google TTS in your components:</p>
        <div className="code-example">
          <p>Replace <code>VoiceOutput</code> with <code>EnhancedVoiceOutput</code></p>
          <pre>
{`// Before
<VoiceOutput text="Hello world" />

// After  
<EnhancedVoiceOutput 
  text="Hello world" 
  useGoogleTTS={true}
  context="debate"  // or "analysis" or "general"
/>`}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default TTSDemo;
