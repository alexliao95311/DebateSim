#!/bin/bash

# Frontend URL Diagnostic Script
# Run this on your VM to diagnose the HTML instead of JSON error

echo "╔═══════════════════════════════════════════════╗"
echo "║   Frontend URL Diagnostic Tool                ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Find the project directory
PROJECT_DIR="/Users/alexliao/Desktop/DebateSim"
if [ ! -d "$PROJECT_DIR" ]; then
    PROJECT_DIR="$HOME/DebateSim"
fi

if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}✗ Cannot find DebateSim directory${NC}"
    exit 1
fi

echo -e "${BLUE}Project directory: $PROJECT_DIR${NC}"
echo ""

# 1. Check what URL is baked into the built frontend
echo "═══════════════════════════════════════════════"
echo "1. Checking built frontend for API URL..."
echo "═══════════════════════════════════════════════"

if [ -d "$PROJECT_DIR/frontend/dist/assets" ]; then
    echo -e "${GREEN}✓ Built frontend found${NC}"
    echo ""
    echo "Searching for API URLs in built files:"
    
    # Search for the API URL pattern
    FOUND_127=$(grep -r "127\.0\.0\.1:8000" "$PROJECT_DIR/frontend/dist/assets" 2>/dev/null | wc -l)
    FOUND_DEBATESIM=$(grep -r "debatesim\.us" "$PROJECT_DIR/frontend/dist/assets" 2>/dev/null | wc -l)
    
    if [ "$FOUND_127" -gt 0 ]; then
        echo -e "${RED}✗ Found 127.0.0.1:8000 in $FOUND_127 places (BAD for VM!)${NC}"
        echo "  This means frontend will try to call localhost instead of your VM"
    fi
    
    if [ "$FOUND_DEBATESIM" -gt 0 ]; then
        echo -e "${GREEN}✓ Found debatesim.us in $FOUND_DEBATESIM places (GOOD)${NC}"
    fi
    
    if [ "$FOUND_127" -eq 0 ] && [ "$FOUND_DEBATESIM" -eq 0 ]; then
        echo -e "${YELLOW}? No clear API URL found in built files${NC}"
    fi
else
    echo -e "${RED}✗ No built frontend found at $PROJECT_DIR/frontend/dist${NC}"
    echo "  Run: cd $PROJECT_DIR/frontend && npm run build"
fi
echo ""

# 2. Check backend is running
echo "═══════════════════════════════════════════════"
echo "2. Checking if backend is running..."
echo "═══════════════════════════════════════════════"

if pgrep -f "python.*main.py" > /dev/null; then
    echo -e "${GREEN}✓ Backend process is running${NC}"
    ps aux | grep "[m]ain.py" | head -1
else
    echo -e "${RED}✗ Backend process NOT running${NC}"
    echo "  Start with: cd $PROJECT_DIR && python main.py"
fi
echo ""

# 3. Check port 8000
echo "═══════════════════════════════════════════════"
echo "3. Checking port 8000..."
echo "═══════════════════════════════════════════════"

if command -v netstat &> /dev/null; then
    PORT_STATUS=$(netstat -tln 2>/dev/null | grep ":8000 ")
    if [ ! -z "$PORT_STATUS" ]; then
        echo -e "${GREEN}✓ Port 8000 is listening${NC}"
        echo "$PORT_STATUS"
    else
        echo -e "${RED}✗ Nothing listening on port 8000${NC}"
    fi
elif command -v lsof &> /dev/null; then
    PORT_STATUS=$(lsof -i :8000 2>/dev/null)
    if [ ! -z "$PORT_STATUS" ]; then
        echo -e "${GREEN}✓ Port 8000 is listening${NC}"
        echo "$PORT_STATUS"
    else
        echo -e "${RED}✗ Nothing listening on port 8000${NC}"
    fi
else
    echo -e "${YELLOW}? Cannot check port (netstat/lsof not available)${NC}"
fi
echo ""

# 4. Test backend locally
echo "═══════════════════════════════════════════════"
echo "4. Testing backend on localhost..."
echo "═══════════════════════════════════════════════"

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/ 2>/dev/null)
if [ "$RESPONSE" = "200" ]; then
    echo -e "${GREEN}✓ Backend responds on localhost:8000${NC}"
    curl -s http://localhost:8000/ | jq '.' 2>/dev/null || curl -s http://localhost:8000/
