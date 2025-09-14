import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Volume2, Settings as SettingsIcon } from 'lucide-react';
import UserDropdown from './UserDropdown';
import { TTS_CONFIG, getAvailableVoices, getDefaultVoice, getVoiceForContext, getTTSEndpoint } from '../config/tts';
import './Settings.css';

const Settings = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [selectedVoice, setSelectedVoice] = useState(getDefaultVoice());
  const [isPlaying, setIsPlaying] = useState(false);

  // Load saved voice preference from localStorage
  useEffect(() => {
    const savedVoice = localStorage.getItem('tts-voice-preference');
    if (savedVoice) {
      setSelectedVoice(savedVoice);
    }
  }, []);

  // Save voice preference to localStorage
  const handleVoiceChange = (voice) => {
    setSelectedVoice(voice);
    localStorage.setItem('tts-voice-preference', voice);
    
    // Update the TTS config for immediate effect
    TTS_CONFIG.defaultVoice = voice;
    Object.keys(TTS_CONFIG.contexts).forEach(context => {
      TTS_CONFIG.contexts[context].voice = voice;
    });
  };

  // Test voice functionality (matching EnhancedVoiceOutput implementation)
  const testVoice = async (voice) => {
    if (isPlaying) return;
    
    setIsPlaying(true);
    
    try {
      const contextSettings = getVoiceForContext('general');
      
      const requestPayload = {
        text: "Hello! This is a sample of how this voice sounds for text-to-speech in DebateSim.",
        voice_name: voice,
        rate: contextSettings.rate,
        pitch: contextSettings.pitch,
        volume: contextSettings.volume
      };

      const response = await fetch(getTTSEndpoint('synthesize'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok) {
        throw new Error(`TTS API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && data.audio_content) {
        // Convert base64 to audio and play (matching EnhancedVoiceOutput implementation)
        const audioBlob = new Blob([
          Uint8Array.from(atob(data.audio_content), c => c.charCodeAt(0))
        ], { type: 'audio/mp3' });
        
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        audio.onloadedmetadata = () => {
          audio.play().catch(() => {
            setIsPlaying(false);
            URL.revokeObjectURL(audioUrl);
            alert('Unable to play audio. Try clicking again or check browser autoplay settings.');
          });
        };
        
        audio.onended = () => {
          setIsPlaying(false);
          URL.revokeObjectURL(audioUrl);
        };
        
        audio.onerror = () => {
          setIsPlaying(false);
          URL.revokeObjectURL(audioUrl);
          alert('Audio playback failed. Please try again.');
        };
        
      } else {
        throw new Error(data.error || 'No audio content received');
      }
      
    } catch (error) {
      console.error('TTS test error:', error);
      setIsPlaying(false);
      alert('Voice test failed. Please ensure the TTS service is running and try again.');
    }
  };

  // Get all available voice options
  const getVoiceOptions = () => {
    const voices = [];
    
    // Premium Chirp3 HD voices (highest quality)
    const chirp3Voices = [
      { id: 'en-US-Chirp3-HD-Achernar', gender: 'FEMALE', name: 'Achernar' },
      { id: 'en-US-Chirp3-HD-Achird', gender: 'MALE', name: 'Achird' },
      { id: 'en-US-Chirp3-HD-Algenib', gender: 'MALE', name: 'Algenib' },
      { id: 'en-US-Chirp3-HD-Algieba', gender: 'MALE', name: 'Algieba' },
      { id: 'en-US-Chirp3-HD-Alnilam', gender: 'MALE', name: 'Alnilam' },
      { id: 'en-US-Chirp3-HD-Aoede', gender: 'FEMALE', name: 'Aoede' },
      { id: 'en-US-Chirp3-HD-Autonoe', gender: 'FEMALE', name: 'Autonoe' },
      { id: 'en-US-Chirp3-HD-Callirrhoe', gender: 'FEMALE', name: 'Callirrhoe' },
      { id: 'en-US-Chirp3-HD-Charon', gender: 'MALE', name: 'Charon' },
      { id: 'en-US-Chirp3-HD-Despina', gender: 'FEMALE', name: 'Despina' },
      { id: 'en-US-Chirp3-HD-Enceladus', gender: 'MALE', name: 'Enceladus' },
      { id: 'en-US-Chirp3-HD-Erinome', gender: 'FEMALE', name: 'Erinome' },
      { id: 'en-US-Chirp3-HD-Fenrir', gender: 'MALE', name: 'Fenrir' },
      { id: 'en-US-Chirp3-HD-Gacrux', gender: 'FEMALE', name: 'Gacrux' },
      { id: 'en-US-Chirp3-HD-Iapetus', gender: 'MALE', name: 'Iapetus' },
      { id: 'en-US-Chirp3-HD-Kore', gender: 'FEMALE', name: 'Kore' },
      { id: 'en-US-Chirp3-HD-Laomedeia', gender: 'FEMALE', name: 'Laomedeia' },
      { id: 'en-US-Chirp3-HD-Leda', gender: 'FEMALE', name: 'Leda' },
      { id: 'en-US-Chirp3-HD-Orus', gender: 'MALE', name: 'Orus' },
      { id: 'en-US-Chirp3-HD-Puck', gender: 'MALE', name: 'Puck' },
      { id: 'en-US-Chirp3-HD-Pulcherrima', gender: 'FEMALE', name: 'Pulcherrima' },
      { id: 'en-US-Chirp3-HD-Rasalgethi', gender: 'MALE', name: 'Rasalgethi' },
      { id: 'en-US-Chirp3-HD-Sadachbia', gender: 'MALE', name: 'Sadachbia' },
      { id: 'en-US-Chirp3-HD-Sadaltager', gender: 'MALE', name: 'Sadaltager' },
      { id: 'en-US-Chirp3-HD-Schedar', gender: 'MALE', name: 'Schedar' },
      { id: 'en-US-Chirp3-HD-Sulafat', gender: 'FEMALE', name: 'Sulafat' },
      { id: 'en-US-Chirp3-HD-Umbriel', gender: 'MALE', name: 'Umbriel' },
      { id: 'en-US-Chirp3-HD-Vindemiatrix', gender: 'FEMALE', name: 'Vindemiatrix' },
      { id: 'en-US-Chirp3-HD-Zephyr', gender: 'FEMALE', name: 'Zephyr' },
      { id: 'en-US-Chirp3-HD-Zubenelgenubi', gender: 'MALE', name: 'Zubenelgenubi' }
    ];

    // Other Premium voices
    const otherPremiumVoices = [
      { id: 'en-US-Casual-K', gender: 'MALE', name: 'Casual K', category: 'Casual' },
      { id: 'en-US-Chirp-HD-D', gender: 'MALE', name: 'Chirp HD D', category: 'Chirp HD' },
      { id: 'en-US-Chirp-HD-F', gender: 'FEMALE', name: 'Chirp HD F', category: 'Chirp HD' },
      { id: 'en-US-Chirp-HD-O', gender: 'FEMALE', name: 'Chirp HD O', category: 'Chirp HD' },
      { id: 'en-US-News-K', gender: 'FEMALE', name: 'News K', category: 'News' },
      { id: 'en-US-News-L', gender: 'FEMALE', name: 'News L', category: 'News' },
      { id: 'en-US-News-N', gender: 'MALE', name: 'News N', category: 'News' },
      { id: 'en-US-Polyglot-1', gender: 'MALE', name: 'Polyglot 1', category: 'Polyglot' }
    ];

    // Neural2 voices
    const neural2Voices = [
      { id: 'en-US-Neural2-A', gender: 'MALE', name: 'Neural2 A' },
      { id: 'en-US-Neural2-C', gender: 'FEMALE', name: 'Neural2 C' },
      { id: 'en-US-Neural2-D', gender: 'MALE', name: 'Neural2 D' },
      { id: 'en-US-Neural2-E', gender: 'FEMALE', name: 'Neural2 E' },
      { id: 'en-US-Neural2-F', gender: 'FEMALE', name: 'Neural2 F' },
      { id: 'en-US-Neural2-G', gender: 'FEMALE', name: 'Neural2 G' },
      { id: 'en-US-Neural2-H', gender: 'FEMALE', name: 'Neural2 H' },
      { id: 'en-US-Neural2-I', gender: 'MALE', name: 'Neural2 I' },
      { id: 'en-US-Neural2-J', gender: 'MALE', name: 'Neural2 J' }
    ];

    // WaveNet voices
    const wavenetVoices = [
      { id: 'en-US-Wavenet-A', gender: 'MALE', name: 'WaveNet A' },
      { id: 'en-US-Wavenet-B', gender: 'MALE', name: 'WaveNet B' },
      { id: 'en-US-Wavenet-C', gender: 'FEMALE', name: 'WaveNet C' },
      { id: 'en-US-Wavenet-D', gender: 'MALE', name: 'WaveNet D' },
      { id: 'en-US-Wavenet-E', gender: 'FEMALE', name: 'WaveNet E' },
      { id: 'en-US-Wavenet-F', gender: 'FEMALE', name: 'WaveNet F' },
      { id: 'en-US-Wavenet-G', gender: 'FEMALE', name: 'WaveNet G' },
      { id: 'en-US-Wavenet-H', gender: 'FEMALE', name: 'WaveNet H' },
      { id: 'en-US-Wavenet-I', gender: 'MALE', name: 'WaveNet I' },
      { id: 'en-US-Wavenet-J', gender: 'MALE', name: 'WaveNet J' }
    ];

    // Studio voices
    const studioVoices = [
      { id: 'en-US-Studio-O', gender: 'FEMALE', name: 'Studio O' },
      { id: 'en-US-Studio-Q', gender: 'MALE', name: 'Studio Q' }
    ];

    // Standard voices
    const standardVoices = [
      { id: 'en-US-Standard-A', gender: 'MALE', name: 'Standard A' },
      { id: 'en-US-Standard-B', gender: 'MALE', name: 'Standard B' },
      { id: 'en-US-Standard-C', gender: 'FEMALE', name: 'Standard C' },
      { id: 'en-US-Standard-D', gender: 'MALE', name: 'Standard D' },
      { id: 'en-US-Standard-E', gender: 'FEMALE', name: 'Standard E' },
      { id: 'en-US-Standard-F', gender: 'FEMALE', name: 'Standard F' },
      { id: 'en-US-Standard-G', gender: 'FEMALE', name: 'Standard G' },
      { id: 'en-US-Standard-H', gender: 'FEMALE', name: 'Standard H' },
      { id: 'en-US-Standard-I', gender: 'MALE', name: 'Standard I' },
      { id: 'en-US-Standard-J', gender: 'MALE', name: 'Standard J' }
    ];

    // Add Chirp3 HD voices (highest quality)
    chirp3Voices.forEach(voice => {
      voices.push({
        id: voice.id,
        name: `${voice.name} (Chirp3 HD)`,
        category: 'Chirp3 HD - Premium',
        description: `${voice.gender === 'MALE' ? 'Male' : 'Female'} voice with highest quality AI synthesis`,
        gender: voice.gender,
        tier: 'premium'
      });
    });

    // Add other premium voices
    otherPremiumVoices.forEach(voice => {
      voices.push({
        id: voice.id,
        name: voice.name,
        category: `${voice.category || 'Premium'}`,
        description: `${voice.gender === 'MALE' ? 'Male' : 'Female'} premium voice`,
        gender: voice.gender,
        tier: 'premium'
      });
    });

    // Add Neural2 voices
    neural2Voices.forEach(voice => {
      voices.push({
        id: voice.id,
        name: voice.name,
        category: 'Neural2 - Premium',
        description: `${voice.gender === 'MALE' ? 'Male' : 'Female'} neural network voice`,
        gender: voice.gender,
        tier: 'premium'
      });
    });

    // Add WaveNet voices
    wavenetVoices.forEach(voice => {
      voices.push({
        id: voice.id,
        name: voice.name,
        category: 'WaveNet - Premium',
        description: `${voice.gender === 'MALE' ? 'Male' : 'Female'} WaveNet voice`,
        gender: voice.gender,
        tier: 'premium'
      });
    });

    // Add Studio voices
    studioVoices.forEach(voice => {
      voices.push({
        id: voice.id,
        name: voice.name,
        category: 'Studio',
        description: `${voice.gender === 'MALE' ? 'Male' : 'Female'} studio-quality voice`,
        gender: voice.gender,
        tier: 'studio'
      });
    });

    // Add Standard voices
    standardVoices.forEach(voice => {
      voices.push({
        id: voice.id,
        name: voice.name,
        category: 'Standard',
        description: `${voice.gender === 'MALE' ? 'Male' : 'Female'} standard voice`,
        gender: voice.gender,
        tier: 'standard'
      });
    });

    return voices;
  };

  const voiceOptions = getVoiceOptions();

  // Group voices by category for better organization
  const groupedVoices = voiceOptions.reduce((groups, voice) => {
    const category = voice.category;
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(voice);
    return groups;
  }, {});

  // Define category order (highest quality first)
  const categoryOrder = [
    'Chirp3 HD - Premium',
    'Casual',
    'Chirp HD',
    'News',
    'Polyglot',
    'Neural2 - Premium',
    'WaveNet - Premium',
    'Studio',
    'Standard'
  ];

  return (
    <div className="settings-container">
      {/* Header */}
      <div className="settings-header">
        <div className="settings-header-left">
          <button 
            className="settings-back-button" 
            onClick={() => navigate(-1)}
            title="Go back"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="settings-header-title">
            <SettingsIcon size={24} />
            <h1>Settings</h1>
          </div>
        </div>

        <div className="settings-header-right">
          <UserDropdown user={user} onLogout={onLogout} className="settings-user-dropdown" />
        </div>
      </div>

      {/* Main Content */}
      <div className="settings-content">
        <div className="settings-section">
          <div className="settings-section-header">
            <Volume2 size={20} />
            <h2>Text-to-Speech Voice</h2>
          </div>
          
          <p className="settings-section-description">
            Choose your preferred voice for all text-to-speech features in DebateSim, 
            including debate narration, analysis reading, and judge feedback.
          </p>

          <div className="voice-options">
            {categoryOrder.map(category => {
              const voices = groupedVoices[category];
              if (!voices || voices.length === 0) return null;
              
              return (
                <div key={category} className="voice-category-group">
                  <h3 className="voice-category-title">{category}</h3>
                  <div className="voice-category-voices">
                    {voices.map((voice) => (
                      <div 
                        key={voice.id} 
                        className={`voice-option ${selectedVoice === voice.id ? 'selected' : ''}`}
                      >
                        <div className="voice-option-content">
                          <div className="voice-option-header">
                            <input
                              type="radio"
                              id={voice.id}
                              name="voice"
                              value={voice.id}
                              checked={selectedVoice === voice.id}
                              onChange={() => handleVoiceChange(voice.id)}
                              className="voice-radio"
                            />
                            <label htmlFor={voice.id} className="voice-label">
                              <div className="voice-info">
                                <div className="voice-name">{voice.name}</div>
                                <div className="voice-gender">{voice.gender === 'MALE' ? '♂' : '♀'} {voice.gender}</div>
                              </div>
                              <div className="voice-description">{voice.description}</div>
                            </label>
                          </div>
                          
                          <button
                            className="voice-test-button"
                            onClick={() => testVoice(voice.id)}
                            disabled={isPlaying}
                            title="Test this voice"
                          >
                            <Volume2 size={16} />
                            {isPlaying ? 'Playing...' : 'Test'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="settings-note">
            <p>
              <strong>Note:</strong> Voice changes take effect immediately and will be used 
              for all future text-to-speech playback. Your preference is saved locally.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;