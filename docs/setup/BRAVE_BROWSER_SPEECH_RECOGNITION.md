# Brave Browser Speech Recognition Fix

## 🦁 **The Problem**

Brave browser's privacy features block Google's speech recognition servers, causing "network" errors. This is a known issue with Brave's aggressive privacy protections.

## 🔧 **Quick Fix (Recommended)**

### Method 1: Disable Brave Shields (Easiest)

1. **Click the lion icon (🦁)** in the address bar
2. **Set "Shields" to "Down"**
3. **Refresh the page**
4. **Try speech recognition again**

This should work immediately!

## 🛠️ **Alternative Solutions**

### Method 2: Allow Cookies and Site Data

1. Go to **Settings** > **Shields** > **Site and shield settings**
2. Set **"Cookies and site data"** to **"Allow all"**
3. Refresh the page
4. Try speech recognition

### Method 3: Use Chrome Instead

1. Open **Chrome browser**
2. Go to the same URL: `http://localhost:5173/speech-test`
3. Speech recognition works immediately
4. No additional settings needed

### Method 4: Brave Settings (Advanced)

1. Go to `chrome://settings/content/microphone`
2. Ensure the site is **allowed**
3. Go to `chrome://settings/content/cookies`
4. Set to **"Allow all"**
5. Refresh the page

## 🔍 **Why This Happens**

Brave browser blocks:
- **Google's speech recognition servers**
- **Cookies needed for speech recognition**
- **Network requests to speech services**

This is by design for privacy, but breaks speech recognition features.

## ✅ **Testing Your Fix**

1. Go to: `http://localhost:5173/speech-test`
2. Click **"Start Recording"**
3. You should see: **"Listening... Speak now!"**
4. Speak clearly into your microphone
5. Text should appear in the transcript area

## 🎯 **Expected Success Logs**

```
[timestamp] SpeechRecognition started
[timestamp] Audio capture started
[timestamp] Sound detected
[timestamp] Speech started
[timestamp] SpeechRecognition result received: {...}
[timestamp] Transcript update: {...}
```

## ❌ **If Still Not Working**

### Check These Settings:

1. **Brave Shields**: Must be "Down" for this site
2. **Microphone Permissions**: Allow when prompted
3. **Cookies**: Must be allowed
4. **Network**: Check if firewall/VPN is blocking

### Alternative Browsers:

- **Chrome**: Works immediately
- **Edge**: Works immediately  
- **Firefox**: Limited support
- **Safari**: Limited support

## 🚀 **For Production Use**

If you need speech recognition in production:

1. **Recommend Chrome/Edge** to users
2. **Provide clear Brave instructions**
3. **Offer typing as fallback**
4. **Test on multiple browsers**

## 📱 **Mobile Devices**

- **Android Chrome**: Works well
- **iOS Safari**: Limited support
- **Brave Mobile**: Same issues as desktop

## 🔧 **Technical Details**

The network error occurs because:
1. Brave blocks requests to `speech.googleapis.com`
2. Speech recognition needs Google's servers
3. Brave's privacy features prevent this connection
4. No local speech recognition available

## ✅ **Success Indicators**

When working correctly, you should see:
- ✅ "Listening... Speak now!" message
- ✅ Real-time transcript updates
- ✅ No network errors in debug logs
- ✅ Speech recognition results in console

---

**Note**: This is a Brave browser limitation, not a bug in our code. The speech recognition works perfectly in Chrome and Edge browsers. 