import React, { useState } from 'react';
import { useTranslation } from '../utils/translations';

const VoiceInputTroubleshooting = ({ onClose }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('network');

  // Check if it's Brave browser
  const isBrave = navigator.userAgent.includes('Brave') ||
                  (navigator.brave && navigator.brave.isBrave());

  console.log('VoiceInputTroubleshooting rendered, isBrave:', isBrave);

  const troubleshootingSteps = {
    network: [
      t('voiceInput.troubleshooting.steps.checkInternet'),
      t('voiceInput.troubleshooting.steps.refreshPage'),
      t('voiceInput.troubleshooting.steps.useChromeEdge'),
      t('voiceInput.troubleshooting.steps.checkFirewall'),
      t('voiceInput.troubleshooting.steps.disableVPN'),
      ...(isBrave ? [
        t('voiceInput.troubleshooting.steps.disableBraveShields'),
        t('voiceInput.troubleshooting.steps.useChromeInstead'),
        t('voiceInput.troubleshooting.steps.checkBraveShields'),
        t('voiceInput.troubleshooting.steps.allowCookies')
      ] : [])
    ],
    microphone: [
      t('voiceInput.troubleshooting.steps.allowMicrophone'),
      t('voiceInput.troubleshooting.steps.checkMicrophoneWorking'),
      t('voiceInput.troubleshooting.steps.ensureNotMuted'),
      t('voiceInput.troubleshooting.steps.selectDifferentMicrophone'),
      t('voiceInput.troubleshooting.steps.checkBrowserPermissions'),
      ...(isBrave ? [
        t('voiceInput.troubleshooting.steps.checkBraveMicPermissions'),
        t('voiceInput.troubleshooting.steps.disableBraveShieldsTemp'),
        t('voiceInput.troubleshooting.steps.tryIncognito')
      ] : [])
    ],
    browser: [
      t('voiceInput.troubleshooting.steps.useChromeEdgeCompatibility'),
      t('voiceInput.troubleshooting.steps.updateBrowser'),
      t('voiceInput.troubleshooting.steps.clearCache'),
      t('voiceInput.troubleshooting.steps.tryIncognitoMode'),
      t('voiceInput.troubleshooting.steps.checkSpeechRecognition'),
      ...(isBrave ? [
        t('voiceInput.troubleshooting.steps.braveLimitedSupport'),
        t('voiceInput.troubleshooting.steps.disableBraveShieldsCompletely'),
        t('voiceInput.troubleshooting.steps.useChromeForSpeech'),
        t('voiceInput.troubleshooting.steps.checkBraveSettings')
      ] : [])
    ]
  };

  const getBrowserInstructions = () => {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Brave')) {
      return t('voiceInput.troubleshooting.browserInstructions.brave');
    } else if (userAgent.includes('Chrome')) {
      return t('voiceInput.troubleshooting.browserInstructions.chrome');
    } else if (userAgent.includes('Edge')) {
      return t('voiceInput.troubleshooting.browserInstructions.edge');
    } else if (userAgent.includes('Firefox')) {
      return t('voiceInput.troubleshooting.browserInstructions.firefox');
    } else if (userAgent.includes('Safari')) {
      return t('voiceInput.troubleshooting.browserInstructions.safari');
    }
    return t('voiceInput.troubleshooting.browserInstructions.default');
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
            {t('voiceInput.troubleshooting.title')}
            {isBrave && <span style={{ fontSize: '0.8rem', color: '#ffa500' }}> ({t('voiceInput.troubleshooting.braveBrowser')})</span>}
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
            <h4 style={{ color: '#ffa500', margin: '0 0 0.5rem 0' }}>{t('voiceInput.troubleshooting.braveDetected')}</h4>
            <p style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.9rem', margin: 0 }}>
              {t('voiceInput.troubleshooting.braveWarning')}
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
            {t('voiceInput.troubleshooting.networkIssues')}
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
            {t('voiceInput.troubleshooting.microphoneIssues')}
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
            {t('voiceInput.troubleshooting.browserIssues')}
          </button>
        </div>

        <div style={{ color: 'white' }}>
          <h3 style={{ marginBottom: '1rem' }}>
            {activeTab === 'network' && t('voiceInput.troubleshooting.networkIssues')}
            {activeTab === 'microphone' && t('voiceInput.troubleshooting.microphoneIssues')}
            {activeTab === 'browser' && t('voiceInput.troubleshooting.browserIssues')}
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
              <h4 style={{ marginBottom: '0.5rem' }}>{t('voiceInput.troubleshooting.browserSettings')}</h4>
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
              <h4 style={{ marginBottom: '0.5rem' }}>{t('voiceInput.troubleshooting.supportedBrowsers')}</h4>
              <ul style={{ fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.8)' }}>
                <li>{t('voiceInput.troubleshooting.browsers.chromeRecommended')}</li>
                <li>{t('voiceInput.troubleshooting.browsers.edge')}</li>
                <li>{t('voiceInput.troubleshooting.browsers.brave')}</li>
                <li>{t('voiceInput.troubleshooting.browsers.firefox')}</li>
                <li>{t('voiceInput.troubleshooting.browsers.safari')}</li>
              </ul>

              {isBrave && (
                <div style={{
                  marginTop: '1rem',
                  padding: '0.75rem',
                  backgroundColor: 'rgba(255, 165, 0, 0.1)',
                  borderRadius: '4px'
                }}>
                  <h5 style={{ color: '#ffa500', margin: '0 0 0.5rem 0' }}>{t('voiceInput.troubleshooting.braveSpecificTips')}</h5>
                  <ul style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.8)', margin: 0 }}>
                    <li>{t('voiceInput.troubleshooting.braveTips.disableShields')}</li>
                    <li>{t('voiceInput.troubleshooting.braveTips.goToSettings')}</li>
                    <li>{t('voiceInput.troubleshooting.braveTips.allowCookies')}</li>
                    <li>{t('voiceInput.troubleshooting.braveTips.tryIncognito')}</li>
                    <li>{t('voiceInput.troubleshooting.braveTips.considerChrome')}</li>
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
            {t('voiceInput.troubleshooting.close')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoiceInputTroubleshooting; 