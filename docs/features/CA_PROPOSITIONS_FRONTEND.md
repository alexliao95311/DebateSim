# California Propositions - Frontend Integration Guide

## Overview

Propositions will appear in a **separate "Propositions" tab** that only shows up when California is selected. This keeps them distinct from state bills.

## Step-by-Step Integration

### Step 1: Add State Variables

Add these to the state section in `Legislation.jsx` (around line 630):

```javascript
// California Propositions (add after stateBills state)
const [caPropositions, setCaPropositions] = useState([]);
const [showPropositions, setShowPropositions] = useState(false); // Toggle between bills and props
```

### Step 2: Fetch Propositions when CA is Selected

Add this useEffect (around line 770, after the state bills fetch):

```javascript
// Fetch CA propositions when California is selected
useEffect(() => {
  if (jurisdiction === 'state' && selectedState === 'CA' && componentsLoaded.bills) {
    async function fetchCAPropositions() {
      try {
        const response = await fetch(`${API_URL}/ca-propositions`);
        if (!response.ok) {
          throw new Error('Failed to fetch propositions');
        }
        const data = await response.json();
        setCaPropositions(data.propositions || []);
      } catch (err) {
        console.error("Error fetching CA propositions:", err);
        // Silently fail - propositions are optional
        setCaPropositions([]);
      }
    }
    fetchCAPropositions();
  } else {
    // Clear propositions when leaving CA
    setCaPropositions([]);
    setShowPropositions(false);
  }
}, [jurisdiction, selectedState, componentsLoaded.bills]);
```

### Step 3: Add Proposition Selection Handler

Add this function (around line 840, after `handleSelectStateBill`):

```javascript
// Handle CA proposition selection
const handleSelectCAProposition = (prop) => {
  console.log('🔄 Selecting CA proposition:', prop.title);
  setSelectedBill(prop);
  setBillSource('proposition');
  setExtractedBillData(null);

  // Reset section-related state
  console.log('🗑️ Clearing previous bill sections and selections');
  setBillSections([]);
  setSelectedSections([]);
  setAnalyzeWholeBill(true);
  setSectionSearchTerm('');

  setCurrentStep(2);
  setError('');
  clearInfoNote();
};
```

### Step 4: Add Proposition Text Extraction

Add this function (around line 970, after `extractStateBillText`):

```javascript
// Extract CA proposition text when needed
const extractCAPropositionText = async (prop) => {
  if (extractedBillData) {
    console.log('📋 Using cached proposition data, text length:', extractedBillData.text?.length || 0);
    return extractedBillData.text;
  }

  setProcessingStage('Extracting proposition text from CA Secretary of State...');

  console.log('🔗 Fetching CA proposition text from API for:', {
    prop_id: prop.id,
    title: prop.title
  });

  const response = await fetch(`${API_URL}/extract-ca-proposition-text`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prop_id: prop.id
    }),
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('No text available for this proposition yet. The proposition may still be in draft form or pending publication.');
    } else if (response.status === 503) {
      throw new Error('Propositions service is not available. Please try again later.');
    } else {
      throw new Error(`Failed to extract proposition text: ${response.status} ${response.statusText}`);
    }
  }

  const data = await response.json();

  console.log('📄 API Response received:', {
    hasText: !!data.text,
    textLength: data.text?.length || 0,
    textPreview: data.text?.substring(0, 200) + '...',
    title: data.title
  });

  // Cache the extracted proposition data
  const propData = {
    text: data.text,
    title: data.title,
    billCode: `Prop ${data.number}`
  };

  console.log('💾 Caching proposition data, final text length:', propData.text?.length || 0);
  setExtractedBillData(propData);
  return propData.text;
};
```

### Step 5: Update Analysis Flow

In `handleAnalyzeExecution` function (around line 1528), add this case after the state bills case:

