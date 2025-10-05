import { getFirestore, doc, getDoc } from 'firebase/firestore';

/**
 * Service for retrieving user profile data
 */
class UserProfileService {
  /**
   * Get user profile data from Firestore or localStorage
   * @param {Object} user - Firebase user object
   * @returns {Object} User profile data
   */
  static async getUserProfile(user) {
    const defaultProfile = {
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

    try {
      if (user && !user.isGuest) {
        // Load from Firestore for authenticated users
        const db = getFirestore();
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.profile) {
            return { ...defaultProfile, ...userData.profile };
          }
        }
      } else {
        // Load from localStorage for guest users
        const savedProfile = localStorage.getItem('user-profile');
        if (savedProfile) {
          try {
            const parsedProfile = JSON.parse(savedProfile);
            return { ...defaultProfile, ...parsedProfile };
          } catch (parseErr) {
            console.error('Error parsing saved profile:', parseErr);
          }
        }
      }
    } catch (err) {
      console.error('Error loading user profile:', err);
    }

    return defaultProfile;
  }

  /**
   * Format user profile for AI analysis prompt
   * @param {Object} profile - User profile data
   * @returns {string} Formatted profile text for AI prompt
   */
  static formatProfileForPrompt(profile) {
    const formatField = (label, value, options = null) => {
      if (!value || value === 'prefer_not_to_say') {
        return `${label}: Not specified`;
      }

      // Map coded values to readable text if options provided
      if (options && options[value]) {
        return `${label}: ${options[value]}`;
      }

      return `${label}: ${value}`;
    };

    // Define human-readable mappings for coded values
    const citizenshipOptions = {
      citizen: 'U.S. Citizen',
      permanent_resident: 'Permanent Resident',
      temporary_resident: 'Temporary Resident',
      undocumented: 'Undocumented'
    };

    const immigrationOptions = {
      visa_holder: 'Visa Holder',
      asylum_seeker: 'Asylum Seeker',
      refugee: 'Refugee',
      daca: 'DACA Recipient',
      tps: 'TPS Holder',
      other: 'Other Immigration Status',
      not_applicable: 'Not Applicable'
    };

    const raceOptions = {
      american_indian: 'American Indian or Alaska Native',
      asian: 'Asian',
      black: 'Black or African American',
      native_hawaiian: 'Native Hawaiian or Other Pacific Islander',
      white: 'White',
      multiracial: 'Two or More Races'
    };

    const ethnicityOptions = {
      hispanic_latino: 'Hispanic or Latino',
      not_hispanic_latino: 'Not Hispanic or Latino'
    };

    const incomeOptions = {
      low_income: 'Low Income (under $25,000)',
      lower_middle: 'Lower Middle Income ($25,000 - $49,999)',
      middle_income: 'Middle Income ($50,000 - $99,999)',
      upper_middle: 'Upper Middle Income ($100,000 - $199,999)',
      high_income: 'High Income ($200,000+)'
    };

    const ageOptions = {
      under_18: 'Under 18',
      '18_24': '18-24',
      '25_34': '25-34',
      '35_44': '35-44',
      '45_54': '45-54',
      '55_64': '55-64',
      '65_plus': '65+'
    };

    const educationOptions = {
      no_high_school: 'No High School Diploma',
      high_school: 'High School Diploma/GED',
      some_college: 'Some College',
      associates: "Associate's Degree",
      bachelors: "Bachelor's Degree",
      masters: "Master's Degree",
      doctoral: 'Doctoral Degree'
    };

    const employmentOptions = {
      employed_full_time: 'Employed Full-time',
      employed_part_time: 'Employed Part-time',
      self_employed: 'Self-employed',
      unemployed: 'Unemployed',
      student: 'Student',
      retired: 'Retired',
      disabled: 'Unable to work due to disability',
      homemaker: 'Homemaker'
    };

    const disabilityOptions = {
      no_disability: 'No Disability',
      physical_disability: 'Physical Disability',
      cognitive_disability: 'Cognitive Disability',
      sensory_disability: 'Sensory Disability',
      mental_health: 'Mental Health Condition',
      multiple_disabilities: 'Multiple Disabilities'
    };

    const veteranOptions = {
      veteran: 'Veteran',
      active_duty: 'Active Duty',
      reservist: 'Reservist/National Guard',
      military_family: 'Military Family Member',
      not_applicable: 'Not Applicable'
    };

    const profileParts = [
      formatField('Citizenship Status', profile.citizenshipStatus, citizenshipOptions),
      formatField('Immigration Status', profile.immigrationStatus, immigrationOptions),
      formatField('Race', profile.race, raceOptions),
      formatField('Ethnicity', profile.ethnicity, ethnicityOptions),
      formatField('Income Level', profile.socioeconomicStatus, incomeOptions),
      formatField('Age Range', profile.age, ageOptions),
      formatField('Education Level', profile.education, educationOptions),
      formatField('Employment Status', profile.employment, employmentOptions),
      formatField('Disability Status', profile.disability, disabilityOptions),
      formatField('Veteran Status', profile.veteranStatus, veteranOptions)
    ];

    if (profile.other && profile.other.trim()) {
      profileParts.push(`Additional Information: ${profile.other.trim()}`);
    }

    return profileParts.join('\n');
  }

  /**
   * Check if user has any profile data filled out
   * @param {Object} profile - User profile data
   * @returns {boolean} True if user has any profile data
   */
  static hasProfileData(profile) {
    if (!profile) return false;

    const fieldsToCheck = [
      'citizenshipStatus', 'immigrationStatus', 'race', 'ethnicity',
      'socioeconomicStatus', 'age', 'education', 'employment',
      'disability', 'veteranStatus', 'other'
    ];

    return fieldsToCheck.some(field =>
      profile[field] &&
      profile[field].trim() !== '' &&
      profile[field] !== 'prefer_not_to_say'
    );
  }
}

export default UserProfileService;