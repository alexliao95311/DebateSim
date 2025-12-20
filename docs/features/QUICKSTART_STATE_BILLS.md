# Quick Start Guide: State Bills Feature

## Setup (5 minutes)

### 1. Backend Setup

Your LegiScan API key has been added to `.env`:
```bash
LEGISCAN_API_KEY=8b5474c2f330ed1e83b129727c4baf21
```

Restart your backend server:
```bash
# Stop current server (Ctrl+C)
# Then restart:
python3 main.py
# or
uvicorn main:app --reload
```

### 2. Frontend (already running)

No changes needed if your frontend is already running.

## Testing the Feature

### Test 1: View California Bills

1. Navigate to `/legislation` page
2. You should see a new "Choose Bill Source" section with:
   - **Federal Bills** button
   - **State Bills** button
3. Click **State Bills**
4. Select **California** from the dropdown
5. Wait for bills to load (~2-3 seconds)
6. You should see a horizontal scrolling list of California bills

### Test 2: Analyze a State Bill

1. After loading California bills (from Test 1)
2. Click **"Select for Analysis"** on any bill
3. You should move to Step 2
4. Choose a model (e.g., gpt-4o-mini)
5. Click **"Start Analysis"**
6. Wait for analysis to complete
7. You should see analysis and grades for the state bill

### Test 3: Debate a State Bill

1. Load state bills for any state
2. Select a bill
3. In Step 2, choose **"Set Up Debate"**
4. Configure debate options:
   - Choose debate mode (Solo Practice / AI vs AI)
   - Select debate format
   - Choose personas
5. Click **"Start Debate"**
6. You should be taken to the debate page with the state bill text

### Test 4: Try Different States

Test with a variety of states to ensure broad compatibility:

- **California (CA)** - Large, active legislature
- **Texas (TX)** - Another large state
- **New York (NY)** - Active legislature
- **Vermont (VT)** - Smaller state
- **Florida (FL)** - Active state legislature

### Test 5: Switch Between Federal and State

1. Start with Federal Bills (default)
2. Browse federal bills
3. Click **State Bills**
4. Select a state
5. Browse state bills
6. Click **Federal Bills** again
7. Verify federal bills reappear

## Expected Behavior

### ✅ Success Indicators

- Jurisdiction selector appears at top of Step 1
- State dropdown appears when "State Bills" is selected
- Bills load within 2-3 seconds of selecting a state
- Bill cards show state bill information (title, description, status)
- Analysis works with state bills
- Debate setup works with state bills
- Error messages are clear and helpful

### ⚠️ Common Issues

**Issue**: "LegiScan API key is required"
**Solution**: Check that `LEGISCAN_API_KEY` is in `.env` and backend restarted

**Issue**: "No text available for this bill"
**Solution**: Normal - some bills don't have published text yet. Try another bill.

**Issue**: Bills not loading
**Solution**:
1. Check backend logs for errors
2. Verify internet connection
3. Try a different state

**Issue**: State selector not appearing
**Solution**: Clear browser cache and refresh

## Monitoring

### Backend Logs

Watch for these log messages:
```
✅ LegiScan service initialized
✅ Fetching state bill details for ID: [bill_id]
✅ Generated grades: {...}
```

### API Query Usage

Your free tier has 30,000 queries/month. To check usage:
- Visit https://legiscan.com/legiscan
- Log in with your account
- View "October Requests" counter

## Next Steps

After successful testing:

1. **Explore different states** - Each has unique bills
2. **Compare bills** - Analyze similar legislation across states
3. **Use in debates** - Practice debating state-level issues
4. **Provide feedback** - Report any issues or suggestions

## API Details

### LegiScan Coverage

- All 50 US states
- Current and historical sessions
- Bill text, sponsors, actions
- 30,000 queries/month (free tier)

### Caching

To conserve API queries, results are cached for 30 minutes:
- State session lists
- Bill master lists
- Bill details
- Bill text

## Troubleshooting Commands

```bash
# Check if LegiScan API is working
curl "http://localhost:8000/states"

# Check California bills
curl "http://localhost:8000/state-bills/CA"

# View backend logs
tail -f logs/backend.log  # if logging to file

# Check .env file
cat .env | grep LEGISCAN
```

## Support

For issues:
1. Check `STATE_BILLS_INTEGRATION_GUIDE.md` for detailed documentation
2. Review backend logs
3. Test API endpoints manually
4. Verify LegiScan API key at https://legiscan.com

## What's New

### UI Changes
- Jurisdiction selector in Step 1
- State dropdown for state selection
- Updated bill loading messages
- Support for state bill metadata

### Backend Changes
- New LegiScan service (`legiscan_service.py`)
- 7 new API endpoints for state bills
- Automatic text cleaning for HTML content
- Query caching to conserve API limits

### Features
- Browse bills from all 50 states
- Analyze state legislation
- Debate state bills
- Same analysis quality as federal bills

## Quick Reference

### Keyboard Shortcuts
- None specific to state bills feature

### URLs
- LegiScan API Docs: https://legiscan.com/gaits/documentation/legiscan
- Your API Key: https://legiscan.com/legiscan
- Free Tier Limit: 30,000 queries/month

---

**Last Updated**: 2025-10-12
**Version**: 1.0
**Status**: ✅ Ready for Testing
