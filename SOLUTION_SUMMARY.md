# Solution: "HTML instead of JSON" Error

## What You Asked
You wanted test commands for LegiScan POST requests, but mentioned the error only happens on your VM, not locally.

## The Real Issue
The error `SyntaxError: Unexpected token '<', "<!doctype "... is not valid JSON` means your **frontend** is getting an HTML page (like an error page) instead of JSON from your **backend**.

## Why This Happens

Your frontend determines the backend URL like this:

```javascript
// frontend/src/components/Legislation.jsx
const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
```

Then makes calls like:
```javascript
const response = await fetch(`${API_URL}/states`);
```

**On your local machine:** `API_URL` = `http://127.0.0.1:8000` ✓ Works  
**On your VM:** `API_URL` = probably still `http://127.0.0.1:8000` ✗ Wrong! Should be `https://debatesim.us`

## The Solution

### Option 1: Quick Fix (Recommended)

Run the diagnostic script on your VM:
```bash
./diagnose_frontend_url.sh
```

This will tell you exactly what's wrong and how to fix it.

### Option 2: Manual Fix

**Step 1:** Set the correct API URL for production
```bash
cd /path/to/DebateSim/frontend

# Create production environment file
echo "VITE_API_URL=https://debatesim.us" > .env.production
```

**Step 2:** Rebuild the frontend with the correct URL
```bash
npm run build
```

**Step 3:** Make sure backend is running
```bash
cd /path/to/DebateSim
ps aux | grep main.py  # Check if running

# If not running, start it:
source venv/bin/activate
python main.py
```

**Step 4:** Verify the fix
```bash
# From your VM, test backend directly
curl http://localhost:8000/states

# Should return JSON with states, not HTML
```

**Step 5:** Clear browser cache and reload

## Test Commands You Asked For

Here are the test commands, but these are for testing the **backend** (not the issue):

```bash
# Test LegiScan endpoints on your backend
export BACKEND_URL="https://debatesim.us"

# GET - List states
curl -X GET "$BACKEND_URL/states"

# GET - California sessions  
curl -X GET "$BACKEND_URL/state-sessions/CA"

# POST - Search bills
curl -X POST "$BACKEND_URL/search-state-bills" \
  -H "Content-Type: application/json" \
  -d '{"state":"CA","query":"education","limit":5}'
```

You can also use the automated script:
```bash
./test_legiscan_endpoints.sh
```

(You already updated this to use `https://debatesim.us` ✓)

## Files Created to Help You

1. **`diagnose_frontend_url.sh`** - Run this to diagnose the problem
2. **`test_legiscan_endpoints.sh`** - Test backend LegiScan endpoints
3. **`LEGISCAN_TEST_COMMANDS.md`** - Individual curl commands to copy-paste
4. **`VM_TROUBLESHOOTING.md`** - Complete troubleshooting guide
5. **`FRONTEND_URL_FIX.md`** - Detailed explanation of the URL issue

## The Key Insight

The LegiScan service code is **correct** - it properly calls `https://api.legiscan.com/`. 

The issue is your **frontend build** has the wrong backend URL baked into it. When you build with Vite, the `VITE_API_URL` environment variable gets compiled into the JavaScript bundle. 

If you built on your local machine without `.env.production`, it used the default `http://127.0.0.1:8000`. When deployed to the VM, the frontend still tries to call `127.0.0.1:8000` (which doesn't exist on the client's browser), so it fails and probably gets an error page from nginx or the browser.

## Quick Verification

Run this in your browser console when on the VM site:
```javascript
console.log(import.meta.env.VITE_API_URL)
```

If it shows `127.0.0.1:8000`, that's your problem. It should show `https://debatesim.us`.

## Next Steps

1. Run `./diagnose_frontend_url.sh` on your VM
2. Follow its recommendations
3. Rebuild frontend with correct URL
4. Clear browser cache and test

The diagnostic script will show you exactly what's wrong!

