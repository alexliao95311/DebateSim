import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Volume2, Play, Edit2, Check, X, History, UserCheck } from 'lucide-react';
import UserDropdown from './UserDropdown';
import Footer from './Footer.jsx';
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

  // User Profile State
  const [userProfile, setUserProfile] = useState({
    citizenshipStatus: '',
    immigrationStatus: '',
    race: '',
    ethnicity: '',
    socioeconomicStatus: '',
    age: '',
    education: '',
    employment: '',
    disability: '',
    veteranStatus: '',
    other: ''
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');

  // Fetch available voices from the backend
  useEffect(() => {
    const fetchVoices = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
        const response = await fetch(`${API_URL}/tts/voices`);
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

  // Load user profile from Firestore or localStorage
  useEffect(() => {
    const loadUserProfile = async () => {
      setProfileLoading(true);
      try {
        if (user && !user.isGuest) {
          // Load from Firestore for authenticated users
          const db = getFirestore();
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData.profile) {
              setUserProfile(prevProfile => ({
                ...prevProfile,
                ...userData.profile
              }));
            }
          }
        } else {
          // Load from localStorage for guest users
          const savedProfile = localStorage.getItem('user-profile');
          if (savedProfile) {
            try {
              const parsedProfile = JSON.parse(savedProfile);
              setUserProfile(prevProfile => ({
                ...prevProfile,
                ...parsedProfile
              }));
            } catch (parseErr) {
              console.error('Error parsing saved profile:', parseErr);
            }
          }
        }
      } catch (err) {
        console.error('Error loading user profile:', err);
        setProfileError('Failed to load profile data');
      } finally {
        setProfileLoading(false);
      }
    };

    loadUserProfile();
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
      const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
      const response = await fetch(`${API_URL}/tts/synthesize`, {
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

  // Handle profile field changes
  const handleProfileChange = (field, value) => {
    setUserProfile(prev => ({
      ...prev,
      [field]: value
    }));

    // Auto-save for logged-in users
    if (user && !user.isGuest) {
      saveUserProfile({ ...userProfile, [field]: value });
    } else {
      // For guests, save to localStorage
      const updatedProfile = { ...userProfile, [field]: value };
      localStorage.setItem('user-profile', JSON.stringify(updatedProfile));
    }
  };

  // Save user profile to Firestore
  const saveUserProfile = async (profileData = userProfile) => {
    if (!user || user.isGuest) return;

    setProfileSaving(true);
    setProfileError('');

    try {
      const db = getFirestore();
      const userDocRef = doc(db, 'users', user.uid);

      await setDoc(userDocRef, {
        profile: profileData,
        lastUpdated: new Date()
      }, { merge: true });

    } catch (err) {
      console.error('Error saving user profile:', err);
      setProfileError('Failed to save profile data');
    } finally {
      setProfileSaving(false);
    }
  };

  return (
    <div className="settings-container">
      {/* Header matching Home page style */}
      <header className="home-header">
        <div className="home-header-content">
          <div className="home-header-left">
            {/* Empty space for alignment */}
          </div>

          <div className="home-header-center" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            cursor: 'pointer'
          }}
          onClick={() => navigate('/')}
          >
            <h1 className="home-site-title">Settings</h1>
          </div>

          <div className="home-header-right">
            <UserDropdown user={user} onLogout={onLogout} className="home-user-dropdown" />
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

        {/* User Profile Section */}
        <div className="settings-section">
          <div className="settings-section-header">
            <h3>Personal Profile</h3>
          </div>

          <p className="settings-section-description">
            Help us understand how legislation affects you personally. This information will be used to provide personalized analysis of how bills might impact your specific circumstances.
            {user && !user.isGuest ? ' Your profile will be saved to your account.' : ' Your profile will be saved locally.'}
          </p>

          {profileError && (
            <div className="settings-error">
              <p>{profileError}</p>
            </div>
          )}

          {profileLoading ? (
            <div className="settings-loading">
              <p>Loading profile data...</p>
            </div>
          ) : (
            <div className="profile-fields-grid">
              <div className="profile-field">
                <label htmlFor="citizenshipStatus" className="profile-label">
                  Citizenship Status
                </label>
                <select
                  id="citizenshipStatus"
                  value={userProfile.citizenshipStatus}
                  onChange={(e) => handleProfileChange('citizenshipStatus', e.target.value)}
                  className="profile-select"
                >
                  <option value="">Select status</option>
                  <option value="citizen">U.S. Citizen</option>
                  <option value="permanent_resident">Permanent Resident</option>
                  <option value="temporary_resident">Temporary Resident</option>
                  <option value="undocumented">Undocumented</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>

              <div className="profile-field">
                <label htmlFor="immigrationStatus" className="profile-label">
                  Immigration Status (if applicable)
                </label>
                <select
                  id="immigrationStatus"
                  value={userProfile.immigrationStatus}
                  onChange={(e) => handleProfileChange('immigrationStatus', e.target.value)}
                  className="profile-select"
                >
                  <option value="">Select status</option>
                  <option value="visa_holder">Visa Holder</option>
                  <option value="asylum_seeker">Asylum Seeker</option>
                  <option value="refugee">Refugee</option>
                  <option value="daca">DACA Recipient</option>
                  <option value="tps">TPS Holder</option>
                  <option value="other">Other</option>
                  <option value="not_applicable">Not Applicable</option>
                </select>
              </div>

              <div className="profile-field">
                <label htmlFor="race" className="profile-label">
                  Race
                </label>
                <select
                  id="race"
                  value={userProfile.race}
                  onChange={(e) => handleProfileChange('race', e.target.value)}
                  className="profile-select"
                >
                  <option value="">Select race</option>
                  <option value="american_indian">American Indian or Alaska Native</option>
                  <option value="asian">Asian</option>
                  <option value="black">Black or African American</option>
                  <option value="native_hawaiian">Native Hawaiian or Other Pacific Islander</option>
                  <option value="white">White</option>
                  <option value="multiracial">Two or More Races</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>

              <div className="profile-field">
                <label htmlFor="ethnicity" className="profile-label">
                  Ethnicity
                </label>
                <select
                  id="ethnicity"
                  value={userProfile.ethnicity}
                  onChange={(e) => handleProfileChange('ethnicity', e.target.value)}
                  className="profile-select"
                >
                  <option value="">Select ethnicity</option>
                  <option value="hispanic_latino">Hispanic or Latino</option>
                  <option value="not_hispanic_latino">Not Hispanic or Latino</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>

              <div className="profile-field">
                <label htmlFor="socioeconomicStatus" className="profile-label">
                  Income Level
                </label>
                <select
                  id="socioeconomicStatus"
                  value={userProfile.socioeconomicStatus}
                  onChange={(e) => handleProfileChange('socioeconomicStatus', e.target.value)}
                  className="profile-select"
                >
                  <option value="">Select income level</option>
                  <option value="low_income">Low Income (under $25,000)</option>
                  <option value="lower_middle">Lower Middle ($25,000 - $49,999)</option>
                  <option value="middle_income">Middle Income ($50,000 - $99,999)</option>
                  <option value="upper_middle">Upper Middle ($100,000 - $199,999)</option>
                  <option value="high_income">High Income ($200,000+)</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>

              <div className="profile-field">
                <label htmlFor="age" className="profile-label">
                  Age Range
                </label>
                <select
                  id="age"
                  value={userProfile.age}
                  onChange={(e) => handleProfileChange('age', e.target.value)}
                  className="profile-select"
                >
                  <option value="">Select age range</option>
                  <option value="under_18">Under 18</option>
                  <option value="18_24">18-24</option>
                  <option value="25_34">25-34</option>
                  <option value="35_44">35-44</option>
                  <option value="45_54">45-54</option>
                  <option value="55_64">55-64</option>
                  <option value="65_plus">65+</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>

              <div className="profile-field">
                <label htmlFor="education" className="profile-label">
                  Education Level
                </label>
                <select
                  id="education"
                  value={userProfile.education}
                  onChange={(e) => handleProfileChange('education', e.target.value)}
                  className="profile-select"
                >
                  <option value="">Select education level</option>
                  <option value="no_high_school">No High School Diploma</option>
                  <option value="high_school">High School Diploma/GED</option>
                  <option value="some_college">Some College</option>
                  <option value="associates">Associate's Degree</option>
                  <option value="bachelors">Bachelor's Degree</option>
                  <option value="masters">Master's Degree</option>
                  <option value="doctoral">Doctoral Degree</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>

              <div className="profile-field">
                <label htmlFor="employment" className="profile-label">
                  Employment Status
                </label>
                <select
                  id="employment"
                  value={userProfile.employment}
                  onChange={(e) => handleProfileChange('employment', e.target.value)}
                  className="profile-select"
                >
                  <option value="">Select employment status</option>
                  <option value="employed_full_time">Employed Full-time</option>
                  <option value="employed_part_time">Employed Part-time</option>
                  <option value="self_employed">Self-employed</option>
                  <option value="unemployed">Unemployed</option>
                  <option value="student">Student</option>
                  <option value="retired">Retired</option>
                  <option value="disabled">Unable to work due to disability</option>
                  <option value="homemaker">Homemaker</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>

              <div className="profile-field">
                <label htmlFor="disability" className="profile-label">
                  Disability Status
                </label>
                <select
                  id="disability"
                  value={userProfile.disability}
                  onChange={(e) => handleProfileChange('disability', e.target.value)}
                  className="profile-select"
                >
                  <option value="">Select status</option>
                  <option value="no_disability">No Disability</option>
                  <option value="physical_disability">Physical Disability</option>
                  <option value="cognitive_disability">Cognitive Disability</option>
                  <option value="sensory_disability">Sensory Disability</option>
                  <option value="mental_health">Mental Health Condition</option>
                  <option value="multiple_disabilities">Multiple Disabilities</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>

              <div className="profile-field">
                <label htmlFor="veteranStatus" className="profile-label">
                  Veteran Status
                </label>
                <select
                  id="veteranStatus"
                  value={userProfile.veteranStatus}
                  onChange={(e) => handleProfileChange('veteranStatus', e.target.value)}
                  className="profile-select"
                >
                  <option value="">Select status</option>
                  <option value="veteran">Veteran</option>
                  <option value="active_duty">Active Duty</option>
                  <option value="reservist">Reservist/National Guard</option>
                  <option value="military_family">Military Family Member</option>
                  <option value="not_applicable">Not Applicable</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>

              <div className="profile-field profile-field-full">
                <label htmlFor="other" className="profile-label">
                  Other Relevant Information
                </label>
                <textarea
                  id="other"
                  value={userProfile.other}
                  onChange={(e) => handleProfileChange('other', e.target.value)}
                  className="profile-textarea"
                  placeholder="Any other information that might be relevant to how legislation affects you (e.g., small business owner, healthcare worker, student, etc.)"
                  rows={3}
                />
              </div>
            </div>
          )}

          {profileSaving && (
            <div className="settings-saving">
              <p>Saving profile...</p>
            </div>
          )}
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

      <Footer />
    </div>
  );
};

export default Settings;