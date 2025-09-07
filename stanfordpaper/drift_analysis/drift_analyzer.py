"""
Drift Analysis System for AI Debate Models

This module implements custom drift analysis to measure differences between prompts
and track model performance variations across debate rounds.
"""

import numpy as np
import json
import re
from typing import Dict, List, Any, Tuple, Optional
from datetime import datetime
from dataclasses import dataclass
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.feature_extraction.text import TfidfVectorizer
import hashlib
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class DriftMetrics:
    """Container for drift analysis metrics"""
    prompt_similarity: float
    semantic_distance: float
    token_variation: float
    argument_structure_drift: float
    evidence_consistency: float
    rebuttal_engagement_drift: float
    overall_drift_score: float
    timestamp: str

@dataclass
class PromptVector:
    """Container for prompt vectorization data"""
    text: str
    tokens: List[str]
    vector: np.ndarray
    hash: str
    metadata: Dict[str, Any]

class DriftAnalyzer:
    """
    Custom drift analysis system for measuring prompt variations and model performance differences.
    
    This system goes beyond standard "prompt drift" to compare different prompts and
    measure how model outputs vary based on prompt variations.
    """
    
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        """
        Initialize the drift analyzer with a sentence transformer model.
        
        Args:
            model_name: Name of the sentence transformer model to use for embeddings
        """
        self.model_name = model_name
        self.sentence_model = SentenceTransformer(model_name)
        self.tfidf_vectorizer = TfidfVectorizer(max_features=1000, stop_words='english')
        self.prompt_history: List[PromptVector] = []
        self.drift_history: List[DriftMetrics] = []
        
        # Initialize TF-IDF vectorizer with sample data
        self._initialize_vectorizer()
        
    def _initialize_vectorizer(self):
        """Initialize TF-IDF vectorizer with sample debate prompts"""
        sample_prompts = [
            "You are a Pro debater arguing for the topic",
            "You are a Con debater arguing against the topic", 
            "Present exactly 3 main arguments in favor",
            "Refute the opponent's arguments with evidence",
            "Provide weighing and impact analysis"
        ]
        self.tfidf_vectorizer.fit(sample_prompts)
        
    def tokenize_prompt(self, prompt: str) -> List[str]:
        """
        Tokenize a prompt into meaningful tokens.
        
        Args:
            prompt: The prompt text to tokenize
            
        Returns:
            List of tokens
        """
        # Remove markdown formatting
        clean_prompt = re.sub(r'[#*`]', '', prompt)
        
        # Split into words and filter
        tokens = re.findall(r'\b\w+\b', clean_prompt.lower())
        
        # Remove very short tokens and common words
        stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'}
        tokens = [token for token in tokens if len(token) > 2 and token not in stop_words]
        
        return tokens
    
    def vectorize_prompt(self, prompt: str, metadata: Dict[str, Any] = None) -> PromptVector:
        """
        Convert a prompt into a vector representation.
        
        Args:
            prompt: The prompt text to vectorize
            metadata: Additional metadata about the prompt
            
        Returns:
            PromptVector object containing vectorized data
        """
        # Tokenize the prompt
        tokens = self.tokenize_prompt(prompt)
        
        # Create semantic embedding
        vector = self.sentence_model.encode([prompt])[0]
        
        # Create hash for deduplication
        prompt_hash = hashlib.md5(prompt.encode()).hexdigest()
        
        # Create metadata if not provided
        if metadata is None:
            metadata = {
                'timestamp': datetime.now().isoformat(),
                'token_count': len(tokens),
                'word_count': len(prompt.split())
            }
        
        return PromptVector(
            text=prompt,
            tokens=tokens,
            vector=vector,
            hash=prompt_hash,
            metadata=metadata
        )
    
    def calculate_semantic_distance(self, vector1: np.ndarray, vector2: np.ndarray) -> float:
        """
        Calculate semantic distance between two prompt vectors.
        
        Args:
            vector1: First prompt vector
            vector2: Second prompt vector
            
        Returns:
            Semantic distance (0-1, where 0 is identical, 1 is completely different)
        """
        # Calculate cosine similarity
        similarity = cosine_similarity([vector1], [vector2])[0][0]
        
        # Convert to distance (1 - similarity)
        distance = 1 - similarity
        
        return float(distance)
    
    def calculate_token_variation(self, tokens1: List[str], tokens2: List[str]) -> float:
        """
        Calculate token-level variation between two prompts.
        
        Args:
            tokens1: Tokens from first prompt
            tokens2: Tokens from second prompt
            
        Returns:
            Token variation score (0-1)
        """
        if not tokens1 and not tokens2:
            return 0.0
        
        # Calculate Jaccard similarity
        set1, set2 = set(tokens1), set(tokens2)
        intersection = len(set1.intersection(set2))
        union = len(set1.union(set2))
        
        if union == 0:
            return 0.0
        
        jaccard_similarity = intersection / union
        return 1 - jaccard_similarity
    
    def analyze_argument_structure_drift(self, output1: str, output2: str) -> float:
        """
        Analyze drift in argument structure between two outputs.
        
        Args:
            output1: First model output
            output2: Second model output
            
        Returns:
            Argument structure drift score (0-1)
        """
        # Count arguments in each output
        args1 = self._count_arguments(output1)
        args2 = self._count_arguments(output2)
        
        # Calculate structural difference
        if args1 == 0 and args2 == 0:
            return 0.0
        
        max_args = max(args1, args2)
        if max_args == 0:
            return 0.0
        
        return abs(args1 - args2) / max_args
    
    def _count_arguments(self, text: str) -> int:
        """Count the number of arguments in a text"""
        # Look for numbered arguments
        numbered_args = len(re.findall(r'\b(1|2|3|4|5)\.\s', text))
        
        # Look for argument headers
        header_args = len(re.findall(r'###\s*\d+\.', text))
        
        # Look for "Argument" mentions
        explicit_args = len(re.findall(r'Argument\s+\d+', text, re.IGNORECASE))
        
        return max(numbered_args, header_args, explicit_args)
    
    def analyze_evidence_consistency(self, output1: str, output2: str) -> float:
        """
        Analyze consistency of evidence usage between outputs.
        
        Args:
            output1: First model output
            output2: Second model output
            
        Returns:
            Evidence consistency score (0-1, where 1 is most consistent)
        """
        # Extract evidence patterns
        evidence1 = self._extract_evidence_patterns(output1)
        evidence2 = self._extract_evidence_patterns(output2)
        
        if not evidence1 and not evidence2:
            return 1.0
        
        # Calculate evidence overlap
        overlap = len(set(evidence1).intersection(set(evidence2)))
        total = len(set(evidence1).union(set(evidence2)))
        
        if total == 0:
            return 1.0
        
        return overlap / total
    
    def _extract_evidence_patterns(self, text: str) -> List[str]:
        """Extract evidence patterns from text"""
        patterns = []
        
        # Look for citations
        citations = re.findall(r'\b(?:H\.R\.|S\.|U\.S\.C\.|Section|Sec\.)\s*\d+', text)
        patterns.extend(citations)
        
        # Look for statistics
        stats = re.findall(r'\b\d+(?:\.\d+)?%', text)
        patterns.extend(stats)
        
        # Look for years
        years = re.findall(r'\b(19|20)\d{2}\b', text)
        patterns.extend(years)
        
        # Look for quotes
        quotes = re.findall(r'"([^"]+)"', text)
        patterns.extend(quotes)
        
        return patterns
    
    def analyze_rebuttal_engagement_drift(self, output1: str, output2: str) -> float:
        """
        Analyze drift in rebuttal engagement between outputs.
        
        Args:
            output1: First model output
            output2: Second model output
            
        Returns:
            Rebuttal engagement drift score (0-1)
        """
        # Calculate rebuttal engagement for each output
        engagement1 = self._calculate_rebuttal_engagement(output1)
        engagement2 = self._calculate_rebuttal_engagement(output2)
        
        # Return absolute difference
        return abs(engagement1 - engagement2)
    
    def _calculate_rebuttal_engagement(self, text: str) -> float:
        """Calculate rebuttal engagement score for a text"""
        if not text:
            return 0.0
        
        # Look for rebuttal indicators
        rebuttal_indicators = [
            r'you (claim|argue|said|assert)',
            r'your (argument|claim|point)',
            r'my opponent',
            r'the opposition',
            r'however',
            r'but',
            r'although',
            r'despite'
        ]
        
        sentences = re.split(r'[.!?]+', text)
        if not sentences:
            return 0.0
        
        rebuttal_count = 0
        for sentence in sentences:
            if any(re.search(pattern, sentence, re.IGNORECASE) for pattern in rebuttal_indicators):
                rebuttal_count += 1
        
        return rebuttal_count / len(sentences)
    
    def compute_drift_metrics(self, prompt1: str, prompt2: str, 
                            output1: str = None, output2: str = None,
                            metadata1: Dict[str, Any] = None,
                            metadata2: Dict[str, Any] = None) -> DriftMetrics:
        """
        Compute comprehensive drift metrics between two prompts and their outputs.
        
        Args:
            prompt1: First prompt
            prompt2: Second prompt
            output1: First model output (optional)
            output2: Second model output (optional)
            metadata1: Metadata for first prompt (optional)
            metadata2: Metadata for second prompt (optional)
            
        Returns:
            DriftMetrics object containing all drift measurements
        """
        # Vectorize prompts
        vector1 = self.vectorize_prompt(prompt1, metadata1)
        vector2 = self.vectorize_prompt(prompt2, metadata2)
        
        # Calculate semantic distance
        semantic_distance = self.calculate_semantic_distance(vector1.vector, vector2.vector)
        
        # Calculate token variation
        token_variation = self.calculate_token_variation(vector1.tokens, vector2.tokens)
        
        # Calculate prompt similarity (inverse of semantic distance)
        prompt_similarity = 1 - semantic_distance
        
        # Initialize output-based metrics
        argument_structure_drift = 0.0
        evidence_consistency = 1.0
        rebuttal_engagement_drift = 0.0
        
        # Calculate output-based metrics if outputs are provided
        if output1 and output2:
            argument_structure_drift = self.analyze_argument_structure_drift(output1, output2)
            evidence_consistency = self.analyze_evidence_consistency(output1, output2)
            rebuttal_engagement_drift = self.analyze_rebuttal_engagement_drift(output1, output2)
        
        # Calculate overall drift score (weighted average)
        weights = {
            'semantic_distance': 0.3,
            'token_variation': 0.2,
            'argument_structure_drift': 0.2,
            'evidence_consistency': 0.15,
            'rebuttal_engagement_drift': 0.15
        }
        
        overall_drift_score = (
            weights['semantic_distance'] * semantic_distance +
            weights['token_variation'] * token_variation +
            weights['argument_structure_drift'] * argument_structure_drift +
            weights['evidence_consistency'] * (1 - evidence_consistency) +  # Invert consistency
            weights['rebuttal_engagement_drift'] * rebuttal_engagement_drift
        )
        
        # Create drift metrics
        drift_metrics = DriftMetrics(
            prompt_similarity=prompt_similarity,
            semantic_distance=semantic_distance,
            token_variation=token_variation,
            argument_structure_drift=argument_structure_drift,
            evidence_consistency=evidence_consistency,
            rebuttal_engagement_drift=rebuttal_engagement_drift,
            overall_drift_score=overall_drift_score,
            timestamp=datetime.now().isoformat()
        )
        
        # Store in history
        self.drift_history.append(drift_metrics)
        
        return drift_metrics
    
    def analyze_prompt_evolution(self, prompts: List[str], outputs: List[str] = None) -> Dict[str, Any]:
        """
        Analyze how prompts evolve over time and their impact on outputs.
        
        Args:
            prompts: List of prompts in chronological order
            outputs: List of corresponding outputs (optional)
            
        Returns:
            Dictionary containing evolution analysis
        """
        if len(prompts) < 2:
            return {"error": "Need at least 2 prompts for evolution analysis"}
        
        evolution_data = {
            'total_prompts': len(prompts),
            'semantic_evolution': [],
            'token_evolution': [],
            'output_evolution': [],
            'drift_trend': 'stable'
        }
        
        # Analyze pairwise drift
        for i in range(1, len(prompts)):
            output1 = outputs[i-1] if outputs and i-1 < len(outputs) else None
            output2 = outputs[i] if outputs and i < len(outputs) else None
            
            drift_metrics = self.compute_drift_metrics(
                prompts[i-1], prompts[i], output1, output2
            )
            
            evolution_data['semantic_evolution'].append(drift_metrics.semantic_distance)
            evolution_data['token_evolution'].append(drift_metrics.token_variation)
            
            if output1 and output2:
                evolution_data['output_evolution'].append(drift_metrics.overall_drift_score)
        
        # Determine drift trend
        if evolution_data['semantic_evolution']:
            avg_drift = np.mean(evolution_data['semantic_evolution'])
            if avg_drift > 0.3:
                evolution_data['drift_trend'] = 'high'
            elif avg_drift > 0.1:
                evolution_data['drift_trend'] = 'moderate'
            else:
                evolution_data['drift_trend'] = 'low'
        
        return evolution_data
    
    def save_drift_analysis(self, filename: str = None) -> str:
        """
        Save drift analysis results to a JSON file.
        
        Args:
            filename: Optional filename, defaults to timestamp-based name
            
        Returns:
            Path to saved file
        """
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"drift_analysis_{timestamp}.json"
        
        # Prepare data for serialization
        data = {
            'metadata': {
                'model_name': self.model_name,
                'analysis_timestamp': datetime.now().isoformat(),
                'total_analyses': len(self.drift_history)
            },
            'drift_history': [
                {
                    'prompt_similarity': float(metrics.prompt_similarity),
                    'semantic_distance': float(metrics.semantic_distance),
                    'token_variation': float(metrics.token_variation),
                    'argument_structure_drift': float(metrics.argument_structure_drift),
                    'evidence_consistency': float(metrics.evidence_consistency),
                    'rebuttal_engagement_drift': float(metrics.rebuttal_engagement_drift),
                    'overall_drift_score': float(metrics.overall_drift_score),
                    'timestamp': metrics.timestamp
                }
                for metrics in self.drift_history
            ],
            'prompt_history': [
                {
                    'text': pv.text,
                    'tokens': pv.tokens,
                    'hash': pv.hash,
                    'metadata': pv.metadata
                }
                for pv in self.prompt_history
            ]
        }
        
        # Save to file
        with open(filename, 'w') as f:
            json.dump(data, f, indent=2)
        
        logger.info(f"Drift analysis saved to {filename}")
        return filename
    
    def load_drift_analysis(self, filename: str) -> Dict[str, Any]:
        """
        Load drift analysis results from a JSON file.
        
        Args:
            filename: Path to the JSON file
            
        Returns:
            Loaded drift analysis data
        """
        with open(filename, 'r') as f:
            data = json.load(f)
        
        # Reconstruct drift history
        self.drift_history = []
        for metrics_data in data.get('drift_history', []):
            metrics = DriftMetrics(
                prompt_similarity=metrics_data['prompt_similarity'],
                semantic_distance=metrics_data['semantic_distance'],
                token_variation=metrics_data['token_variation'],
                argument_structure_drift=metrics_data['argument_structure_drift'],
                evidence_consistency=metrics_data['evidence_consistency'],
                rebuttal_engagement_drift=metrics_data['rebuttal_engagement_drift'],
                overall_drift_score=metrics_data['overall_drift_score'],
                timestamp=metrics_data['timestamp']
            )
            self.drift_history.append(metrics)
        
        # Reconstruct prompt history
        self.prompt_history = []
        for prompt_data in data.get('prompt_history', []):
            prompt_vector = PromptVector(
                text=prompt_data['text'],
                tokens=prompt_data['tokens'],
                vector=np.array([]),  # Will be recomputed if needed
                hash=prompt_data['hash'],
                metadata=prompt_data['metadata']
            )
            self.prompt_history.append(prompt_vector)
        
        logger.info(f"Drift analysis loaded from {filename}")
        return data

