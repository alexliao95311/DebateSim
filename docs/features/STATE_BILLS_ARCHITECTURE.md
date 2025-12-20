# State Bills Architecture Diagram

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                          │
│                     (Legislation.jsx)                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────┐   │
│  │         Jurisdiction Selector                          │   │
│  │  [ Federal Bills ]  [ State Bills ]  [State Dropdown] │   │
│  └───────────────────────────────────────────────────────┘   │
│                           │                                    │
│            ┌──────────────┴──────────────┐                   │
│            │                              │                    │
│            ▼                              ▼                    │
│  ┌──────────────────┐          ┌──────────────────┐         │
│  │  Federal Bills   │          │   State Bills    │         │
│  │  (Congress.gov)  │          │   (LegiScan)     │         │
│  └──────────────────┘          └──────────────────┘         │
│            │                              │                    │
│            │                              │                    │
└────────────┼──────────────────────────────┼───────────────────┘
             │                              │
             │                              │
┌────────────┼──────────────────────────────┼───────────────────┐
│            │        BACKEND API           │                   │
│            │        (FastAPI)             │                   │
├────────────┼──────────────────────────────┼───────────────────┤
│            │                              │                    │
│            ▼                              ▼                    │
│  ┌──────────────────┐          ┌──────────────────┐         │
│  │ Congress.gov API │          │ LegiScan Service │         │
│  │   Endpoints      │          │  (NEW!)          │         │
│  │                  │          │                  │         │
│  │ /recommended-    │          │ /states          │         │
│  │  bills           │          │ /state-sessions  │         │
│  │ /analyze-        │          │ /state-bills     │         │
│  │  recommended-    │          │ /search-state-   │         │
│  │  bill            │          │  bills           │         │
│  │ /extract-        │          │ /get-state-bill  │         │
│  │  recommended-    │          │ /extract-state-  │         │
│  │  bill-text       │          │  bill-text       │         │
│  │                  │          │ /analyze-state-  │         │
│  │                  │          │  bill            │         │
│  └──────────────────┘          └──────────────────┘         │
│            │                              │                    │
│            │                              ▼                    │
│            │                    ┌──────────────────┐         │
│            │                    │  legiscan_       │         │
│            │                    │  service.py      │         │
│            │                    │  (NEW!)          │         │
│            │                    │                  │         │
│            │                    │ - State Lists    │         │
│            │                    │ - Sessions       │         │
│            │                    │ - Bill Search    │         │
│            │                    │ - Bill Details   │         │
│            │                    │ - Text Extract   │         │
│            │                    │ - Caching (30m)  │         │
│            │                    └──────────────────┘         │
│            │                              │                    │
└────────────┼──────────────────────────────┼───────────────────┘
             │                              │
             ▼                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      EXTERNAL APIs                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────┐          ┌─────────────────────┐   │
│  │   Congress.gov API  │          │   LegiScan API      │   │
│  │                     │          │   (NEW!)            │   │
│  │ - Federal bills     │          │ - State bills       │   │
│  │ - 119th Congress    │          │ - All 50 states     │   │
│  │ - Bill text         │          │ - Sessions          │   │
│  │ - Sponsors          │          │ - Bill text         │   │
│  │ - Status updates    │          │ - 30k queries/mo    │   │
│  └─────────────────────┘          └─────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow: State Bill Analysis

