# California Propositions Feature - Setup Complete

## What Was Built

I've added California ballot propositions support to your legislation feature! Now when users select California, they can analyze state propositions in addition to state bills.

### Backend Components

1. **`ca_propositions_service.py`** - New service that:
   - Fetches CA proposition text from Secretary of State PDFs
   - Parses propositions from consolidated PDF documents
   - Caches results for 24 hours
   - Extracts text for specific propositions using PDF parsing

2. **New API Endpoints** (in `main.py`):
   - `GET /ca-propositions` - Get list of CA propositions
   - `POST /extract-ca-proposition-text` - Extract text for a proposition
   - `POST /analyze-ca-proposition` - Analyze a proposition

### How It Works

1. **Proposition List**: Currently configured with Prop 50 from the 2025 Special Election
2. **Text Extraction**: Downloads the official "Text of Proposed Law" PDF from CA SOS
3. **Parsing**: Extracts pages for the specific proposition using pattern matching
4. **Analysis**: Uses the same AI analysis and grading system as bills

### Data Source

Propositions are fetched from:
```
https://vig.cdn.sos.ca.gov/2025/special/pdf/text-proposed-law.pdf
```

This is the official California Secretary of State voter guide PDF.

## Next Steps - YOU NEED TO DO

### 1. Restart the Backend

```bash
# The backend needs a restart to load the new code
# Stop the current server (Ctrl+C if running in terminal)
# Then restart:
python3 main.py
# or
uvicorn main:app --reload
```

### 2. Test the Backend

After restarting, test the endpoints:

```bash
# Test propositions list
curl http://localhost:8000/ca-propositions | python3 -m json.tool

# Should return Prop 50 data
```

### 3. Frontend Integration Needed

The frontend needs to be updated to:

1. **Add a "Propositions" tab/section when California is selected**
2. **Fetch and display propositions alongside state bills**
3. **Handle proposition selection and analysis**

Here's what needs to be added to `Legislation.jsx`:

#### A. Add State for Propositions

```javascript
const [caPropositions, setCaPropositions] = useState([]);
const [propsLoading, setPropsLoading] = useState(false);
```

#### B. Fetch Propositions when CA is Selected

```javascript
useEffect(() => {
  if (jurisdiction === 'state' && selectedState === 'CA' && componentsLoaded.bills) {
    async function fetchCAPropositions() {
      setPropsLoading(true);
      try {
        const response = await fetch(`${API_URL}/ca-propositions`);
        if (!response.ok) throw new Error('Failed to fetch propositions');
        const data = await response.json();
        setCaPropositions(data.propositions || []);
      } catch (err) {
        console.error("Error fetching CA propositions:", err);
      } finally {
        setPropsLoading(false);
      }
    }
    fetchCAPropositions();
  }
}, [jurisdiction, selectedState, componentsLoaded.bills]);
```

#### C. Add Proposition Extraction Function