else
    echo -e "${RED}✗ Backend NOT responding on localhost:8000${NC}"
    echo "  HTTP Status: $RESPONSE"
fi
echo ""

# 5. Test /states endpoint locally
echo "═══════════════════════════════════════════════"
echo "5. Testing /states endpoint locally..."
echo "═══════════════════════════════════════════════"

RESPONSE=$(curl -s http://localhost:8000/states 2>/dev/null)
if echo "$RESPONSE" | grep -q "<!DOCTYPE\|<html"; then
    echo -e "${RED}✗ Got HTML response (BAD!)${NC}"
    echo "  First 200 chars:"
    echo "$RESPONSE" | head -c 200
elif echo "$RESPONSE" | grep -q "states"; then
    echo -e "${GREEN}✓ Got JSON response (GOOD!)${NC}"
    echo "$RESPONSE" | jq '.' 2>/dev/null | head -20
else
    echo -e "${YELLOW}? Got unexpected response${NC}"
    echo "$RESPONSE" | head -c 200
fi
echo ""

# 6. Check environment variables
echo "═══════════════════════════════════════════════"
echo "6. Checking environment variables..."
echo "═══════════════════════════════════════════════"

if [ -f "$PROJECT_DIR/.env" ]; then
    echo -e "${GREEN}✓ .env file found${NC}"
    
    if grep -q "LEGISCAN_API_KEY=" "$PROJECT_DIR/.env"; then
        KEY_VALUE=$(grep "LEGISCAN_API_KEY=" "$PROJECT_DIR/.env" | cut -d'=' -f2)
        if [ ! -z "$KEY_VALUE" ] && [ "$KEY_VALUE" != "your_api_key_here" ]; then
            echo -e "${GREEN}✓ LEGISCAN_API_KEY is set${NC}"
        else
            echo -e "${RED}✗ LEGISCAN_API_KEY is empty or placeholder${NC}"
        fi
    else
        echo -e "${RED}✗ LEGISCAN_API_KEY not found in .env${NC}"
    fi
else
    echo -e "${RED}✗ No .env file found${NC}"
fi

if [ -f "$PROJECT_DIR/frontend/.env.production" ]; then
    echo -e "${GREEN}✓ frontend/.env.production found${NC}"
    cat "$PROJECT_DIR/frontend/.env.production"
else
    echo -e "${YELLOW}? No frontend/.env.production file${NC}"
    echo "  This file should contain: VITE_API_URL=https://debatesim.us"
fi
echo ""

# 7. Check nginx (if available)
echo "═══════════════════════════════════════════════"
echo "7. Checking nginx configuration..."
echo "═══════════════════════════════════════════════"

if command -v nginx &> /dev/null; then
    echo -e "${GREEN}✓ nginx is installed${NC}"
    
    if pgrep nginx > /dev/null; then
        echo -e "${GREEN}✓ nginx is running${NC}"
    else
        echo -e "${YELLOW}? nginx is not running${NC}"
    fi
    
    # Check for relevant config
    if [ -f "/etc/nginx/sites-enabled/default" ]; then
        echo ""
        echo "Checking for proxy_pass to port 8000:"
        grep -n "proxy_pass.*8000" /etc/nginx/sites-enabled/* 2>/dev/null | head -5
    fi
else
    echo -e "${YELLOW}? nginx not installed${NC}"
fi
echo ""

# Summary and recommendations
echo "╔═══════════════════════════════════════════════╗"
echo "║   SUMMARY & RECOMMENDATIONS                   ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""

if [ "$FOUND_127" -gt 0 ]; then
    echo -e "${RED}ACTION REQUIRED:${NC}"
    echo "1. Your frontend is configured for localhost, not your VM!"
    echo "2. Fix it by running:"
    echo ""
    echo -e "${BLUE}cd $PROJECT_DIR/frontend${NC}"
    echo -e "${BLUE}echo 'VITE_API_URL=https://debatesim.us' > .env.production${NC}"
    echo -e "${BLUE}npm run build${NC}"
    echo ""
fi

if ! pgrep -f "python.*main.py" > /dev/null; then
    echo -e "${RED}ACTION REQUIRED:${NC}"
    echo "Your backend is not running! Start it with:"
    echo ""
    echo -e "${BLUE}cd $PROJECT_DIR${NC}"
    echo -e "${BLUE}source venv/bin/activate${NC}"
    echo -e "${BLUE}python main.py${NC}"
    echo ""
fi

echo "Done!"

