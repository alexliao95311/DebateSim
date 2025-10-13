# Frontend URL Configuration Fix

## The Real Problem

Your frontend is getting HTML instead of JSON because it's calling the wrong URL or the backend isn't responding at that URL.

## How the Frontend Gets the API URL

```javascript
// frontend/src/components/Legislation.jsx (line 19)
const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
```

Then it makes calls like:
```javascript
const response = await fetch(`${API_URL}/states`);
```

## The Fix

### 1. Check what URL the frontend is actually using

Open browser console and look for this log:
```
API_URL: <the URL being used>
```

Or check the Network tab in DevTools to see what URL is being called when you get the error.

### 2. Set the correct API URL for your VM

**Option A: Environment Variable (for local development)**
```bash
# In frontend/.env.local
VITE_API_URL=https://debatesim.us
```

**Option B: Build-time Configuration (for production)**
```bash
cd /path/to/DebateSim/frontend

# Create/update .env.production
echo "VITE_API_URL=https://debatesim.us" > .env.production

# Rebuild frontend
npm run build

# Deploy the new dist/ folder
```

**Option C: Runtime Check (temporary test)**
```bash
# Check what the built frontend has
cd /path/to/DebateSim/frontend/dist/assets

# Search for API_URL in the built JavaScript
grep -r "127.0.0.1:8000" .
grep -r "debatesim.us" .

# This shows what URL is baked into your build
```

### 3. Verify backend is actually running at that URL

```bash
# Test from VM
curl https://debatesim.us/states

# Expected: JSON with states
# If you get HTML: backend issue or nginx misconfiguration
```

### 4. Check nginx configuration

If using nginx as reverse proxy, make sure it's forwarding to your backend:

```nginx
# Example nginx config
server {
    listen 80;
    server_name debatesim.us;

    # Serve frontend static files
    location / {
        root /path/to/DebateSim/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Proxy API calls to backend
    location /states {
        proxy_pass http://localhost:8000/states;
        proxy_set_header Host $host;
    }
    
    location /state-bills {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
    }
    
    # Or proxy ALL API calls
    location /api/ {
        rewrite ^/api/(.*) /$1 break;
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
    }
}
```

## Quick Diagnosis Script

Run this on your VM:

```bash
#!/bin/bash
echo "=== Frontend URL Diagnostic ==="
echo ""

# Check what URL is in the built frontend
echo "1. Checking built frontend for API URL:"
cd /path/to/DebateSim/frontend/dist/assets
grep -h "VITE_API_URL\|127.0.0.1:8000\|debatesim.us" *.js 2>/dev/null | head -5
echo ""

# Check if backend responds
echo "2. Testing backend directly:"
curl -s http://localhost:8000/ | head -20
echo ""

# Check if backend responds via public URL
echo "3. Testing backend via public URL:"
curl -s https://debatesim.us/states | head -20
echo ""

# Check nginx logs for errors
echo "4. Recent nginx errors:"
sudo tail -5 /var/log/nginx/error.log 2>/dev/null || echo "No nginx or no access"
echo ""

# Check if backend is running
echo "5. Backend process:"
ps aux | grep "[m]ain.py"
echo ""

# Check what's listening on port 8000
echo "6. Port 8000 status:"
sudo netstat -tlnp | grep 8000 || echo "Nothing on port 8000"
```

## The Most Common Issue

**Problem:** Frontend is built with local URL (`127.0.0.1:8000`) but deployed to VM

**Solution:**
```bash
# On your local machine (before deploying)
cd /path/to/DebateSim/frontend

# Set production URL
echo "VITE_API_URL=https://debatesim.us" > .env.production

# Rebuild
npm run build

# Deploy new dist/ to VM
rsync -avz dist/ user@your-vm:/path/to/DebateSim/frontend/dist/
```

## Test If Fix Worked

1. Open browser console
2. Look for "API_URL:" log
3. Check Network tab when fetching states
4. URL should be `https://debatesim.us/states` not `http://127.0.0.1:8000/states`

If still getting HTML, check nginx config and backend logs!