```javascript
} else if (billSource === 'proposition') {
  // Step 1: Extract CA proposition text if not already cached
  setProcessingStage('Fetching proposition text from CA Secretary of State...');
  setProgressStep(1);

  const propData = await extractCAPropositionText(selectedBill);

  // Step 2: Analyze proposition
  setProcessingStage('Analyzing proposition with AI...');
  setProgressStep(2);

  const response = await fetch(`${API_URL}/analyze-legislation-text`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: analyzeWholeBill ? `PROPOSITION TITLE: ${getBillTitle()}\n\n${extractedBillData?.text}` : getSelectedSectionsText(),
      model: selectedModel,
      sections: analyzeWholeBill ? null : selectedSections,
      userProfile: userProfile
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Analysis failed: ${response.status} ${response.statusText}. ${errorData || 'Please try again.'}`);
  }

  const data = await response.json();

  // Step 3: Finalizing
  setProcessingStage('Finalizing analysis and grades...');
  setProgressStep(3);

  // Stage results
  await stageAnalysisResults(data.analysis, data.grades, `Proposition Analysis: ${selectedBill.title}`);
```

### Step 6: Update Debate Flow

In the debate setup section (around line 1720), update the condition:

```javascript
} else if ((billSource === 'recommended' || billSource === 'link' || billSource === 'state' || billSource === 'proposition') && selectedBill) {
```

And update the endpoint/body selection:

```javascript
const endpoint = billSource === 'state'
  ? `${API_URL}/extract-state-bill-text`
  : billSource === 'proposition'
  ? `${API_URL}/extract-ca-proposition-text`
  : `${API_URL}/extract-recommended-bill-text`;

const bodyData = billSource === 'state'
  ? { bill_id: selectedBill.id }
  : billSource === 'proposition'
  ? { prop_id: selectedBill.id }
  : {
      type: selectedBill.type,
      number: selectedBill.number,
      congress: selectedBill.congress || 119,
      title: selectedBill.title
    };
```

### Step 7: Update Bill Title Display

In `getBillTitle()` function (around line 1245), add:

```javascript
const getBillTitle = () => {
  if (billSource === 'recommended' || billSource === 'link' || billSource === 'state') {
    return selectedBill?.title || 'Unknown Bill';
  } else if (billSource === 'proposition') {
    return `Proposition ${selectedBill?.number} - ${selectedBill?.shortTitle || selectedBill?.title}`;
  } else if (billSource === 'upload') {
    return selectedBill?.name?.replace('.pdf', '') || 'Uploaded Bill';
  }
  return 'Unknown Bill';
};
```

### Step 8: Update Bill Text Extraction (Step 2)

Around lines 3214 and 3263, update the extraction logic:

```javascript
// For recommended/link/state/proposition bills, extract text if not available
if ((billSource === 'recommended' || billSource === 'link' || billSource === 'state' || billSource === 'proposition') && !billText && selectedBill) {
  console.log('🔄 Bill text not available, extracting from API...');
  try {
    if (billSource === 'state') {
      billText = await extractStateBillText(selectedBill);
    } else if (billSource === 'proposition') {
      billText = await extractCAPropositionText(selectedBill);
    } else {
      billText = await extractRecommendedBillText(selectedBill);
    }
    console.log('✅ Bill text extracted, type:', typeof billText, 'length:', billText?.length || 0);
  } catch (error) {
    console.error('❌ Failed to extract bill text:', error);
    return;
  }
}
```

### Step 9: Update Selected Bill Display (Step 2 & 3)

Update the bill display in Step 2 (around line 3118) and Step 3 (around line 3176):

```javascript
<h3>
  {billSource === 'recommended' ? (
    `Selected Bill: ${selectedBill.type} ${selectedBill.number} - ${selectedBill.title}`
  ) : billSource === 'link' ? (
    `Selected Bill: ${selectedBill.type} ${selectedBill.number} - ${selectedBill.title}`
  ) : billSource === 'state' ? (
    `Selected Bill: ${selectedBill.number} - ${selectedBill.title}`
  ) : billSource === 'proposition' ? (
    `Selected Proposition: ${selectedBill.number} - ${selectedBill.shortTitle || selectedBill.title}`
  ) : (
    `Selected Bill: 📄 ${selectedBill.name}`
  )}
</h3>
```

### Step 10: Add Propositions Tab UI

Find the bills display section in Step 1 (around line 2510-2610) and add this **AFTER** the state bills section:

```jsx
{/* California Propositions Tab */}
{jurisdiction === 'state' && selectedState === 'CA' && caPropositions.length > 0 && (
  <div style={{ marginTop: '1rem' }}>
    {/* Tab Switcher */}
    <div style={{
      display: 'flex',
      gap: '0.5rem',
      marginBottom: '1rem',
      borderBottom: '2px solid rgba(71, 85, 105, 0.3)',
      paddingBottom: '0.5rem'
    }}>
      <button
        onClick={() => setShowPropositions(false)}
        style={{
          padding: '0.5rem 1.5rem',
          background: !showPropositions ? 'rgba(0, 123, 255, 0.2)' : 'transparent',
          border: 'none',
          borderBottom: !showPropositions ? '3px solid #007bff' : '3px solid transparent',
          color: 'rgba(255, 255, 255, 0.89)',
          fontWeight: !showPropositions ? '600' : 'normal',
          cursor: 'pointer',
          fontSize: '1rem'
        }}
      >
        State Bills ({stateBills.length})
      </button>
      <button
        onClick={() => setShowPropositions(true)}
        style={{
          padding: '0.5rem 1.5rem',
          background: showPropositions ? 'rgba(0, 123, 255, 0.2)' : 'transparent',
          border: 'none',
          borderBottom: showPropositions ? '3px solid #007bff' : '3px solid transparent',
          color: 'rgba(255, 255, 255, 0.89)',
          fontWeight: showPropositions ? '600' : 'normal',
          cursor: 'pointer',
          fontSize: '1rem'
        }}
      >
        Ballot Propositions ({caPropositions.length})
      </button>
    </div>

    {/* Show Bills or Propositions based on tab */}
    {!showPropositions ? (
      // State Bills (already displayed above this section)
      <div style={{ display: 'none' }}>{/* Bills already shown */}</div>
    ) : (
      // Propositions
      <div className="bills-horizontal-scroll">
        {caPropositions.map((prop, index) => (
          <div
            key={prop.id}
            className="bill-card-wrapper"
            style={{
              animationDelay: `${index * 100}ms`,
              opacity: 1,
              transform: 'translateY(0)',
              transition: 'opacity 0.6s ease, transform 0.6s ease'
            }}
          >
            <BillCard
              bill={prop}
              onSelect={handleSelectCAProposition}
              isProcessing={loadingState && selectedBill?.id === prop.id}
              processingStage={loadingState && selectedBill?.id === prop.id ? processingStage : ''}
            />
          </div>
        ))}
      </div>
    )}
  </div>
)}
```

## Visual Layout

When California is selected, users will see:

```
┌─────────────────────────────────────────┐
│ Choose Bill Source:                     │
│ [ Federal Bills ]  [ State Bills ]      │
│            ▼                             │
│      [ California ▼ ]                    │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ California Bills                         │
├─────────────────────────────────────────┤
│ [ State Bills (20) ] [ Ballot Propositions (1) ] ← TABS
├─────────────────────────────────────────┤
│                                          │
│ [When "Ballot Propositions" tab active:]│
│                                          │
│  ┌──────────────────────────┐          │
│  │ Prop 50                  │          │
│  │ Redistricting Reform     │          │
│  │                          │          │
│  │ Constitutional amendment │          │
│  │ to reform California's...│          │
│  │                          │          │
│  │ [Select]                 │          │
│  └──────────────────────────┘          │
│                                          │
└─────────────────────────────────────────┘
```

## Testing Checklist

- [ ] Restart backend server
- [ ] Add all code above to Legislation.jsx
- [ ] Select California from state dropdown
- [ ] See two tabs: "State Bills" and "Ballot Propositions"
- [ ] Click "Ballot Propositions" tab
- [ ] See Proposition 50 card
- [ ] Click "Select" on Prop 50
- [ ] See "Selected Proposition: 50 - Redistricting Commission Reform"
- [ ] Click "Analyze"
- [ ] Proposition text extracts (~30 seconds)
- [ ] Analysis completes with grades
- [ ] Can also set up debate

## Key Points

1. **Separate Tab**: Propositions don't mix with bills - clean separation
2. **California Only**: Tab only appears for CA
3. **Same Functionality**: Analysis, debates, grading all work the same
4. **Bill Source**: `billSource='proposition'` distinguishes from other sources
5. **Caching**: Proposition text cached after first extraction

## What's Configured

- **Prop 50**: Redistricting Commission Reform (2025 Special Election)
- More props can be added in `ca_propositions_service.py` line 67

---

**Status**: Backend complete, frontend code provided above
**Integration Time**: ~15-20 minutes to add all code snippets
