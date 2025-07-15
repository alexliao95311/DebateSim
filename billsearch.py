import os
import aiohttp
import logging
import asyncio
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv
from cachetools import TTLCache
import json
import re

# Load environment variables
load_dotenv()

# Initialize logging
logger = logging.getLogger(__name__)

CONGRESS_API_KEY = os.getenv("CONGRESS_API_KEY")
if not CONGRESS_API_KEY:
    logger.warning("CONGRESS_API_KEY not found. Search will use mock data.")

class BillSearcher:
    def __init__(self, session: aiohttp.ClientSession):
        self.session = session
        self.current_congress = 119  # Current Congress (2025-2027)
        
        # Smart caching - different TTLs for different types of data
        self.search_cache = TTLCache(maxsize=100, ttl=1800)  # 30 minutes for search results
        self.popular_bills_cache = TTLCache(maxsize=50, ttl=3600)  # 1 hour for popular bills
        self.suggestions_cache = TTLCache(maxsize=200, ttl=3600)  # 1 hour for suggestions
        
        # Popular search terms that users commonly look for
        self.popular_terms = [
            "healthcare", "climate", "infrastructure", "immigration", "education", 
            "defense", "tax", "budget", "privacy", "energy", "environment",
            "social security", "medicare", "medicaid", "veterans", "gun", "voting"
        ]
    
    async def search_bills(self, query: str, limit: int = 20) -> List[Dict[str, Any]]:
        """Fast bill search using Congress.gov search API directly"""
        
        if not CONGRESS_API_KEY:
            return await self._get_mock_results(query, limit)
        
        # Normalize query
        query = query.strip()
        if not query:
            return []
        
        # Check cache first
        cache_key = f"search_{query.lower()}_{limit}"
        if cache_key in self.search_cache:
            logger.info(f"Returning cached results for query: '{query}'")
            return self.search_cache[cache_key]
        
        try:
            # Use Congress.gov search API for fast, direct search
            results = await self._direct_search(query, limit)
            
            # If we get few results, try alternative search strategies
            if len(results) < 3:
                logger.info(f"Only {len(results)} results, trying enhanced search")
                enhanced_results = await self._enhanced_search(query, limit)
                
                # Merge results and remove duplicates
                seen_ids = set()
                combined_results = []
                
                for result in results + enhanced_results:
                    bill_id = result.get("id")
                    if bill_id and bill_id not in seen_ids:
                        seen_ids.add(bill_id)
                        combined_results.append(result)
                
                results = combined_results[:limit]
            
            # Cache the results
            self.search_cache[cache_key] = results
            
            logger.info(f"Found {len(results)} bills for query: '{query}'")
            return results
            
        except Exception as e:
            logger.error(f"Error searching bills: {e}")
            # Return empty results instead of failing
            return []
    
    async def _direct_search(self, query: str, limit: int) -> List[Dict[str, Any]]:
        """Direct search using Congress.gov search API"""
        
        results = []
        
        # Search current and recent Congress sessions (most relevant first)
        congress_sessions = [119, 118, 117, 116]  # Current and recent sessions
        
        for congress in congress_sessions:
            if len(results) >= limit:
                break
                
            # Use the search endpoint for faster results
            url = f"https://api.congress.gov/v3/bill/{congress}"
            params = {
                "api_key": CONGRESS_API_KEY,
                "format": "json",
                "limit": min(50, limit * 2),  # Request more to account for filtering
                "sort": "updateDate+desc"
            }
            
            try:
                async with self.session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=10)) as response:
                    if response.status != 200:
                        logger.warning(f"Congress {congress} API returned {response.status}")
                        continue
                    
                    data = await response.json()
                    bills_data = data.get("bills", [])
                    
                    # Fast filtering for relevant bills
                    for bill in bills_data:
                        if len(results) >= limit:
                            break
                        
                        if self._is_relevant_match(bill, query):
                            processed_bill = self._process_bill_fast(bill, congress)
                            if processed_bill:
                                results.append(processed_bill)
                
            except asyncio.TimeoutError:
                logger.warning(f"Timeout searching Congress {congress}")
                continue
            except Exception as e:
                logger.warning(f"Error searching Congress {congress}: {e}")
                continue
        
        # Sort by relevance
        results.sort(key=lambda x: self._calculate_simple_relevance(x, query), reverse=True)
        
        return results[:limit]
    
    async def _enhanced_search(self, query: str, limit: int) -> List[Dict[str, Any]]:
        """Enhanced search for when direct search yields few results"""
        
        results = []
        
        # Try searching with individual keywords
        keywords = self._extract_keywords(query)
        
        for keyword in keywords[:2]:  # Limit to top 2 keywords to avoid too many requests
            if len(results) >= limit:
                break
                
            if len(keyword) < 3:  # Skip very short keywords
                continue
            
            # Search with single keyword
            single_results = await self._search_by_keyword(keyword, limit - len(results))
            
            # Add unique results
            existing_ids = {r.get("id") for r in results}
            for result in single_results:
                if result.get("id") not in existing_ids:
                    results.append(result)
        
        return results
    
    async def _search_by_keyword(self, keyword: str, limit: int) -> List[Dict[str, Any]]:
        """Search for bills by single keyword"""
        
        results = []
        
        # Search only current Congress for keyword search
        url = f"https://api.congress.gov/v3/bill/{self.current_congress}"
        params = {
            "api_key": CONGRESS_API_KEY,
            "format": "json",
            "limit": min(30, limit * 3),
            "sort": "updateDate+desc"
        }
        
        try:
            async with self.session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=8)) as response:
                if response.status != 200:
                    return results
                
                data = await response.json()
                bills_data = data.get("bills", [])
                
                for bill in bills_data:
                    if len(results) >= limit:
                        break
                    
                    if self._matches_keyword(bill, keyword):
                        processed_bill = self._process_bill_fast(bill, self.current_congress)
                        if processed_bill:
                            results.append(processed_bill)
            
        except Exception as e:
            logger.warning(f"Error in keyword search for '{keyword}': {e}")
        
        return results
    
    def _is_relevant_match(self, bill: Dict[str, Any], query: str) -> bool:
        """Fast relevance check - only the most important criteria"""
        query_lower = query.lower()
        
        # Check title (most important)
        title = bill.get("title", "").lower()
        if query_lower in title:
            return True
        
        # Check bill number (exact match)
        bill_type = bill.get("type", "").lower()
        bill_number = str(bill.get("number", ""))
        if bill_type and bill_number:
            bill_code = f"{bill_type} {bill_number}"
            if query_lower in bill_code or bill_code in query_lower:
                return True
            
            # Check for pattern like "HR 1234" or "S 567"
            if re.search(rf"\b{re.escape(bill_type)}\s*{re.escape(bill_number)}\b", query_lower):
                return True
        
        # Check sponsor (simplified)
        sponsors = bill.get("sponsors", [])
        if sponsors and isinstance(sponsors[0], dict):
            sponsor = sponsors[0]
            last_name = sponsor.get("lastName", "").lower()
            if last_name and last_name in query_lower:
                return True
        
        return False
    
    def _matches_keyword(self, bill: Dict[str, Any], keyword: str) -> bool:
        """Check if bill matches a single keyword"""
        keyword_lower = keyword.lower()
        
        # Check title
        title = bill.get("title", "").lower()
        if keyword_lower in title:
            return True
        
        # Check policy area
        policy_area = bill.get("policyArea", {})
        if isinstance(policy_area, dict):
            policy_name = policy_area.get("name", "").lower()
            if keyword_lower in policy_name:
                return True
        
        return False
    
    def _process_bill_fast(self, bill: Dict[str, Any], congress_num: int = None) -> Optional[Dict[str, Any]]:
        """Fast bill processing - minimal data transformation"""
        try:
            bill_type = bill.get("type", "").upper()
            bill_number = bill.get("number", "")
            title = bill.get("title", "Untitled Bill")
            
            if not bill_type or not bill_number:
                return None
            
            # Get sponsor info (simplified)
            sponsors = bill.get("sponsors", [])
            sponsor_name = "Unknown Sponsor"
            if sponsors and isinstance(sponsors[0], dict):
                sponsor = sponsors[0]
                first_name = sponsor.get("firstName", "")
                last_name = sponsor.get("lastName", "")
                party = sponsor.get("party", "")
                state = sponsor.get("state", "")
                
                if last_name:
                    title_prefix = "Rep." if sponsor.get("bioguideId", "").startswith("H") else "Sen."
                    sponsor_name = f"{title_prefix} {first_name} {last_name}"
                    if party and state:
                        sponsor_name += f" ({party}-{state})"
            
            # Get latest action (simplified)
            latest_action = bill.get("latestAction", {})
            action_text = latest_action.get("text", "No recent action")
            action_date = latest_action.get("actionDate", "")
            
            # Create description
            description = title
            if len(description) > 200:
                description = description[:197] + "..."
            
            # Get congress info - use provided congress_num or fallback to bill data or current
            congress = congress_num or bill.get("congress", self.current_congress)
            
            return {
                "id": f"{bill_type}{bill_number}-{congress}",
                "type": bill_type,
                "number": bill_number,
                "title": title,
                "description": description,
                "sponsor": sponsor_name,
                "latestAction": action_text,
                "actionDate": action_date,
                "congress": congress,
                "url": bill.get("url", ""),
                "policyArea": bill.get("policyArea", {}).get("name", ""),
                "updateDate": bill.get("updateDate", "")
            }
            
        except Exception as e:
            logger.warning(f"Error processing bill: {e}")
            return None
    
    def _calculate_simple_relevance(self, bill: Dict[str, Any], query: str) -> int:
        """Simplified relevance scoring for fast sorting"""
        query_lower = query.lower()
        score = 0
        
        title = bill.get("title", "").lower()
        bill_code = f"{bill.get('type', '')} {bill.get('number', '')}".lower()
        
        # Title matches (highest priority)
        if title.startswith(query_lower):
            score += 100
        elif query_lower in title:
            score += 50
        
        # Bill code exact match
        if query_lower == bill_code:
            score += 90
        elif query_lower in bill_code:
            score += 40
        
        # Sponsor match
        sponsor = bill.get("sponsor", "").lower()
        if query_lower in sponsor:
            score += 30
        
        # Boost for current Congress
        if bill.get("congress") == self.current_congress:
            score += 10
        
        # Boost for recent updates
        update_date = bill.get("updateDate", "")
        if update_date and "2024" in update_date or "2025" in update_date:
            score += 5
        
        return score
    
    def _extract_keywords(self, query: str) -> List[str]:
        """Extract meaningful keywords from search query"""
        # Remove common words and split
        stop_words = {"the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by", "act", "bill"}
        words = re.findall(r'\b\w+\b', query.lower())
        keywords = [word for word in words if word not in stop_words and len(word) >= 3]
        
        # Sort by length (longer keywords first)
        keywords.sort(key=len, reverse=True)
        
        return keywords
    
    async def get_suggestions(self, query: str, limit: int = 5) -> List[str]:
        """Get search suggestions for autocomplete"""
        
        if not query or len(query) < 2:
            return []
        
        cache_key = f"suggest_{query.lower()}_{limit}"
        if cache_key in self.suggestions_cache:
            return self.suggestions_cache[cache_key]
        
        suggestions = []
        query_lower = query.lower()
        
        # Add popular terms that match
        for term in self.popular_terms:
            if query_lower in term or term.startswith(query_lower):
                suggestions.append(term.title())
        
        # Add bill number suggestions if query looks like bill pattern
        if re.match(r'^[hs]\.?r?\.?\s*\d*$', query_lower):
            bill_patterns = [
                f"HR {query_lower[-4:] if query_lower[-4:].isdigit() else '1234'}",
                f"S {query_lower[-4:] if query_lower[-4:].isdigit() else '567'}"
            ]
            suggestions.extend(bill_patterns)
        
        # Cache and return
        suggestions = suggestions[:limit]
        self.suggestions_cache[cache_key] = suggestions
        
        return suggestions
    
    async def _get_mock_results(self, query: str, limit: int) -> List[Dict[str, Any]]:
        """Mock results when API key is not available"""
        
        mock_bills = [
            {
                "id": "HR1234-119",
                "type": "HR",
                "number": "1234",
                "title": f"Mock Healthcare Reform Act - matches '{query}'",
                "description": "A mock bill for testing search functionality when Congress API is not available.",
                "sponsor": "Rep. Mock Sponsor (D-CA)",
                "latestAction": "Referred to Committee",
                "actionDate": "2025-01-15",
                "congress": 119,
                "url": "",
                "policyArea": "Health",
                "updateDate": "2025-01-15"
            },
            {
                "id": "S567-119", 
                "type": "S",
                "number": "567",
                "title": f"Mock Infrastructure Investment Act - related to '{query}'",
                "description": "Another mock bill for testing search functionality.",
                "sponsor": "Sen. Mock Senator (R-TX)",
                "latestAction": "Passed Senate",
                "actionDate": "2025-01-10",
                "congress": 119,
                "url": "",
                "policyArea": "Transportation",
                "updateDate": "2025-01-10"
            }
        ]
        
        return mock_bills[:limit]