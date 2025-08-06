# Brave Browser Speech Recognition Troubleshooting

## 🔍 **Step-by-Step Troubleshooting**

### **Step 1: Basic Brave Settings**

1. **Shields Settings**
   - Click the lion icon (🦁) in address bar
   - Set "Shields" to "Down"
   - Refresh the page

2. **Site Settings**
   - Go to `chrome://settings/content/microphone`
   - Ensure this site is "Allowed"
   - Go to `chrome://settings/content/cookies`
   - Set to "Allow all"

### **Step 2: Advanced Brave Settings**

1. **Privacy and Security**
   - Go to Settings > Privacy and security > Site and shield settings
   - Set "Fingerprinting" to "Allow all"
   - Set "HTTPS Everywhere" to "Off"
   - Set "Scripts" to "Allow all"

2. **Additional Settings**
   - Go to Settings > Privacy and security > Cookies and other site data
   - Set "Allow all cookies"
   - Go to Settings > Privacy and security > Site settings > JavaScript
   - Ensure JavaScript is allowed

### **Step 3: Network and Security**

1. **Check Network Blocking**
   - Go to `chrome://settings/content/javascript`
   - Ensure JavaScript is allowed
   - Go to `chrome://settings/content/sound`
   - Ensure sound is allowed

2. **VPN and Firewall**
   - Disable VPN temporarily
   - Check if corporate firewall is blocking
   - Try mobile hotspot instead

### **Step 4: Browser Cache and Extensions**

1. **Clear Browser Data**
   - Go to Settings > Privacy and security > Clear browsing data
   - Select "All time" and clear:
     - Browsing history
     - Cookies and other site data
     - Cached images and files

2. **Disable Extensions**
   - Go to `chrome://extensions/`
   - Disable all extensions temporarily
   - Try speech recognition again

### **Step 5: Test Network Connectivity**

1. **Test Google Services**
   - Open `https://www.google.com` in Brave
   - If blocked, speech recognition won't work
   - Try `https://speech.googleapis.com` (should be accessible)

2. **Check Console for Errors**
   - Press F12 to open developer tools
   - Go to Console tab
   - Look for network errors or blocked requests

## 🛠️ **Brave-Specific Solutions**

### **Solution 1: Disable All Privacy Features**
1. Go to Settings > Shields > Site and shield settings
2. Set ALL options to "Allow all":
   - Ads and trackers
   - Fingerprinting
   - HTTPS Everywhere
   - Scripts
   - Cookies and site data

### **Solution 2: Use Incognito Mode**
1. Open Brave in incognito/private mode
2. Go to the speech test page
3. Try speech recognition
4. Often works better in incognito

### **Solution 3: Check Brave Shields for This Site**
1. Click the lion icon in address bar
2. Click "Site and shield settings"
3. Set everything to "Allow all"
4. Refresh the page

### **Solution 4: Alternative Browsers**
Since you confirmed Safari works:
- **Safari**: ✅ Works (confirmed)
- **Chrome**: ✅ Should work
- **Edge**: ✅ Should work
- **Firefox**: ⚠️ Limited support

## 🔧 **Technical Debugging**

### **Check These URLs in Brave:**
1. `chrome://settings/content/microphone`
2. `chrome://settings/content/cookies`
3. `chrome://settings/content/javascript`
4. `chrome://settings/content/sound`

### **Test Network Access:**
1. Try accessing `https://www.google.com`
2. Try accessing `https://speech.googleapis.com`
3. Check if any requests are blocked in Network tab

### **Console Commands to Test:**
```javascript
// Test if speech recognition is available
console.log('webkitSpeechRecognition:', 'webkitSpeechRecognition' in window);
console.log('SpeechRecognition:', 'SpeechRecognition' in window);

// Test microphone access
navigator.mediaDevices.getUserMedia({ audio: true })
  .then(stream => console.log('✅ Microphone access granted'))
  .catch(err => console.log('❌ Microphone access denied:', err));

// Test network connectivity
fetch('https://www.google.com/favicon.ico', { method: 'HEAD' })
  .then(() => console.log('✅ Can reach Google'))
  .catch(err => console.log('❌ Cannot reach Google:', err));
```

## 🎯 **Most Likely Causes**

1. **Brave Shields blocking Google's speech servers**
2. **Cookies disabled** (speech recognition needs cookies)
3. **JavaScript blocked** (speech recognition needs JavaScript)
4. **Fingerprinting protection** (may interfere with speech recognition)
5. **HTTPS Everywhere** (may redirect speech requests)
6. **VPN or corporate firewall** blocking Google services

## ✅ **Quick Test**

1. Go to: `http://localhost:5173/speech-test`
2. Open browser console (F12)
3. Click "Start Recording"
4. Check console for detailed debug information
5. Look for any blocked network requests

## 🚨 **If Still Not Working**

### **Last Resort Options:**
1. **Use Chrome instead** - speech recognition works immediately
2. **Use Safari** - you confirmed it works
3. **Use Edge** - should work without issues
4. **Disable all Brave privacy features** temporarily

### **Report the Issue:**
If none of the above work, it might be a Brave browser bug. Report to:
- Brave browser team
- Include debug logs from the test page
- Mention that it works in Safari but not Brave

---

**Note**: Speech recognition requires access to Google's servers. Brave's privacy features are designed to block such requests, which is why it works in Safari but not Brave. 