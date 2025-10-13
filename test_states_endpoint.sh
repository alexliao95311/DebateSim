#!/bin/bash

# Simple test for /states endpoint
# Run this on your VM

echo "Testing /states endpoint..."
echo ""

# Test locally on the VM
echo "1. Testing localhost:8000/states"
curl -v http://localhost:8000/states 2>&1 | head -50

echo ""
echo ""
echo "2. Testing via public URL"
curl -v https://debatesim.us/states 2>&1 | head -50

echo ""
echo ""
echo "3. Check what content-type we're getting"
curl -I https://debatesim.us/states 2>&1 | grep -i content-type

echo ""
echo ""
echo "4. Check backend logs for this endpoint"
echo "Run on VM: tail -f /path/to/backend.log"