```javascript
const extractCAPropositionText = async (prop) => {
  if (extractedBillData) {
    return extractedBillData.text;
  }

  setProcessingStage('Extracting proposition text from CA SOS...');

  const response = await fetch(`${API_URL}/extract-ca-proposition-text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prop_id: prop.id }),
  });

  if (!response.ok) {
    throw new Error('Failed to extract proposition text');
  }

  const data = await response.json();
  const propData = {
    text: data.text,
    title: data.title,
    billCode: `Prop ${data.number}`
  };

  setExtractedBillData(propData);
  return propData.text;
};
```

#### D. Update Bill Source Checks

Everywhere you have:
```javascript
billSource === 'recommended' || billSource === 'link' || billSource === 'state'
```

Add:
```javascript
billSource === 'recommended' || billSource === 'link' || billSource === 'state' || billSource === 'proposition'
```

#### E. Add Propositions Display in UI

After the state bills display section, add:

```jsx
{/* California Propositions */}
{jurisdiction === 'state' && selectedState === 'CA' && caPropositions.length > 0 && (
  <>
    <h3>California Ballot Propositions</h3>
    <div className="bills-horizontal-scroll">
      {caPropositions.map((prop, index) => (
        <div key={prop.id} className="bill-card-wrapper">
          <BillCard
            bill={prop}
            onSelect={handleSelectCAProposition}
            isProcessing={loadingState && selectedBill?.id === prop.id}
            processingStage={loadingState && selectedBill?.id === prop.id ? processingStage : ''}
          />
        </div>
      ))}
    </div>
  </>
)}
```

#### F. Add Proposition Selection Handler

```javascript
const handleSelectCAProposition = (prop) => {
  console.log('🔄 Selecting CA proposition:', prop.title);
  setSelectedBill(prop);
  setBillSource('proposition');
  setExtractedBillData(null);
  setBillSections([]);
  setSelectedSections([]);
  setAnalyzeWholeBill(true);
  setSectionSearchTerm('');
  setCurrentStep(2);
  setError('');
  clearInfoNote();
};
```

#### G. Update Analysis Flow

In `handleAnalyzeExecution`, add a case for propositions:

```javascript
} else if (billSource === 'proposition') {
  // Extract CA proposition text
  setProcessingStage('Fetching proposition text from CA SOS...');
  setProgressStep(1);

  const propData = await extractCAPropositionText(selectedBill);

  // Analyze
  setProcessingStage('Analyzing proposition with AI...');
  setProgressStep(2);

  const response = await fetch(`${API_URL}/analyze-legislation-text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: `PROPOSITION TITLE: ${getBillTitle()}\n\n${extractedBillData?.text}`,
      model: selectedModel,
      userProfile: userProfile
    }),
  });

  // ... handle response
}
```

## Current Configuration

### Hardcoded Proposition (for 2025)

Currently configured with:
- **Proposition 50** - Authorizes Bonds for School and Community College Facilities
- **Election**: November 4, 2025 Special Election
- **Amount**: $10 billion in general obligation bonds

### Adding More Propositions

To add more propositions, edit `ca_propositions_service.py` line ~44 and add to the array:

```python
propositions = [
    {
        "id": "prop_2025_50",
        "number": "50",
        "title": "PROPOSITION 50",
        "shortTitle": "School Facilities Bond",
        "description": "Authorizes $10 billion...",
        # ...
    },
    {
        "id": "prop_2025_51",  # Add more here
        "number": "51",
        # ...
    }
]
```

## Testing Checklist

After implementing frontend changes:

- [ ] Backend restarted successfully
- [ ] `/ca-propositions` endpoint returns data
- [ ] Select California in state selector
- [ ] See "California Ballot Propositions" section
- [ ] See Proposition 50 card
- [ ] Click "Select" on Prop 50
- [ ] See "Selected Bill: Proposition 50 - ..."
- [ ] Click "Start Analysis"
- [ ] Proposition text extracts (takes ~30 seconds first time)
- [ ] Analysis completes with grades
- [ ] Can debate proposition

## Architecture

```
Frontend (Legislation.jsx)
    ↓
    ├─ Jurisdiction: State
    ├─ State: California
    └─ Shows: State Bills + Propositions
              ↓
              User selects Proposition 50
              ↓
Backend (/extract-ca-proposition-text)
    ↓
CA Propositions Service
    ↓
    ├─ Download PDF from CA SOS
    ├─ Parse with pdfplumber
    ├─ Extract Prop 50 pages
    └─ Return text
         ↓
Frontend analyzes with AI
    ↓
Display results
```

## Dependencies

Already installed:
- ✅ `pdfplumber` - PDF text extraction
- ✅ `requests` - HTTP requests
- ✅ `cachetools` - Response caching

## Notes

- **PDF Download**: ~2.7MB PDF, takes 5-30 seconds to download first time
- **Caching**: Results cached for 24 hours
- **Text Quality**: Plain text extraction (doesn't preserve underline/strikeout formatting)
- **Elections**: Currently only 2025 special election configured
- **Expansion**: Easy to add more elections by adding to `ELECTIONS` dict

## Future Enhancements

1. **Auto-detect Current Election**: Use date to determine which election to show
2. **Scrape Proposition List**: Auto-discover propositions from SOS website
3. **Multiple Elections**: Show propositions from multiple upcoming elections
4. **Rich Text Parsing**: Preserve formatting (underline = additions, strikeout = deletions)
5. **Voting Recommendations**: Show Yes/No recommendations from various organizations
6. **Campaign Finance**: Link to campaign contribution data
7. **Full Voter Guide**: Extract summary, analysis, arguments for/against

## Support

If you encounter issues:

1. Check backend logs for errors
2. Verify PDF URL is accessible: https://vig.cdn.sos.ca.gov/2025/special/pdf/text-proposed-law.pdf
3. Test proposition extraction manually:
   ```bash
   curl -X POST http://localhost:8000/extract-ca-proposition-text \
     -H "Content-Type: application/json" \
     -d '{"prop_id": "prop_2025_50"}'
   ```

---

**Status**: ✅ Backend Complete - Frontend Integration Needed
**Next Step**: Restart backend and add frontend code above
