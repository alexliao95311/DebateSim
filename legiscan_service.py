"""
LegiScan API Service for state bill retrieval and analysis
"""
import logging
import aiohttp
import base64
from typing import List, Dict, Any, Optional
from cachetools import TTLCache

logger = logging.getLogger(__name__)

class LegiScanService:
    """Service for interacting with LegiScan API for state bills"""

    BASE_URL = "https://api.legiscan.com/"

    # US States mapping
    STATES = {
        'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
        'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
        'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
        'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
        'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
        'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
        'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
        'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
        'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
        'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
        'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
        'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
        'WI': 'Wisconsin', 'WY': 'Wyoming'
    }

    def __init__(self, api_key: str, session: aiohttp.ClientSession):
        """Initialize LegiScan service"""
        self.api_key = api_key
        self.session = session

        # Cache for API responses (30 minute TTL to conserve monthly query limit)
        self.session_cache = TTLCache(maxsize=100, ttl=1800)  # 30 minutes
        self.bill_cache = TTLCache(maxsize=500, ttl=1800)
        self.search_cache = TTLCache(maxsize=200, ttl=1800)

    def _build_url(self, operation: str, **params) -> str:
        """Build LegiScan API URL with parameters"""
        query_params = {"key": self.api_key, "op": operation}
        query_params.update(params)

        param_str = "&".join(f"{k}={v}" for k, v in query_params.items())
        return f"{self.BASE_URL}?{param_str}"

    async def get_session_list(self, state: str) -> List[Dict[str, Any]]:
        """Get list of legislative sessions for a state"""
        cache_key = f"sessions_{state}"
        if cache_key in self.session_cache:
            return self.session_cache[cache_key]

        try:
            url = self._build_url("getSessionList", state=state.upper())

            async with self.session.get(url) as response:
                if response.status != 200:
                    logger.error(f"LegiScan API error: {response.status}")
                    return []

                data = await response.json()

                if data.get("status") == "OK":
                    sessions = data.get("sessions", [])
                    self.session_cache[cache_key] = sessions
                    return sessions
                else:
                    logger.error(f"LegiScan API error: {data.get('alert', 'Unknown error')}")
                    return []

        except Exception as e:
            logger.error(f"Error fetching sessions for {state}: {e}")
            return []

    async def get_master_list(self, state: str, session_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """Get master list of bills for a state session"""
        # Get current session if not provided
        if not session_id:
            sessions = await self.get_session_list(state)
            if not sessions:
                return []
            # Get most recent session
            session_id = max(sessions, key=lambda x: x.get('year_end', 0)).get('session_id')
            if not session_id:
                return []

        cache_key = f"master_list_{state}_{session_id}"
        if cache_key in self.bill_cache:
            return self.bill_cache[cache_key]

        try:
            # Use getMasterList instead of Raw for better data
            url = self._build_url("getMasterList", id=session_id)

            async with self.session.get(url) as response:
                if response.status != 200:
                    logger.error(f"LegiScan API error: {response.status}")
                    return []

                data = await response.json()

                if data.get("status") == "OK":
                    # Extract bills from master list
                    master_list = data.get("masterlist", {})
                    bills = []

                    for bill_id, bill_data in master_list.items():
                        if bill_id == "session":
                            continue

                        bills.append({
                            "id": bill_data.get("bill_id"),
                            "number": bill_data.get("number", ""),  # Changed from bill_number to number
                            "title": bill_data.get("title", "Untitled Bill"),
                            "description": bill_data.get("description", ""),
                            "status": bill_data.get("status_desc", ""),
                            "lastAction": bill_data.get("last_action", ""),
                            "lastActionDate": bill_data.get("last_action_date", ""),
                            "url": bill_data.get("url", ""),
                            "stateLink": bill_data.get("state_link", ""),
                            "sponsor": "",  # Sponsors not available in master list
                            "changeHash": bill_data.get("change_hash", "")
                        })

                    # Sort by last action date (most recent first)
                    bills.sort(key=lambda x: x.get("lastActionDate", ""), reverse=True)

                    # Diversify by bill type - get top bills from each type
                    # This ensures we show a mix of SB, AB, HR, etc. instead of just one type
                    bill_types = {}
                    for bill in bills:
                        # Extract bill type prefix (e.g., "SB" from "SB 123")
                        import re
                        match = re.match(r'^([A-Z]+)', bill.get("number", ""))
                        if match:
                            bill_type = match.group(1)
                            if bill_type not in bill_types:
                                bill_types[bill_type] = []
                            bill_types[bill_type].append(bill)

                    # Take top bills from each type (round-robin selection)
                    diversified_bills = []
                    max_per_type = 10  # Max bills per type to show

                    # Get bills round-robin from each type
                    type_lists = list(bill_types.values())
                    if type_lists:
                        max_length = max(len(lst) for lst in type_lists)
                        for i in range(max_length):
                            for type_list in type_lists:
                                if i < len(type_list) and i < max_per_type:
                                    diversified_bills.append(type_list[i])
                    else:
                        # Fallback if no types found
                        diversified_bills = bills

                    # Limit to 20 bills total
                    diversified_bills = diversified_bills[:20]

                    self.bill_cache[cache_key] = diversified_bills
                    return diversified_bills
                else:
                    logger.error(f"LegiScan API error: {data.get('alert', 'Unknown error')}")
                    return []

        except Exception as e:
            logger.error(f"Error fetching master list for {state} session {session_id}: {e}")
            return []

    async def search_bills(self, state: str, query: str, limit: int = 20) -> List[Dict[str, Any]]:
        """Search for bills in a state"""
        cache_key = f"search_{state}_{query}_{limit}"
        if cache_key in self.search_cache:
            return self.search_cache[cache_key]

        try:
            url = self._build_url("getSearchRaw", state=state.upper(), query=query)

            async with self.session.get(url) as response:
                if response.status != 200:
                    logger.error(f"LegiScan API error: {response.status}")
                    return []

                data = await response.json()

                if data.get("status") == "OK":
                    search_results = data.get("searchresult", [])
                    bills = []

                    for result in search_results[:limit]:
                        if isinstance(result, dict) and "bill_id" in result:
                            bills.append({
                                "id": result.get("bill_id"),
                                "number": result.get("bill_number", ""),
                                "title": result.get("title", "Untitled Bill"),
                                "description": result.get("description", ""),
                                "status": result.get("status_desc", ""),
                                "lastAction": result.get("last_action", ""),
                                "lastActionDate": result.get("last_action_date", ""),
                                "url": result.get("url", ""),
                                "stateLink": result.get("state_link", ""),
                                "relevance": result.get("relevance", 0)
                            })

                    # Sort by relevance
                    bills.sort(key=lambda x: x.get("relevance", 0), reverse=True)

                    self.search_cache[cache_key] = bills
                    return bills
                else:
                    logger.error(f"LegiScan API error: {data.get('alert', 'Unknown error')}")
                    return []

        except Exception as e:
            logger.error(f"Error searching bills in {state} for '{query}': {e}")
            return []

    async def get_bill(self, bill_id: int) -> Optional[Dict[str, Any]]:
        """Get detailed information about a specific bill"""
        cache_key = f"bill_{bill_id}"
        if cache_key in self.bill_cache:
            return self.bill_cache[cache_key]

        try:
            url = self._build_url("getBill", id=bill_id)

            async with self.session.get(url) as response:
                if response.status != 200:
                    logger.error(f"LegiScan API error: {response.status}")
                    return None

                data = await response.json()

                if data.get("status") == "OK":
                    bill = data.get("bill", {})

                    # Extract sponsors
                    sponsors = bill.get("sponsors", [])
                    sponsor_name = "Unknown Sponsor"
                    if sponsors:
                        sponsor = sponsors[0]
                        name = sponsor.get("name", "")
                        if name:
                            sponsor_name = name

                    bill_info = {
                        "id": bill.get("bill_id"),
                        "number": bill.get("bill_number", ""),
                        "title": bill.get("title", "Untitled Bill"),
                        "description": bill.get("description", ""),
                        "status": bill.get("status_desc", ""),
                        "lastAction": bill.get("last_action", ""),
                        "lastActionDate": bill.get("last_action_date", ""),
                        "sponsor": sponsor_name,
                        "url": bill.get("url", ""),
                        "stateLink": bill.get("state_link", ""),
                        "texts": bill.get("texts", []),
                        "changeHash": bill.get("change_hash", "")
                    }

                    self.bill_cache[cache_key] = bill_info
                    return bill_info
                else:
                    logger.error(f"LegiScan API error: {data.get('alert', 'Unknown error')}")
                    return None

        except Exception as e:
            logger.error(f"Error fetching bill {bill_id}: {e}")
            return None

    async def get_bill_text(self, doc_id: int) -> Optional[str]:
        """Get bill text (Base64 decoded) - handles HTML, PDF, and plain text"""
        try:
            url = self._build_url("getBillText", id=doc_id)

            async with self.session.get(url) as response:
                if response.status != 200:
                    logger.error(f"LegiScan API error: {response.status}")
                    return None

                data = await response.json()

                if data.get("status") == "OK":
                    text_data = data.get("text", {})
                    mime_type = text_data.get("mime", "")
                    doc_base64 = text_data.get("doc", "")

                    if not doc_base64:
                        logger.error(f"No document data for doc_id {doc_id}")
                        return None

                    # Decode from Base64
                    doc_bytes = base64.b64decode(doc_base64)

                    # Handle PDF documents
                    if mime_type == "application/pdf" or doc_bytes.startswith(b'%PDF'):
                        logger.info(f"Processing PDF document for doc_id {doc_id}")
                        try:
                            import io
                            import pdfplumber

                            with pdfplumber.open(io.BytesIO(doc_bytes)) as pdf:
                                text_parts = []
                                for page in pdf.pages:
                                    page_text = page.extract_text()
                                    if page_text:
                                        text_parts.append(page_text)

                                if text_parts:
                                    full_text = '\n\n'.join(text_parts)
                                    logger.info(f"Successfully extracted {len(full_text)} chars from PDF")
                                    return full_text.strip()
                                else:
                                    logger.error(f"No text extracted from PDF for doc_id {doc_id}")
                                    return None
                        except Exception as pdf_error:
                            logger.error(f"Failed to parse PDF for doc_id {doc_id}: {pdf_error}")
                            return None

                    # Handle HTML/text documents
                    try:
                        doc_text = doc_bytes.decode('utf-8')

                        # Strip HTML tags for cleaner text
                        import re
                        clean_text = re.sub(r'<[^>]+>', '', doc_text)
                        clean_text = re.sub(r'&lt;', '<', clean_text)
                        clean_text = re.sub(r'&gt;', '>', clean_text)
                        clean_text = re.sub(r'&amp;', '&', clean_text)
                        clean_text = re.sub(r'&quot;', '"', clean_text)
                        clean_text = re.sub(r'&apos;', "'", clean_text)
                        clean_text = re.sub(r'\s+', ' ', clean_text)
                        clean_text = re.sub(r'\n\s*\n+', '\n\n', clean_text)

                        return clean_text.strip()
                    except UnicodeDecodeError:
                        logger.error(f"Failed to decode bill text for doc_id {doc_id} as UTF-8")
                        return None

                else:
                    logger.error(f"LegiScan API error: {data.get('alert', 'Unknown error')}")
                    return None

        except Exception as e:
            logger.error(f"Error fetching bill text for doc {doc_id}: {e}")
            return None

    @classmethod
    def get_state_list(cls) -> List[Dict[str, str]]:
        """Get list of all US states"""
        return [{"code": code, "name": name} for code, name in sorted(cls.STATES.items(), key=lambda x: x[1])]