```
┌─────────┐
│  USER   │
│ Selects │
│  State  │
│  Bill   │
└────┬────┘
     │
     ├─ 1. User clicks "State Bills"
     │
     ├─ 2. Selects "California" from dropdown
     │
     ├─ 3. Frontend: GET /state-bills/CA
     │
     ▼
┌────────────────┐
│   BACKEND      │
│  main.py       │
│                │
│ get_state_bills│
│  (state)       │
└────┬───────────┘
     │
     ├─ 4. Calls legiscan_service.get_master_list('CA')
     │
     ▼
┌────────────────┐
│ LegiScan       │
│ Service        │
│                │
│ Check cache    │──── Hit? Return cached data
│                │
│ Cache miss?    │
│ Call API       │
└────┬───────────┘
     │
     ├─ 5. HTTP GET to api.legiscan.com
     │
     ▼
┌────────────────┐
│   LegiScan     │
│   API          │
│                │
│ Returns bills  │
│ JSON data      │
└────┬───────────┘
     │
     ├─ 6. Parse and format bill data
     │
     ├─ 7. Cache for 30 minutes
     │
     ├─ 8. Return to backend
     │
     ▼
┌────────────────┐
│   BACKEND      │
│                │
│ Return JSON    │
│ to frontend    │
└────┬───────────┘
     │
     ├─ 9. Frontend receives bills array
     │
     ├─ 10. Renders BillCard components
     │
     ▼
┌────────────────┐
│   USER SEES    │
│   CA BILLS     │
└────────────────┘
     │
     ├─ 11. User clicks "Select for Analysis"
     │
     ▼
┌────────────────┐
│   FRONTEND     │
│ Extract bill   │
│ text           │
└────┬───────────┘
     │
     ├─ 12. POST /extract-state-bill-text
     │         { bill_id: 12345 }
     │
     ▼
┌────────────────┐
│   BACKEND      │
│ Get bill       │
│ details        │
└────┬───────────┘
     │
     ├─ 13. legiscan_service.get_bill(12345)
     │
     ├─ 14. Get bill text doc_id from bill details
     │
     ├─ 15. legiscan_service.get_bill_text(doc_id)
     │
     ├─ 16. Decode Base64 bill text
     │
     ├─ 17. Clean HTML tags
     │
     ├─ 18. Return formatted text
     │
     ▼
┌────────────────┐
│   FRONTEND     │
│ Cache bill     │
│ text           │
└────┬───────────┘
     │
     ├─ 19. User clicks "Start Analysis"
     │
     ├─ 20. POST /analyze-legislation-text
     │         { text, model, userProfile }
     │
     ▼
┌────────────────┐
│   BACKEND      │
│ Analyze with   │
│ OpenRouter AI  │
└────┬───────────┘
     │
     ├─ 21. Extract key sections if too long
     │
     ├─ 22. Generate analysis
     │
     ├─ 23. Generate grades
     │
     ├─ 24. Return results
     │
     ▼
┌────────────────┐
│   USER SEES    │
│   ANALYSIS &   │
│   GRADES       │
└────────────────┘
```

## Component Hierarchy

```
Legislation.jsx
├── Jurisdiction Selector
│   ├── Federal Bills Button
│   ├── State Bills Button
│   └── State Dropdown (when State Bills selected)
│
├── Bills Section
│   ├── Federal Bills Display (when jurisdiction='federal')
│   │   └── BillCard (federal)
│   │       ├── onSelect → handleSelectRecommendedBill()
│   │       └── extracts via → extractRecommendedBillText()
│   │
│   └── State Bills Display (when jurisdiction='state')
│       └── BillCard (state)
│           ├── onSelect → handleSelectStateBill()
│           └── extracts via → extractStateBillText()
│
├── Step 2: Choose Action
│   ├── Analyze Option
│   │   └── Supports both federal and state bills
│   │
│   └── Debate Option
│       └── Supports both federal and state bills
│
└── Results Display
    ├── Analysis Results (same for both)
    └── Debate Navigation (same for both)
```

## State Management

```javascript
// Federal Bills
const [recommendedBills, setRecommendedBills] = useState([]);
const [billsLoading, setBillsLoading] = useState(false);
const [billsError, setBillsError] = useState('');

// State Bills (NEW)
const [jurisdiction, setJurisdiction] = useState('federal');
const [selectedState, setSelectedState] = useState('');
const [statesList, setStatesList] = useState([]);
const [stateBills, setStateBills] = useState([]);

// Common
const [selectedBill, setSelectedBill] = useState(null);
const [billSource, setBillSource] = useState(''); // 'recommended' | 'state' | 'upload'
const [extractedBillData, setExtractedBillData] = useState(null);
```

## Caching Strategy

