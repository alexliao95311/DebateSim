# State Bills Integration Guide

## Overview
This document describes the integration of LegiScan state bill functionality into the DebateSim application.

## Backend Implementation

### 1. LegiScan Service (`legiscan_service.py`)
- **Purpose**: Service class for interacting with LegiScan API
- **Features**:
  - Fetch list of US states
  - Get legislative sessions for a state
  - Search and retrieve state bills
  - Extract bill text (Base64 decoded from LegiScan)
  - Caching with 30-minute TTL to conserve API query limits

### 2. API Endpoints (`main.py`)
Added the following endpoints:

- `GET /states` - Get list of all US states
- `GET /state-sessions/{state}` - Get legislative sessions for a state
- `GET /state-bills/{state}` - Get bills for a state session
- `POST /search-state-bills` - Search for state bills
- `POST /get-state-bill` - Get detailed information about a specific state bill
- `POST /extract-state-bill-text` - Extract text from a state bill
- `POST /analyze-state-bill` - Analyze a state bill (uses existing analysis logic)

## Frontend Implementation

### 1. State Management
Added the following state variables to `Legislation.jsx`:

```javascript
const [jurisdiction, setJurisdiction] = useState('federal'); // 'federal' or 'state'
const [selectedState, setSelectedState] = useState(''); // Two-letter state code
const [statesList, setStatesList] = useState([]);
const [stateBills, setStateBills] = useState([]);
```

### 2. UI Components

#### Jurisdiction Selector
- Located at the top of Step 1 (Choose a Bill)
- Toggle buttons for "Federal Bills" vs "State Bills"
- Dropdown for state selection (appears when "State Bills" is selected)

#### Bill Display
- Shows federal bills when jurisdiction='federal'
- Shows state bills when jurisdiction='state' and a state is selected
- Uses same `BillCard` component for consistent UI

### 3. Bill Handling Functions

#### `handleSelectStateBill(bill)`
- Handles selection of state bills
- Sets `billSource='state'`
- Clears previous data and resets state

#### `extractStateBillText(bill)`
- Extracts text from LegiScan for state bills
- Caches extracted data
- Similar pattern to `extractRecommendedBillText`

### 4. Integration Points

The following areas have been updated to support state bills:

1. **Analysis Flow** (Line ~1526-1531)
   - Added check for `billSource === 'state'`
   - Calls `extractStateBillText` for state bills

2. **Debate Setup Flow** (Line ~1715-1737)
   - Updated condition to include `billSource === 'state'`
   - Uses appropriate endpoint based on bill source
   - Sends correct parameters for state bills

### 5. Additional Integration Needed

The following integration points still need updating throughout `Legislation.jsx`:

**Search Pattern**: Find all instances of `billSource === 'recommended' || billSource === 'link'` and update to:
```javascript
billSource === 'recommended' || billSource === 'link' || billSource === 'state'
```

**Key locations** (approximate line numbers):
- Line 1245: getBillTitle() function
- Line 1376: handlePdfUpload function
- Line 1661-1662: Bill text/title extraction for debate
- Line 1872: Bill title extraction
- Line 3053, 3109: Step 2 UI display
- Line 3192, 3237: Analysis section text extraction
- Line 3733: Bill source display

## Configuration

### Environment Variables

Add to your `.env` file:

```bash
# LegiScan API Key (get from https://legiscan.com/legiscan)
LEGISCAN_API_KEY=your_legiscan_api_key_here
```

### API Key Setup

1. Sign up at https://legiscan.com/legiscan
2. Get your API key (Free tier: 30,000 queries/month)
3. Add the key to your `.env` file
4. Restart the backend server

## Usage

### For Users

1. Navigate to the Legislation page
2. In Step 1, select "State Bills" instead of "Federal Bills"
3. Choose a state from the dropdown
4. Browse and select a bill
5. Proceed with Analysis or Debate as usual

### API Query Management

The free LegiScan API has a 30,000 monthly query limit. To conserve queries:

- Results are cached for 30 minutes (TTLCache)
- Master lists are cached per state/session
- Bill details are cached per bill_id
- Text extraction results are cached

### Error Handling

Common errors and their meanings:

- **503 Service Unavailable**: LegiScan API key not configured or invalid
- **404 Not Found**: Bill text not yet available (still in draft)
- **500 Server Error**: API issue or rate limit exceeded

## Testing

### Manual Testing Steps

1. **Backend**:
   ```bash
   # Test states endpoint
   curl http://localhost:8000/states

   # Test state bills (example: California)
   curl http://localhost:8000/state-bills/CA
   ```

2. **Frontend**:
   - Select State Bills
   - Choose a state (e.g., California, Texas, New York)
   - Verify bills load
   - Select a bill
   - Test both Analysis and Debate features

### Verification Checklist

- [ ] State selector appears and works
- [ ] State bills load when state is selected
- [ ] Bill selection works (moves to Step 2)
- [ ] Analysis works with state bills
- [ ] Debate setup works with state bills
- [ ] Error messages are clear and helpful
- [ ] Loading states display correctly

## Future Enhancements

Potential improvements:

1. **Search functionality** for state bills
2. **Session selector** to view bills from past legislative sessions
3. **Bill tracking** - save favorite state bills
4. **Comparison tool** - compare similar bills across states
5. **Sponsor information** - display bill sponsors with photos
6. **Bill history** - show progression through state legislature

## Troubleshooting

### State bills not loading
- Check that LEGISCAN_API_KEY is set in `.env`
- Verify API key is valid at legiscan.com
- Check backend logs for API errors
- Ensure you've selected a state from the dropdown

### Bill text unavailable
- Some bills don't have text available yet (still in draft)
- Try a different bill or check back later
- Bill may be very recent

### API rate limits
- Free tier: 30,000 queries/month
- Caching helps reduce query usage
- Consider upgrading to paid tier if needed

## Code Structure

```
DebateSim/
├── main.py                     # Backend API with LegiScan endpoints
├── legiscan_service.py        # LegiScan API service class
├── frontend/
│   └── src/
│       └── components/
│           └── Legislation.jsx # Main legislation component with state bills UI
└── .env                       # Environment variables (add LEGISCAN_API_KEY)
```

## API Documentation

### LegiScan API Resources

- **API Docs**: https://legiscan.com/gaits/documentation/legiscan
- **Free API Key**: https://legiscan.com/legiscan
- **API Manual**: Available after signup
- **Rate Limits**: 30,000 queries/month (free tier)

## Support

For issues:
1. Check backend logs for errors
2. Verify LegiScan API key is valid
3. Test endpoints manually with curl
4. Check LegiScan API status

## Notes

- LegiScan covers all 50 US states
- Bill text is provided in HTML format (automatically cleaned)
- Some states update more frequently than others
- Historical data available through different sessions
