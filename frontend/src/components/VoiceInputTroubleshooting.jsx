import React, { useState } from 'react';

const VoiceInputTroubleshooting = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState('network');
  
  // Check if it's Brave browser
  const isBrave = navigator.userAgent.includes('Brave') || 
                  (navigator.brave && navigator.brave.isBrave());

  console.log('VoiceInputTroubleshooting rendered, isBrave:', isBrave);

  const troubleshootingSteps = {
    network: [
      'Check your internet connection',
      'Try refreshing the page',
      'Ensure you\'re using Chrome or Edge browser',
      'Check if your firewall is blocking speech recognition',
      'Try disabling VPN if you\'re using one',
      ...(isBrave ? [
        'Disable Brave Shields for this site',
        'Try using Chrome instead of Brave',
        'Check Brave Shields settings (click the lion icon)',
        'Allow all cookies and site data in Brave'
      ] : [])
    ],
    microphone: [
      'Allow microphone access when prompted',
      'Check if microphone is working in other apps',
      'Ensure microphone is not muted',
      'Try selecting a different microphone in browser settings',
      'Check browser microphone permissions',
      ...(isBrave ? [
        'Check Brave Shields microphone permissions',
        'Disable Brave Shields temporarily',
        'Try incognito mode in Brave'
      ] : [])
    ],
    browser: [
      'Use Chrome or Edge for best compatibility',
      'Update your browser to the latest version',
      'Clear browser cache and cookies',
      'Try incognito/private browsing mode',
      'Check if speech recognition is enabled in browser settings',
      ...(isBrave ? [
        'Brave may have limited speech recognition support',
        'Try disabling Brave Shields completely',
        'Use Chrome for speech recognition features',
        'Check Brave settings > Shields > Site and shield settings'
      ] : [])
    ]
  };

  const getBrowserInstructions = () => {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Brave')) {
      return 'Brave: Settings > Shields > Site and shield settings > Microphone';
    } else if (userAgent.includes('Chrome')) {
      return 'Chrome: Settings > Privacy and security > Site Settings > Microphone';
    } else if (userAgent.includes('Edge')) {
      return 'Edge: Settings > Cookies and site permissions > Microphone';
    } else if (userAgent.includes('Firefox')) {
      return 'Firefox: Settings > Privacy & Security > Permissions > Microphone';
    } else if (userAgent.includes('Safari')) {
      return 'Safari: Safari > Preferences > Websites > Microphone';
    }
    return 'Check your browser settings for microphone permissions';
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}
    onClick={(e) => {
      if (e.target === e.currentTarget) {
        console.log('Modal background clicked, closing');
        onClose();
      }
    }}
    >
      <div style={{
        backgroundColor: '#1a1a1a',
        borderRadius: '12px',
        padding: '2rem',
        maxWidth: '600px',
        width: '90%',
        maxHeight: '80vh',
        overflow: 'auto',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}
      onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem'
        }}>
          <h2 style={{ color: 'white', margin: 0 }}>
            Voice Input Troubleshooting
            {isBrave && <span style={{ fontSize: '0.8rem', color: '#ffa500' }}> (Brave Browser)</span>}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              fontSize: '1.5rem',
              cursor: 'pointer',
              padding: '0.5rem'
            }}
          >
            ×
          </button>
        </div>

        {isBrave && (
          <div style={{
            padding: '1rem',
            backgroundColor: 'rgba(255, 165, 0, 0.1)',
            border: '1px solid rgba(255, 165, 0, 0.3)',
            borderRadius: '6px',
            marginBottom: '1rem'
          }}>
            <h4 style={{ color: '#ffa500', margin: '0 0 0.5rem 0' }}>⚠️ Brave Browser Detected</h4>
            <p style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.9rem', margin: 0 }}>
              Brave browser may have limited speech recognition support due to privacy features. 
              Try disabling Brave Shields or use Chrome for best compatibility.
            </p>
          </div>
        )}

        <div style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}>
          <button
            onClick={() => setActiveTab('network')}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: activeTab === 'network' ? '#4a90e2' : 'rgba(255, 255, 255, 0.1)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Network Issues
          </button>
          <button
            onClick={() => setActiveTab('microphone')}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: activeTab === 'microphone' ? '#4a90e2' : 'rgba(255, 255, 255, 0.1)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Microphone Issues
          </button>
          <button
            onClick={() => setActiveTab('browser')}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: activeTab === 'browser' ? '#4a90e2' : 'rgba(255, 255, 255, 0.1)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Browser Issues
          </button>
        </div>

        <div style={{ color: 'white' }}>
          <h3 style={{ marginBottom: '1rem' }}>
            {activeTab === 'network' && 'Network Issues'}
            {activeTab === 'microphone' && 'Microphone Issues'}
            {activeTab === 'browser' && 'Browser Issues'}
          </h3>
          
          <ol style={{ paddingLeft: '1.5rem' }}>
            {troubleshootingSteps[activeTab].map((step, index) => (
              <li key={index} style={{ marginBottom: '0.5rem' }}>
                {step}
              </li>
            ))}
          </ol>

          {activeTab === 'microphone' && (
            <div style={{
              marginTop: '1rem',
              padding: '1rem',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '6px'
            }}>
              <h4 style={{ marginBottom: '0.5rem' }}>Browser Settings:</h4>
              <p style={{ fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.8)' }}>
                {getBrowserInstructions()}
              </p>
            </div>
          )}

          {activeTab === 'browser' && (
            <div style={{
              marginTop: '1rem',
              padding: '1rem',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '6px'
            }}>
              <h4 style={{ marginBottom: '0.5rem' }}>Supported Browsers:</h4>
              <ul style={{ fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.8)' }}>
                <li>✅ Chrome (recommended)</li>
                <li>✅ Edge</li>
                <li>⚠️ Brave (limited support - try disabling shields)</li>
                <li>⚠️ Firefox (limited support)</li>
                <li>⚠️ Safari (limited support)</li>
              </ul>
              
              {isBrave && (
                <div style={{
                  marginTop: '1rem',
                  padding: '0.75rem',
                  backgroundColor: 'rgba(255, 165, 0, 0.1)',
                  borderRadius: '4px'
                }}>
                  <h5 style={{ color: '#ffa500', margin: '0 0 0.5rem 0' }}>Brave-Specific Tips:</h5>
                  <ul style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.8)', margin: 0 }}>
                    <li>Click the lion icon (Brave Shields) and disable shields for this site</li>
                    <li>Go to Settings &gt; Shields &gt; Site and shield settings</li>
                    <li>Allow all cookies and site data</li>
                    <li>Try incognito mode</li>
                    <li>Consider using Chrome for speech recognition</li>
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{
          marginTop: '1.5rem',
          paddingTop: '1rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          textAlign: 'center'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#4a90e2',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoiceInputTroubleshooting; 