```
┌─────────────────────────────────────────────────────┐
│                  CACHING LAYERS                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  BACKEND (Python)                                  │
│  ┌───────────────────────────────────────────┐   │
│  │ legiscan_service.py                       │   │
│  │                                           │   │
│  │ session_cache (TTLCache)                 │   │
│  │ ├── maxsize: 100                         │   │
│  │ ├── ttl: 1800s (30 min)                  │   │
│  │ └── key: "sessions_{state}"              │   │
│  │                                           │   │
│  │ bill_cache (TTLCache)                    │   │
│  │ ├── maxsize: 500                         │   │
│  │ ├── ttl: 1800s (30 min)                  │   │
│  │ └── key: "bill_{bill_id}"                │   │
│  │                                           │   │
│  │ search_cache (TTLCache)                  │   │
│  │ ├── maxsize: 200                         │   │
│  │ ├── ttl: 1800s (30 min)                  │   │
│  │ └── key: "search_{state}_{query}"        │   │
│  └───────────────────────────────────────────┘   │
│                                                     │
│  FRONTEND (React)                                  │
│  ┌───────────────────────────────────────────┐   │
│  │ Legislation.jsx                           │   │
│  │                                           │   │
│  │ extractedBillData (useState)             │   │
│  │ └── Stores extracted bill text           │   │
│  │     for current session                   │   │
│  │                                           │   │
│  │ stateBills (useState)                    │   │
│  │ └── Stores fetched bills for             │   │
│  │     current state                         │   │
│  └───────────────────────────────────────────┘   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Error Handling Flow

```
User Action
    │
    ├─ Frontend validates input
    │
    ├─ Makes API request
    │
    ▼
Backend Endpoint
    │
    ├─ Validates request
    │  └─ Invalid? → 400 Bad Request
    │
    ├─ Checks service availability
    │  └─ No API key? → 503 Service Unavailable
    │
    ├─ Calls LegiScan service
    │
    ▼
LegiScan Service
    │
    ├─ Checks cache
    │  └─ Hit? → Return cached data
    │
    ├─ Makes API request
    │  ├─ 404? → Bill not found
    │  ├─ 429? → Rate limit exceeded
    │  └─ 500? → API error
    │
    ├─ Parses response
    │  └─ Invalid? → Parse error
    │
    ▼
Return to Frontend
    │
    ├─ Success? → Display data
    │
    ├─ Error? → Show user-friendly message
    │  ├─ "Bill text not available yet"
    │  ├─ "API key required"
    │  ├─ "Rate limit exceeded"
    │  └─ "Unable to load bills"
    │
    ▼
User sees appropriate feedback
```

## Integration Points

### Places Updated in Legislation.jsx

1. **State Management** (Lines ~631-634)
   - Added jurisdiction, selectedState, statesList, stateBills

2. **Bill Selection Handlers** (Lines ~823-839)
   - Added handleSelectStateBill()

3. **Bill Text Extraction** (Lines ~912-966)
   - Added extractStateBillText()

4. **Analysis Flow** (Lines ~1526-1531)
   - Added state bill check and extraction

5. **Debate Flow** (Lines ~1715-1737)
   - Updated to support state bills

6. **Bill Source Checks** (7 locations)
   - Updated all billSource comparisons to include 'state'

7. **UI Components** (Lines ~2429-2608)
   - Added Jurisdiction Selector
   - Updated bills display logic

## Performance Characteristics

```
Operation                    | Time    | API Queries | Cache Hit Rate
─────────────────────────────┼─────────┼─────────────┼──────────────
Get state list               | <100ms  | 0 (static)  | N/A
Get state sessions           | ~500ms  | 1           | ~80% after 1st
Get state bills (20)         | ~1-2s   | 1           | ~70% after 1st
Get bill details             | ~800ms  | 1           | ~75% after 1st
Get bill text                | ~1-1.5s | 1           | ~60% after 1st
Full analysis (with AI)      | ~15-30s | 0 (cached)  | N/A
```

## Security Considerations

```
┌─────────────────────────────────────────┐
│          Security Measures              │
├─────────────────────────────────────────┤
│                                         │
│  API Key Storage                        │
│  ├── Stored in .env file               │
│  ├── Not committed to git              │
│  ├── Loaded at runtime                 │
│  └── Never exposed to frontend         │
│                                         │
│  API Requests                           │
│  ├── All via backend proxy             │
│  ├── Frontend never sees API key       │
│  ├── Rate limiting via caching         │
│  └── Error messages sanitized          │
│                                         │
│  Data Validation                        │
│  ├── State code validated              │
│  ├── Bill IDs validated                │
│  ├── Input sanitization                │
│  └── Output escaping                   │
│                                         │
└─────────────────────────────────────────┘
```

---

This architecture provides:
- ✅ Clean separation of concerns
- ✅ Efficient caching to minimize API usage
- ✅ Robust error handling
- ✅ Seamless federal/state integration
- ✅ Scalable design for future enhancements