# Example usage and testing
if __name__ == "__main__":
    # Initialize drift analyzer
    analyzer = DriftAnalyzer()
    
    # Example prompts for testing
    prompt1 = """
    You are a Pro debater arguing for H.R. 40 - Commission to Study and Develop Reparation Proposals for African-Americans Act.
    
    Present exactly 3 main arguments in favor of this legislation:
    1. Historical Justice
    2. Economic Impact
    3. Social Healing
    
    Support each argument with specific evidence from the bill text.
    """
    
    prompt2 = """
    You are a Pro debater arguing for H.R. 40 - Commission to Study and Develop Reparation Proposals for African-Americans Act.
    
    Present exactly 3 main arguments in favor of this legislation:
    1. Moral Imperative
    2. Economic Benefits
    3. National Reconciliation
    
    Use direct quotes from the bill and provide concrete examples.
    """
    
    # Example outputs
    output1 = """
    ### 1. Historical Justice
    The bill establishes a commission to study the lasting effects of slavery and discrimination.
    
    ### 2. Economic Impact
    Reparations would address wealth disparities and stimulate economic growth.
    
    ### 3. Social Healing
    This process would promote national reconciliation and healing.
    """
    
    output2 = """
    ### 1. Moral Imperative
    We have a moral obligation to address historical injustices.
    
    ### 2. Economic Benefits
    Reparations would close the racial wealth gap and benefit all Americans.
    
    ### 3. National Reconciliation
    This commission would help heal our nation's wounds.
    """
    
    # Compute drift metrics
    drift_metrics = analyzer.compute_drift_metrics(prompt1, prompt2, output1, output2)
    
    print("Drift Analysis Results:")
    print(f"Prompt Similarity: {drift_metrics.prompt_similarity:.3f}")
    print(f"Semantic Distance: {drift_metrics.semantic_distance:.3f}")
    print(f"Token Variation: {drift_metrics.token_variation:.3f}")
    print(f"Argument Structure Drift: {drift_metrics.argument_structure_drift:.3f}")
    print(f"Evidence Consistency: {drift_metrics.evidence_consistency:.3f}")
    print(f"Rebuttal Engagement Drift: {drift_metrics.rebuttal_engagement_drift:.3f}")
    print(f"Overall Drift Score: {drift_metrics.overall_drift_score:.3f}")
    
    # Save analysis
    filename = analyzer.save_drift_analysis()
    print(f"\nAnalysis saved to: {filename}")
