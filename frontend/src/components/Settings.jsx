import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Volume2, Play, Edit2, Check, X, History, UserCheck, Languages } from 'lucide-react';
import UserDropdown from './UserDropdown';
import Footer from './Footer.jsx';
import { getFirestore, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import voicePreferenceService from '../services/voicePreferenceService';
import languagePreferenceService from '../services/languagePreferenceService';
import { useTranslation } from '../utils/translations';
import './Settings.css';

const Settings = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState('en-US-Chirp3-HD-Achernar');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [savingLanguage, setSavingLanguage] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState(user?.displayName || '');
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState('');

  // User Profile State
  const [userProfile, setUserProfile] = useState({
    state: '',
    sector: '',
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

  // US States list
  const US_STATES = [
    { code: 'AL', name: 'Alabama' },
    { code: 'AK', name: 'Alaska' },
    { code: 'AZ', name: 'Arizona' },
    { code: 'AR', name: 'Arkansas' },
    { code: 'CA', name: 'California' },
    { code: 'CO', name: 'Colorado' },
    { code: 'CT', name: 'Connecticut' },
    { code: 'DE', name: 'Delaware' },
    { code: 'FL', name: 'Florida' },
    { code: 'GA', name: 'Georgia' },
    { code: 'HI', name: 'Hawaii' },
    { code: 'ID', name: 'Idaho' },
    { code: 'IL', name: 'Illinois' },
    { code: 'IN', name: 'Indiana' },
    { code: 'IA', name: 'Iowa' },
    { code: 'KS', name: 'Kansas' },
    { code: 'KY', name: 'Kentucky' },
    { code: 'LA', name: 'Louisiana' },
    { code: 'ME', name: 'Maine' },
    { code: 'MD', name: 'Maryland' },
    { code: 'MA', name: 'Massachusetts' },
    { code: 'MI', name: 'Michigan' },
    { code: 'MN', name: 'Minnesota' },
    { code: 'MS', name: 'Mississippi' },
    { code: 'MO', name: 'Missouri' },
    { code: 'MT', name: 'Montana' },
    { code: 'NE', name: 'Nebraska' },
    { code: 'NV', name: 'Nevada' },
    { code: 'NH', name: 'New Hampshire' },
    { code: 'NJ', name: 'New Jersey' },
    { code: 'NM', name: 'New Mexico' },
    { code: 'NY', name: 'New York' },
    { code: 'NC', name: 'North Carolina' },
    { code: 'ND', name: 'North Dakota' },
    { code: 'OH', name: 'Ohio' },
    { code: 'OK', name: 'Oklahoma' },
    { code: 'OR', name: 'Oregon' },
    { code: 'PA', name: 'Pennsylvania' },
    { code: 'RI', name: 'Rhode Island' },
    { code: 'SC', name: 'South Carolina' },
    { code: 'SD', name: 'South Dakota' },
    { code: 'TN', name: 'Tennessee' },
    { code: 'TX', name: 'Texas' },
    { code: 'UT', name: 'Utah' },
    { code: 'VT', name: 'Vermont' },
    { code: 'VA', name: 'Virginia' },
    { code: 'WA', name: 'Washington' },
    { code: 'WV', name: 'West Virginia' },
    { code: 'WI', name: 'Wisconsin' },
    { code: 'WY', name: 'Wyoming' },
    { code: 'DC', name: 'District of Columbia' }
  ];
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

  // Load language preference on mount
  useEffect(() => {
    const loadLanguage = async () => {
      if (user) {
        await languagePreferenceService.loadLanguagePreference(user);
        setSelectedLanguage(languagePreferenceService.getCurrentLanguage());
      } else {
        const savedLanguage = localStorage.getItem('language-preference');
        if (savedLanguage) {
          setSelectedLanguage(savedLanguage);
          languagePreferenceService.setCurrentLanguage(savedLanguage);
        }
      }
    };

    loadLanguage();
  }, [user]);

  // Listen for language changes (separate effect to avoid re-registering listener)
  useEffect(() => {
    const handleLanguageChange = (lang) => {
      setSelectedLanguage(lang);
    };

    languagePreferenceService.addListener(handleLanguageChange);

    return () => {
      languagePreferenceService.removeListener(handleLanguageChange);
    };
  }, []);

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

  // Load user's language preference from Firestore
  const loadUserLanguagePreference = async () => {
    if (!user || user.isGuest) return;

    try {
      const db = getFirestore();
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.languagePreference) {
          setSelectedLanguage(userData.languagePreference);
          languagePreferenceService.setCurrentLanguage(userData.languagePreference);
        }
      }
    } catch (err) {
      console.error('Error loading language preference:', err);
    }
  };

  // Save user's language preference to Firestore
  const saveLanguagePreference = async (languageCode) => {
    if (!user || user.isGuest) {
      // For guests, save to localStorage
      localStorage.setItem('language-preference', languageCode);
      languagePreferenceService.setCurrentLanguage(languageCode);
      return;
    }

    setSavingLanguage(true);
    try {
      const db = getFirestore();
      const userDocRef = doc(db, 'users', user.uid);

      await setDoc(userDocRef, {
        languagePreference: languageCode,
        lastUpdated: new Date()
      }, { merge: true });

      languagePreferenceService.setCurrentLanguage(languageCode);
    } catch (err) {
      console.error('Error saving language preference:', err);
      setError('Failed to save language preference');
    } finally {
      setSavingLanguage(false);
    }
  };

  // Handle language selection change
  const handleLanguageChange = (languageCode) => {
    setSelectedLanguage(languageCode);
    saveLanguagePreference(languageCode);
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

  // Reset profile to default (clear all fields)
  const handleResetProfile = async () => {
    if (!window.confirm(t('settings.profile.resetConfirm'))) {
      return;
    }

    const defaultProfile = {
      state: '',
      sector: '',
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
    };

    setUserProfile(defaultProfile);

    // Save reset profile
    if (user && !user.isGuest) {
      await saveUserProfile(defaultProfile);
    } else {
      // For guests, clear localStorage
      localStorage.setItem('user-profile', JSON.stringify(defaultProfile));
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
            <h1 className="home-site-title">{t('settings.title')}</h1>
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
                      {t('saving')}
                    </div>
                  )}
                </div>
              ) : (
                <div className="settings-name-display">
                  <h2 className="settings-user-name">{user?.displayName || 'Guest User'}</h2>
                </div>
              )}
              <p className="settings-user-subtitle">{t('settings.welcome')}</p>
            </div>
          </div>
        </div>

        {/* User Profile Section */}
        <div className="settings-section">
          <div className="settings-section-header">
            <UserCheck size={24} />
            <h3>{t('settings.profile.title')}</h3>
          </div>

          <p className="settings-section-description">
            {t('settings.profile.description')}
            {user && !user.isGuest ? ` ${t('settings.voice.saved')}` : ` ${t('settings.voice.savedLocal')}`}
          </p>

          {profileError && (
            <div className="settings-error">
              <p>{profileError}</p>
            </div>
          )}

          {profileLoading ? (
            <div className="settings-loading">
              <p>{t('settings.profile.loading')}</p>
            </div>
          ) : (
            <>
              {/* Location Section */}
              <div className="profile-section-group">
                <h4 className="profile-section-title">{t('profile.location')}</h4>
                <div className="profile-fields-grid">
                  <div className="profile-field">
                    <label htmlFor="state" className="profile-label">
                      {t('profile.state')}
                    </label>
                    <select
                      id="state"
                      value={userProfile.state}
                      onChange={(e) => handleProfileChange('state', e.target.value)}
                      className="profile-select"
                    >
                      <option value="">{t('profile.selectState')}</option>
                      {US_STATES.map((state) => (
                        <option key={state.code} value={state.code}>
                          {state.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Demographics Section */}
              <div className="profile-section-group">
                <h4 className="profile-section-title">{t('profile.demographics')}</h4>
                <div className="profile-fields-grid">
                  <div className="profile-field">
                    <label htmlFor="age" className="profile-label">
                      {t('profile.age')}
                    </label>
                    <select
                      id="age"
                      value={userProfile.age}
                      onChange={(e) => handleProfileChange('age', e.target.value)}
                      className="profile-select"
                    >
                      <option value="">{t('profile.selectAge')}</option>
                      <option value="under_18">{t('profile.age.under18')}</option>
                      <option value="18_24">{t('profile.age.18-24')}</option>
                      <option value="25_34">{t('profile.age.25-34')}</option>
                      <option value="35_44">{t('profile.age.35-44')}</option>
                      <option value="45_54">{t('profile.age.45-54')}</option>
                      <option value="55_64">{t('profile.age.55-64')}</option>
                      <option value="65_plus">{t('profile.age.65plus')}</option>
                      <option value="prefer_not_to_say">{t('profile.preferNotToSay')}</option>
                    </select>
                  </div>

                  <div className="profile-field">
                    <label htmlFor="race" className="profile-label">
                      {t('profile.race')}
                    </label>
                    <select
                      id="race"
                      value={userProfile.race}
                      onChange={(e) => handleProfileChange('race', e.target.value)}
                      className="profile-select"
                    >
                      <option value="">{t('profile.selectRace')}</option>
                      <option value="american_indian">{t('profile.race.americanIndian')}</option>
                      <option value="asian">{t('profile.race.asian')}</option>
                      <option value="black">{t('profile.race.black')}</option>
                      <option value="native_hawaiian">{t('profile.race.nativeHawaiian')}</option>
                      <option value="white">{t('profile.race.white')}</option>
                      <option value="multiracial">{t('profile.race.multiracial')}</option>
                      <option value="prefer_not_to_say">{t('profile.preferNotToSay')}</option>
                    </select>
                  </div>

                  <div className="profile-field">
                    <label htmlFor="ethnicity" className="profile-label">
                      {t('profile.ethnicity')}
                    </label>
                    <select
                      id="ethnicity"
                      value={userProfile.ethnicity}
                      onChange={(e) => handleProfileChange('ethnicity', e.target.value)}
                      className="profile-select"
                    >
                      <option value="">{t('profile.selectEthnicity')}</option>
                      <option value="hispanic_latino">{t('profile.ethnicity.hispanic')}</option>
                      <option value="not_hispanic_latino">{t('profile.ethnicity.notHispanic')}</option>
                      <option value="prefer_not_to_say">{t('profile.preferNotToSay')}</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Citizenship & Immigration Section */}
              <div className="profile-section-group">
                <h4 className="profile-section-title">{t('profile.citizenship')}</h4>
                <div className="profile-fields-grid">
                  <div className="profile-field">
                    <label htmlFor="citizenshipStatus" className="profile-label">
                      {t('profile.citizenshipStatus')}
                    </label>
                    <select
                      id="citizenshipStatus"
                      value={userProfile.citizenshipStatus}
                      onChange={(e) => handleProfileChange('citizenshipStatus', e.target.value)}
                      className="profile-select"
                    >
                      <option value="">{t('profile.selectCitizenship')}</option>
                      <option value="citizen">{t('profile.citizenship.citizen')}</option>
                      <option value="permanent_resident">{t('profile.citizenship.permanent')}</option>
                      <option value="temporary_resident">{t('profile.citizenship.temporary')}</option>
                      <option value="undocumented">{t('profile.citizenship.undocumented')}</option>
                      <option value="prefer_not_to_say">{t('profile.preferNotToSay')}</option>
                    </select>
                  </div>

                  <div className="profile-field">
                    <label htmlFor="immigrationStatus" className="profile-label">
                      {t('profile.immigrationStatus')}
                    </label>
                    <select
                      id="immigrationStatus"
                      value={userProfile.immigrationStatus}
                      onChange={(e) => handleProfileChange('immigrationStatus', e.target.value)}
                      className="profile-select"
                    >
                      <option value="">{t('profile.selectImmigration')}</option>
                      <option value="visa_holder">{t('profile.immigration.visa')}</option>
                      <option value="asylum_seeker">{t('profile.immigration.asylum')}</option>
                      <option value="refugee">{t('profile.immigration.refugee')}</option>
                      <option value="daca">{t('profile.immigration.daca')}</option>
                      <option value="tps">{t('profile.immigration.tps')}</option>
                      <option value="other">{t('profile.immigration.other')}</option>
                      <option value="not_applicable">{t('profile.immigration.notApplicable')}</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Economic & Employment Section */}
              <div className="profile-section-group">
                <h4 className="profile-section-title">{t('profile.economic')}</h4>
                <div className="profile-fields-grid">
                  <div className="profile-field">
                    <label htmlFor="socioeconomicStatus" className="profile-label">
                      {t('profile.incomeLevel')}
                    </label>
                    <select
                      id="socioeconomicStatus"
                      value={userProfile.socioeconomicStatus}
                      onChange={(e) => handleProfileChange('socioeconomicStatus', e.target.value)}
                      className="profile-select"
                    >
                      <option value="">{t('profile.selectIncome')}</option>
                      <option value="low_income">{t('profile.income.low')}</option>
                      <option value="lower_middle">{t('profile.income.lowerMiddle')}</option>
                      <option value="middle_income">{t('profile.income.middle')}</option>
                      <option value="upper_middle">{t('profile.income.upperMiddle')}</option>
                      <option value="high_income">{t('profile.income.high')}</option>
                      <option value="prefer_not_to_say">{t('profile.preferNotToSay')}</option>
                    </select>
                  </div>

                  <div className="profile-field">
                    <label htmlFor="employment" className="profile-label">
                      {t('profile.employmentStatus')}
                    </label>
                    <select
                      id="employment"
                      value={userProfile.employment}
                      onChange={(e) => handleProfileChange('employment', e.target.value)}
                      className="profile-select"
                    >
                      <option value="">{t('profile.selectEmployment')}</option>
                      <option value="employed_full_time">{t('profile.employment.fullTime')}</option>
                      <option value="employed_part_time">{t('profile.employment.partTime')}</option>
                      <option value="self_employed">{t('profile.employment.selfEmployed')}</option>
                      <option value="unemployed">{t('profile.employment.unemployed')}</option>
                      <option value="student">{t('profile.employment.student')}</option>
                      <option value="retired">{t('profile.employment.retired')}</option>
                      <option value="disabled">{t('profile.employment.disabled')}</option>
                      <option value="homemaker">{t('profile.employment.homemaker')}</option>
                      <option value="prefer_not_to_say">{t('profile.preferNotToSay')}</option>
                    </select>
                  </div>

                  <div className="profile-field">
                    <label htmlFor="sector" className="profile-label">
                      {t('profile.sector')}
                    </label>
                    <select
                      id="sector"
                      value={userProfile.sector}
                      onChange={(e) => handleProfileChange('sector', e.target.value)}
                      className="profile-select"
                    >
                      <option value="">{t('profile.selectSector')}</option>
                      <option value="technology">{t('profile.sector.technology')}</option>
                      <option value="healthcare">{t('profile.sector.healthcare')}</option>
                      <option value="education">{t('profile.sector.education')}</option>
                      <option value="finance">{t('profile.sector.finance')}</option>
                      <option value="manufacturing">{t('profile.sector.manufacturing')}</option>
                      <option value="agriculture">{t('profile.sector.agriculture')}</option>
                      <option value="energy">{t('profile.sector.energy')}</option>
                      <option value="climate">{t('profile.sector.climate')}</option>
                      <option value="transportation">{t('profile.sector.transportation')}</option>
                      <option value="construction">{t('profile.sector.construction')}</option>
                      <option value="retail">{t('profile.sector.retail')}</option>
                      <option value="hospitality">{t('profile.sector.hospitality')}</option>
                      <option value="government">{t('profile.sector.government')}</option>
                      <option value="nonprofit">{t('profile.sector.nonprofit')}</option>
                      <option value="legal">{t('profile.sector.legal')}</option>
                      <option value="media">{t('profile.sector.media')}</option>
                      <option value="real_estate">{t('profile.sector.realEstate')}</option>
                      <option value="other">{t('profile.sector.other')}</option>
                      <option value="not_applicable">{t('profile.sector.notApplicable')}</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Education Section */}
              <div className="profile-section-group">
                <h4 className="profile-section-title">{t('profile.education')}</h4>
                <div className="profile-fields-grid">
                  <div className="profile-field">
                    <label htmlFor="education" className="profile-label">
                      {t('profile.educationLevel')}
                    </label>
                    <select
                      id="education"
                      value={userProfile.education}
                      onChange={(e) => handleProfileChange('education', e.target.value)}
                      className="profile-select"
                    >
                      <option value="">{t('profile.selectEducation')}</option>
                      <option value="no_high_school">{t('profile.education.noHighSchool')}</option>
                      <option value="high_school">{t('profile.education.highSchool')}</option>
                      <option value="some_college">{t('profile.education.someCollege')}</option>
                      <option value="associates">{t('profile.education.associates')}</option>
                      <option value="bachelors">{t('profile.education.bachelors')}</option>
                      <option value="masters">{t('profile.education.masters')}</option>
                      <option value="doctoral">{t('profile.education.doctoral')}</option>
                      <option value="prefer_not_to_say">{t('profile.preferNotToSay')}</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Health & Military Section */}
              <div className="profile-section-group">
                <h4 className="profile-section-title">{t('profile.health')}</h4>
                <div className="profile-fields-grid">
                  <div className="profile-field">
                    <label htmlFor="disability" className="profile-label">
                      {t('profile.disabilityStatus')}
                    </label>
                    <select
                      id="disability"
                      value={userProfile.disability}
                      onChange={(e) => handleProfileChange('disability', e.target.value)}
                      className="profile-select"
                    >
                      <option value="">{t('profile.selectDisability')}</option>
                      <option value="no_disability">{t('profile.disability.none')}</option>
                      <option value="physical_disability">{t('profile.disability.physical')}</option>
                      <option value="cognitive_disability">{t('profile.disability.cognitive')}</option>
                      <option value="sensory_disability">{t('profile.disability.sensory')}</option>
                      <option value="mental_health">{t('profile.disability.mentalHealth')}</option>
                      <option value="multiple_disabilities">{t('profile.disability.multiple')}</option>
                      <option value="prefer_not_to_say">{t('profile.preferNotToSay')}</option>
                    </select>
                  </div>

                  <div className="profile-field">
                    <label htmlFor="veteranStatus" className="profile-label">
                      {t('profile.veteranStatus')}
                    </label>
                    <select
                      id="veteranStatus"
                      value={userProfile.veteranStatus}
                      onChange={(e) => handleProfileChange('veteranStatus', e.target.value)}
                      className="profile-select"
                    >
                      <option value="">{t('profile.selectVeteran')}</option>
                      <option value="veteran">{t('profile.veteran.veteran')}</option>
                      <option value="active_duty">{t('profile.veteran.activeDuty')}</option>
                      <option value="reservist">{t('profile.veteran.reservist')}</option>
                      <option value="military_family">{t('profile.veteran.militaryFamily')}</option>
                      <option value="not_applicable">{t('profile.veteran.notApplicable')}</option>
                      <option value="prefer_not_to_say">{t('profile.preferNotToSay')}</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Additional Information Section */}
              <div className="profile-section-group">
                <h4 className="profile-section-title">{t('profile.additional')}</h4>
                <div className="profile-fields-grid">
                  <div className="profile-field profile-field-full">
                    <label htmlFor="other" className="profile-label">
                      {t('profile.other')}
                    </label>
                    <textarea
                      id="other"
                      value={userProfile.other}
                      onChange={(e) => handleProfileChange('other', e.target.value)}
                      className="profile-textarea"
                      placeholder={t('profile.otherPlaceholder')}
                      rows={3}
                    />
                  </div>
                </div>
              </div>

              {/* Reset Profile Button */}
              <div className="profile-reset-container">
                <button
                  onClick={handleResetProfile}
                  className="profile-reset-btn"
                  title={t('settings.profile.reset')}
                >
                  {t('settings.profile.reset')}
                </button>
              </div>
            </>
          )}

          {profileSaving && (
            <div className="settings-saving">
              <p>{t('settings.profile.saving')}</p>
            </div>
          )}
        </div>

        {/* Voice Settings Section */}
        <div className="settings-section">
          <div className="settings-section-header">
            <Volume2 size={24} />
            <h3>{t('settings.voice.title')}</h3>
          </div>

          <p className="settings-section-description">
            {t('settings.voice.description')}
            {user && !user.isGuest ? ` ${t('settings.voice.saved')}` : ` ${t('settings.voice.savedLocal')}`}
          </p>

          {error && (
            <div className="settings-error">
              <p>{error}</p>
            </div>
          )}

          {loading ? (
            <div className="settings-loading">
              <p>{t('settings.voice.loading')}</p>
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
                      {testing ? t('settings.voice.testing') : t('settings.voice.test')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {saving && (
            <div className="settings-saving">
              <p>{t('settings.voice.saving')}</p>
            </div>
          )}
        </div>

        {/* Language Settings Section */}
        <div className="settings-section">
          <div className="settings-section-header">
            <Languages size={24} />
            <h3>{t('settings.language.title')}</h3>
          </div>

          <p className="settings-section-description">
            {t('settings.language.description')}
            {user && !user.isGuest ? ` ${t('settings.voice.saved')}` : ` ${t('settings.voice.savedLocal')}`}
          </p>

          <div className="language-selection-container">
            <div className="language-options">
              <label className="language-option">
                <input
                  type="radio"
                  name="language"
                  value="en"
                  checked={selectedLanguage === 'en'}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  className="language-radio"
                />
                <span className="language-label">English</span>
              </label>
              <label className="language-option">
                <input
                  type="radio"
                  name="language"
                  value="zh"
                  checked={selectedLanguage === 'zh'}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  className="language-radio"
                />
                <span className="language-label">Mandarin Chinese (中文)</span>
              </label>
            </div>

            {savingLanguage && (
              <div className="settings-saving">
                <p>{t('settings.language.saving')}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Settings;