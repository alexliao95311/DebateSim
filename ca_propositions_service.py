"""
California Propositions Service
Fetches and parses CA ballot propositions from the Secretary of State
"""
import logging
import requests
import re
import io
from typing import List, Dict, Any, Optional
from cachetools import TTLCache
import pdfplumber

logger = logging.getLogger(__name__)

class CAPropositionsService:
    """Service for fetching and parsing California ballot propositions"""

    # CA Secretary of State URLs
    BASE_URL = "https://vig.cdn.sos.ca.gov"

    # Election cycle URLs (add more as needed)
    ELECTIONS = {
        "2025_special": {
            "date": "2025-11-04",
            "name": "November 2025 Special Election",
            "text_pdf_url": f"{BASE_URL}/2025/special/pdf/text-proposed-law.pdf",
            "voter_guide_url": f"{BASE_URL}/2025/special/en/pdf/complete-vig.pdf"
        },
        "2024_general": {
            "date": "2024-11-05",
            "name": "November 2024 General Election",
            "voter_guide_url": f"{BASE_URL}/2024/general/en/pdf/complete-vig.pdf"
        }
    }

    def __init__(self):
        """Initialize CA Propositions service"""
        # Cache for proposition lists and texts (24 hour TTL)
        self.props_cache = TTLCache(maxsize=50, ttl=86400)  # 24 hours
        self.text_cache = TTLCache(maxsize=100, ttl=86400)

    def get_current_election(self) -> str:
        """Get the most current/relevant election cycle"""
        # For now, return 2025 special election
        # TODO: Auto-detect based on current date
        return "2025_special"

    async def get_propositions_list(self, election_cycle: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get list of propositions for an election cycle

        For now, this returns a hardcoded list of known propositions.
        In production, you could scrape the SOS website index page.
        """
        if not election_cycle:
            election_cycle = self.get_current_election()

        cache_key = f"props_list_{election_cycle}"
        if cache_key in self.props_cache:
            return self.props_cache[cache_key]

        # Hardcoded list for 2025 special election
        # In production, scrape from https://www.sos.ca.gov/elections/ballot-measures
        propositions = []

        if election_cycle == "2025_special":
            propositions = [
                {
                    "id": "prop_2025_50",
                    "number": "50",
                    "election": "2025_special",
                    "title": "PROPOSITION 50",
                    "shortTitle": "Redistricting Commission Reform",
                    "description": "Constitutional amendment to reform California's redistricting process and commission structure.",
                    "type": "Constitutional Amendment",
                    "url": f"{self.BASE_URL}/2025/special/pdf/text-proposed-law.pdf",
                    "lastAction": "On ballot November 4, 2025",
                    "lastActionDate": "2025-11-04",
                    "sponsor": "California Secretary of State"
                }
            ]

        self.props_cache[cache_key] = propositions
        return propositions

    def extract_proposition_text(self, pdf_content: bytes, prop_number: str) -> Optional[str]:
        """
        Extract text for a specific proposition from the consolidated PDF

        Args:
            pdf_content: Raw PDF bytes
            prop_number: Proposition number (e.g., "50")

        Returns:
            Extracted text for the proposition
        """
        try:
            with pdfplumber.open(io.BytesIO(pdf_content)) as pdf:
                prop_pattern = re.compile(rf"\bPROPOSITION\s+{prop_number}\b", re.IGNORECASE)
                next_prop_pattern = re.compile(r"\bPROPOSITION\s+\d+\b", re.IGNORECASE)

                prop_pages = []
                in_proposition = False

                for page in pdf.pages:
                    text = page.extract_text() or ""

                    # Check if this page starts the target proposition
                    if prop_pattern.search(text):
                        in_proposition = True
                        prop_pages.append(text)
                        logger.info(f"Found start of Proposition {prop_number}")
                    elif in_proposition:
                        # Check if we've reached the next proposition
                        next_match = next_prop_pattern.search(text)
                        if next_match and next_match.group() != f"PROPOSITION {prop_number}":
                            logger.info(f"Reached next proposition, stopping extraction")
                            break
                        prop_pages.append(text)

                if prop_pages:
                    full_text = "\n\n".join(prop_pages)
                    logger.info(f"Extracted {len(prop_pages)} pages for Proposition {prop_number}")
                    return full_text
                else:
                    logger.warning(f"No text found for Proposition {prop_number}")
                    return None

        except Exception as e:
            logger.error(f"Error extracting proposition text: {e}")
            return None

    async def get_proposition_text(self, prop_id: str) -> Optional[Dict[str, Any]]:
        """
        Get the full text of a proposition

        Args:
            prop_id: Proposition ID (e.g., "prop_2025_50")

        Returns:
            Dict with proposition text and metadata
        """
        cache_key = f"prop_text_{prop_id}"
        if cache_key in self.text_cache:
            return self.text_cache[cache_key]

        try:
            # Parse prop_id to get election and number
            # Format: prop_YEAR_NUMBER
            parts = prop_id.split("_")
            if len(parts) < 3:
                logger.error(f"Invalid prop_id format: {prop_id}")
                return None

            election_year = parts[1]
            prop_number = parts[2]

            # Determine election cycle
            # For 2025, use special election
            if election_year == "2025":
                election_cycle = "2025_special"
            else:
                election_cycle = f"{election_year}_general"

            election_info = self.ELECTIONS.get(election_cycle)
            if not election_info or "text_pdf_url" not in election_info:
                logger.error(f"No PDF URL for election cycle: {election_cycle}")
                return None

            # Download PDF
            logger.info(f"Downloading proposition text PDF from: {election_info['text_pdf_url']}")
            response = requests.get(election_info["text_pdf_url"], timeout=60)
            response.raise_for_status()

            # Extract proposition text
            prop_text = self.extract_proposition_text(response.content, prop_number)

            if not prop_text:
                return None

            result = {
                "id": prop_id,
                "number": prop_number,
                "election": election_cycle,
                "text": prop_text,
                "text_length": len(prop_text),
                "pdf_url": election_info["text_pdf_url"]
            }

            self.text_cache[cache_key] = result
            return result

        except requests.RequestException as e:
            logger.error(f"Error downloading proposition PDF: {e}")
            return None
        except Exception as e:
            logger.error(f"Error getting proposition text: {e}")
            return None

    async def search_propositions(self, query: str, election_cycle: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Search propositions by keyword

        Args:
            query: Search query
            election_cycle: Optional election cycle to search within

        Returns:
            List of matching propositions
        """
        propositions = await self.get_propositions_list(election_cycle)

        # Simple text search
        query_lower = query.lower()
        results = []

        for prop in propositions:
            # Search in title and description
            if (query_lower in prop.get("title", "").lower() or
                query_lower in prop.get("shortTitle", "").lower() or
                query_lower in prop.get("description", "").lower()):
                results.append(prop)

        return results
