import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Volume2, Play, Edit2, Check, X } from 'lucide-react';
import UserDropdown from './UserDropdown';
import { getFirestore, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import voicePreferenceService from '../services/voicePreferenceService';
import './Settings.css';

const Settings = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState('en-US-Chirp3-HD-Achernar');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState(user?.displayName || '');
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState('');

  // Fetch available voices from the backend
  useEffect(() => {
    const fetchVoices = async () => {
      try {
        const response = await fetch('http://localhost:8000/tts/voices');
        const data = await response.json();

        if (data.success) {
          setAvailableVoices(data.voices);

          // Load user's saved voice preference
          if (user && !user.isGuest) {
            await loadUserVoicePreference();
          } else {
            // Use default voice for guests
            setSelectedVoice(data.default_voice);
          }
        } else {
          setError('Failed to load available voices');
        }
      } catch (err) {
        console.error('Error fetching voices:', err);
        setError('Failed to connect to voice service');
      } finally {
        setLoading(false);
      }
    };

    fetchVoices();
  }, [user]);

  // Load user's voice preference from Firestore
  const loadUserVoicePreference = async () => {
    if (!user || user.isGuest) return;

    try {
      const db = getFirestore();
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.voicePreference) {
          setSelectedVoice(userData.voicePreference);
        }
      }
    } catch (err) {
      console.error('Error loading voice preference:', err);
    }
  };

  // Save user's voice preference to Firestore
  const saveVoicePreference = async (voiceId) => {
    if (!user || user.isGuest) {
      // For guests, save to localStorage
      localStorage.setItem('tts-voice-preference', voiceId);
      return;
    }

    setSaving(true);
    try {
      const db = getFirestore();
      const userDocRef = doc(db, 'users', user.uid);

      await setDoc(userDocRef, {
        voicePreference: voiceId,
        lastUpdated: new Date()
      }, { merge: true });

    } catch (err) {
      console.error('Error saving voice preference:', err);
      setError('Failed to save voice preference');
    } finally {
      setSaving(false);
    }
  };

  // Handle voice selection change
  const handleVoiceChange = (voiceId) => {
    setSelectedVoice(voiceId);
    saveVoicePreference(voiceId);
    // Update the voice preference service so other components get the new voice
    voicePreferenceService.setCurrentVoice(voiceId);
  };

  // Test voice functionality
  const testVoice = async (voiceId) => {
    if (testing) return;

    setTesting(true);
    try {
      const response = await fetch('http://localhost:8000/tts/synthesize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: "Hello! This is a sample of how this voice sounds for text-to-speech in DebateSim.",
          voice_name: voiceId,
          rate: 1.0,
          pitch: 0,
          volume: 1.0
        }),
      });

      const data = await response.json();

      if (data.success && data.audio_content) {
        // Convert base64 to audio and play
        const audioBlob = new Blob([
          Uint8Array.from(atob(data.audio_content), c => c.charCodeAt(0))
        ], { type: 'audio/mp3' });

        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);

        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
        };

        audio.onerror = () => {
          URL.revokeObjectURL(audioUrl);
          setError('Audio playback failed');
        };

        await audio.play();
      } else {
        setError('Voice test failed');
      }
    } catch (err) {
      console.error('Error testing voice:', err);
      setError('Voice test failed. Please ensure the TTS service is running.');
    } finally {
      setTesting(false);
    }
  };

  // Handle username editing
  const handleEditName = () => {
    setIsEditingName(true);
    setNewDisplayName(user?.displayName || '');
    setNameError('');
  };

  const handleCancelEdit = () => {
    setIsEditingName(false);
    setNewDisplayName(user?.displayName || '');
    setNameError('');
  };

  const handleSaveName = async () => {
    if (!newDisplayName.trim()) {
      setNameError('Display name cannot be empty');
      return;
    }

    if (newDisplayName.trim().length < 2) {
      setNameError('Display name must be at least 2 characters long');
      return;
    }

    if (newDisplayName.trim().length > 50) {
      setNameError('Display name must be less than 50 characters');
      return;
    }

    setSavingName(true);
    setNameError('');

    try {
      const trimmedName = newDisplayName.trim();

      if (user && !user.isGuest) {
        // Update Firebase Auth profile
        await updateProfile(user, {
          displayName: trimmedName
        });

        // Update Firestore user document
        const db = getFirestore();
        const userDocRef = doc(db, 'users', user.uid);
        await updateDoc(userDocRef, {
          displayName: trimmedName,
          lastUpdated: new Date()
        });

        // Update local user object
        user.displayName = trimmedName;
      } else {
        // For guest users, update localStorage
        const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
        storedUser.displayName = trimmedName;
        localStorage.setItem('user', JSON.stringify(storedUser));

        // Update the user object
        if (user) {
          user.displayName = trimmedName;
        }
      }

      setIsEditingName(false);
    } catch (err) {
      console.error('Error updating display name:', err);
      setNameError('Failed to update display name. Please try again.');
    } finally {
      setSavingName(false);
    }
  };

  return (
    <div className="settings-container">
      {/* Header matching Home page style */}
      <header className="settings-header">
        <div className="settings-header-content">
          <div className="settings-header-left">
            <button
              className="settings-back-button"
              onClick={() => navigate(-1)}
              title="Go back"
            >
              <ArrowLeft size={20} />
              <span>Back</span>
            </button>
          </div>

          <div className="settings-header-center">
            <h1 className="settings-site-title">Settings</h1>
          </div>

          <div className="settings-header-right">
            <UserDropdown user={user} onLogout={onLogout} className="settings-user-dropdown" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="settings-main-content">
        {/* User Welcome Section */}
        <div className="settings-welcome-section">
          <div className="settings-user-card">
            {/* Edit button in top right corner */}
            {!isEditingName && (
              <button
                onClick={handleEditName}
                className="settings-card-edit-btn"
                title="Edit display name"
              >
                <Edit2 size={16} />
              </button>
            )}

            <div className="settings-user-avatar">
              <User size={48} />
            </div>
            <div className="settings-user-info">
              {isEditingName ? (
                <div className="settings-name-edit">
                  <input
                    type="text"
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    className="settings-name-input"
                    placeholder="Enter your display name"
                    maxLength={50}
                    disabled={savingName}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSaveName();
                      } else if (e.key === 'Escape') {
                        handleCancelEdit();
                      }
                    }}
                  />
                  <div className="settings-name-edit-buttons">
                    <button
                      onClick={handleSaveName}
                      disabled={savingName}
                      className="settings-name-save-btn"
                      title="Save changes"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      disabled={savingName}
                      className="settings-name-cancel-btn"
                      title="Cancel changes"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  {nameError && (
                    <div className="settings-name-error">
                      {nameError}
                    </div>
                  )}
                  {savingName && (
                    <div className="settings-name-saving">
                      Saving...
                    </div>
                  )}
                </div>
              ) : (
                <div className="settings-name-display">
                  <h2 className="settings-user-name">{user?.displayName || 'Guest User'}</h2>
                </div>
              )}
              <p className="settings-user-subtitle">Welcome to your settings</p>
            </div>
          </div>
        </div>

        {/* Voice Settings Section */}
        <div className="settings-section">
          <div className="settings-section-header">
            <Volume2 size={24} />
            <h3>Text-to-Speech Voice</h3>
          </div>

          <p className="settings-section-description">
            Choose your preferred voice for all text-to-speech features in DebateSim.
            {user && !user.isGuest ? ' Your preference will be saved to your account.' : ' Your preference will be saved locally.'}
          </p>

          {error && (
            <div className="settings-error">
              <p>{error}</p>
            </div>
          )}

          {loading ? (
            <div className="settings-loading">
              <p>Loading available voices...</p>
            </div>
          ) : (
            <div className="voice-selection-grid">
              {availableVoices.map((voice) => (
                <div
                  key={voice.name}
                  className={`voice-card ${selectedVoice === voice.name ? 'selected' : ''}`}
                >
                  <div className="voice-card-content">
                    <div className="voice-info">
                      <input
                        type="radio"
                        id={voice.name}
                        name="voice"
                        value={voice.name}
                        checked={selectedVoice === voice.name}
                        onChange={() => handleVoiceChange(voice.name)}
                        className="voice-radio"
                      />
                      <label htmlFor={voice.name} className="voice-label">
                        <div className="voice-name">{voice.name}</div>
                        <div className="voice-details">
                          <span className="voice-gender">{voice.gender === 'MALE' ? '♂' : '♀'} {voice.gender}</span>
                          <span className="voice-description">{voice.description}</span>
                        </div>
                      </label>
                    </div>

                    <button
                      className="voice-test-button"
                      onClick={() => testVoice(voice.name)}
                      disabled={testing}
                      title="Test this voice"
                    >
                      <Play size={16} />
                      {testing ? 'Testing...' : 'Test'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {saving && (
            <div className="settings-saving">
              <p>Saving preference...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;