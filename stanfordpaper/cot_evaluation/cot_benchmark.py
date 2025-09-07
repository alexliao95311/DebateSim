"""
Chain-of-Thought (CoT) Evaluation Framework for AI Debate Capabilities

This module implements a comprehensive benchmark system focused on CoT-specific
evaluation of debate capabilities, judging capabilities, and feedback capabilities.
"""

import json
import os
import re
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
import logging
import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class CoTCapability(Enum):
    """Enumeration of CoT capabilities being evaluated"""
    DEBATING = "debating"
    JUDGING = "judging"
    FEEDBACK = "feedback"

class CoTQuality(Enum):
    """Enumeration of CoT quality levels"""
    EXCELLENT = "excellent"
    GOOD = "good"
    FAIR = "fair"
    POOR = "poor"

@dataclass
class CoTStep:
    """Individual step in a Chain-of-Thought process"""
    step_number: int
    description: str
    reasoning: str
    evidence: Optional[str] = None
    confidence: Optional[float] = None
    quality_score: Optional[float] = None

@dataclass
class CoTAnalysis:
    """Complete CoT analysis for a model response"""
    capability: CoTCapability
    response_text: str
    extracted_steps: List[CoTStep]
    overall_quality: CoTQuality
    reasoning_depth: float
    evidence_integration: float
    logical_flow: float
    step_coherence: float
    total_score: float
    timestamp: str

@dataclass
class CoTBenchmarkResult:
    """Result of a CoT benchmark evaluation"""
    model_name: str
    capability: CoTCapability
    test_case: str
    analysis: CoTAnalysis
    performance_metrics: Dict[str, float]
    comparison_metrics: Dict[str, float] = None

class CoTExtractor:
    """
    Extracts Chain-of-Thought reasoning from model responses.
    
    This class identifies and parses CoT patterns in AI-generated text,
    breaking down the reasoning process into individual steps.
    """
    
    def __init__(self):
        """Initialize the CoT extractor"""
        self.cot_patterns = [
            r'(?:First|Initially|To start|Step \d+):\s*(.+?)(?=(?:Second|Next|Then|Step \d+|\n\n|$))',
            r'(?:Second|Next|Then|Step \d+):\s*(.+?)(?=(?:Third|Next|Then|Step \d+|\n\n|$))',
            r'(?:Third|Finally|Last|Step \d+):\s*(.+?)(?=(?:\n\n|$))',
            r'### \d+\.\s*(.+?)(?=(?:### \d+\.|\n\n|$))',
            r'\d+\.\s*(.+?)(?=(?:\d+\.|\n\n|$))'
        ]
        
        self.reasoning_indicators = [
            'because', 'since', 'therefore', 'thus', 'hence', 'consequently',
            'as a result', 'due to', 'given that', 'considering', 'in light of',
            'this means', 'this suggests', 'this indicates', 'this shows'
        ]
        
        self.evidence_indicators = [
            'according to', 'research shows', 'studies indicate', 'data suggests',
            'evidence shows', 'statistics reveal', 'findings demonstrate',
            'the bill states', 'section x indicates', 'as mentioned in'
        ]
    
    def extract_cot_steps(self, response_text: str) -> List[CoTStep]:
        """
        Extract CoT steps from a model response.
        
        Args:
            response_text: The model response to analyze
            
        Returns:
            List of CoTStep objects
        """
        steps = []
        
        # Try different extraction patterns
        for pattern in self.cot_patterns:
            matches = re.findall(pattern, response_text, re.IGNORECASE | re.DOTALL)
            if matches:
                for i, match in enumerate(matches, 1):
                    step_text = match.strip()
                    if len(step_text) > 10:  # Filter out very short matches
                        reasoning = self._extract_reasoning(step_text)
                        evidence = self._extract_evidence(step_text)
                        confidence = self._estimate_confidence(step_text)
                        
                        step = CoTStep(
                            step_number=i,
                            description=step_text[:100] + "..." if len(step_text) > 100 else step_text,
                            reasoning=reasoning,
                            evidence=evidence,
                            confidence=confidence
                        )
                        steps.append(step)
                break  # Use first successful pattern
        
        # If no structured steps found, try to extract implicit reasoning
        if not steps:
            steps = self._extract_implicit_reasoning(response_text)
        
        return steps
    
    def _extract_reasoning(self, text: str) -> str:
        """Extract reasoning from a text segment"""
        reasoning_parts = []
        
        for indicator in self.reasoning_indicators:
            pattern = rf'{indicator}[^.!?]*[.!?]'
            matches = re.findall(pattern, text, re.IGNORECASE)
            reasoning_parts.extend(matches)
        
        return ' '.join(reasoning_parts) if reasoning_parts else text[:200]
    
    def _extract_evidence(self, text: str) -> Optional[str]:
        """Extract evidence from a text segment"""
        evidence_parts = []
        
        for indicator in self.evidence_indicators:
            pattern = rf'{indicator}[^.!?]*[.!?]'
            matches = re.findall(pattern, text, re.IGNORECASE)
            evidence_parts.extend(matches)
        
        return ' '.join(evidence_parts) if evidence_parts else None
    
    def _estimate_confidence(self, text: str) -> float:
        """Estimate confidence level based on language patterns"""
        confidence_indicators = {
            'high': ['clearly', 'obviously', 'undoubtedly', 'certainly', 'definitely'],
            'medium': ['likely', 'probably', 'suggests', 'indicates', 'appears'],
            'low': ['possibly', 'might', 'could', 'perhaps', 'maybe']
        }
        
        text_lower = text.lower()
        
        high_count = sum(1 for word in confidence_indicators['high'] if word in text_lower)
        medium_count = sum(1 for word in confidence_indicators['medium'] if word in text_lower)
        low_count = sum(1 for word in confidence_indicators['low'] if word in text_lower)
        
        if high_count > medium_count and high_count > low_count:
            return 0.8
        elif medium_count > low_count:
            return 0.6
        else:
            return 0.4
    
    def _extract_implicit_reasoning(self, text: str) -> List[CoTStep]:
        """Extract implicit reasoning when no structured steps are found"""
        # Split text into sentences
        sentences = re.split(r'[.!?]+', text)
        sentences = [s.strip() for s in sentences if s.strip()]
        
        steps = []
        current_step = ""
        
        for i, sentence in enumerate(sentences):
            current_step += sentence + ". "
            
            # Create a step every 2-3 sentences or when reasoning indicators appear
            if (i + 1) % 2 == 0 or any(indicator in sentence.lower() for indicator in self.reasoning_indicators):
                if len(current_step.strip()) > 20:
                    step = CoTStep(
                        step_number=len(steps) + 1,
                        description=current_step.strip()[:100] + "..." if len(current_step) > 100 else current_step.strip(),
                        reasoning=current_step.strip(),
                        evidence=self._extract_evidence(current_step),
                        confidence=self._estimate_confidence(current_step)
                    )
                    steps.append(step)
                    current_step = ""
        
        # Add remaining text as final step
        if current_step.strip():
            step = CoTStep(
                step_number=len(steps) + 1,
                description=current_step.strip()[:100] + "..." if len(current_step) > 100 else current_step.strip(),
                reasoning=current_step.strip(),
                evidence=self._extract_evidence(current_step),
                confidence=self._estimate_confidence(current_step)
            )
            steps.append(step)
        
        return steps

class CoTEvaluator:
    """
    Evaluates Chain-of-Thought quality in model responses.
    
    This class provides comprehensive evaluation of CoT reasoning across
    different capabilities (debating, judging, feedback).
    """
    
    def __init__(self):
        """Initialize the CoT evaluator"""
        self.sentence_model = SentenceTransformer('all-MiniLM-L6-v2')
        
        # Quality criteria weights
        self.quality_weights = {
            'reasoning_depth': 0.25,
            'evidence_integration': 0.25,
            'logical_flow': 0.25,
            'step_coherence': 0.25
        }
    
    def evaluate_cot_quality(self, 
                           response_text: str, 
                           capability: CoTCapability,
                           extracted_steps: List[CoTStep] = None) -> CoTAnalysis:
        """
        Evaluate the quality of Chain-of-Thought reasoning in a response.
        
        Args:
            response_text: The model response to evaluate
            capability: The capability being evaluated
            extracted_steps: Pre-extracted CoT steps (optional)
            
        Returns:
            CoTAnalysis object with quality assessment
        """
        # Extract CoT steps if not provided
        if extracted_steps is None:
            extractor = CoTExtractor()
            extracted_steps = extractor.extract_cot_steps(response_text)
        
        # Evaluate different quality dimensions
        reasoning_depth = self._evaluate_reasoning_depth(extracted_steps)
        evidence_integration = self._evaluate_evidence_integration(extracted_steps)
        logical_flow = self._evaluate_logical_flow(extracted_steps)
        step_coherence = self._evaluate_step_coherence(extracted_steps)
        
        # Calculate total score
        total_score = (
            self.quality_weights['reasoning_depth'] * reasoning_depth +
            self.quality_weights['evidence_integration'] * evidence_integration +
            self.quality_weights['logical_flow'] * logical_flow +
            self.quality_weights['step_coherence'] * step_coherence
        )
        
        # Determine overall quality
        if total_score >= 0.8:
            overall_quality = CoTQuality.EXCELLENT
        elif total_score >= 0.6:
            overall_quality = CoTQuality.GOOD
        elif total_score >= 0.4:
            overall_quality = CoTQuality.FAIR
        else:
            overall_quality = CoTQuality.POOR
        
        # Update step quality scores
        for step in extracted_steps:
            step.quality_score = self._calculate_step_quality(step)
        
        return CoTAnalysis(
            capability=capability,
            response_text=response_text,
            extracted_steps=extracted_steps,
            overall_quality=overall_quality,
            reasoning_depth=reasoning_depth,
            evidence_integration=evidence_integration,
            logical_flow=logical_flow,
            step_coherence=step_coherence,
            total_score=total_score,
            timestamp=datetime.now().isoformat()
        )
    
    def _evaluate_reasoning_depth(self, steps: List[CoTStep]) -> float:
        """Evaluate the depth of reasoning in CoT steps"""
        if not steps:
            return 0.0
        
        # Calculate average reasoning length and complexity
        reasoning_lengths = [len(step.reasoning.split()) for step in steps]
        avg_length = np.mean(reasoning_lengths)
        
        # Calculate reasoning complexity (number of reasoning indicators)
        complexity_scores = []
        for step in steps:
            complexity = sum(1 for indicator in ['because', 'since', 'therefore', 'thus', 'hence'] 
                           if indicator in step.reasoning.lower())
            complexity_scores.append(complexity)
        
        avg_complexity = np.mean(complexity_scores) if complexity_scores else 0
        
        # Normalize scores (0-1 scale)
        length_score = min(avg_length / 50, 1.0)  # 50 words as target
        complexity_score = min(avg_complexity / 3, 1.0)  # 3 indicators as target
        
        return (length_score + complexity_score) / 2
    
    def _evaluate_evidence_integration(self, steps: List[CoTStep]) -> float:
        """Evaluate how well evidence is integrated into reasoning"""
        if not steps:
            return 0.0
        
        evidence_scores = []
        for step in steps:
            if step.evidence:
                # Evidence quality based on length and specificity
                evidence_quality = min(len(step.evidence.split()) / 20, 1.0)
                evidence_scores.append(evidence_quality)
            else:
                evidence_scores.append(0.0)
        
        return np.mean(evidence_scores)
    
    def _evaluate_logical_flow(self, steps: List[CoTStep]) -> float:
        """Evaluate the logical flow between CoT steps"""
        if len(steps) < 2:
            return 0.5  # Neutral score for single step
        
        # Calculate semantic similarity between consecutive steps
        similarities = []
        for i in range(len(steps) - 1):
            step1_text = steps[i].reasoning
            step2_text = steps[i + 1].reasoning
            
            # Create embeddings
            embeddings = self.sentence_model.encode([step1_text, step2_text])
            similarity = cosine_similarity([embeddings[0]], [embeddings[1]])[0][0]
            similarities.append(similarity)
        
        return np.mean(similarities)
    
    def _evaluate_step_coherence(self, steps: List[CoTStep]) -> float:
        """Evaluate the coherence of individual CoT steps"""
        if not steps:
            return 0.0
        
        coherence_scores = []
        for step in steps:
            # Check for logical connectors and clear structure
            connectors = ['because', 'since', 'therefore', 'thus', 'hence', 'as a result']
            has_connectors = any(connector in step.reasoning.lower() for connector in connectors)
            
            # Check for clear subject-verb-object structure
            has_clear_structure = len(step.reasoning.split()) >= 5
            
            # Check for confidence indicators
            confidence_indicators = ['clearly', 'obviously', 'likely', 'suggests']
            has_confidence = any(indicator in step.reasoning.lower() for indicator in confidence_indicators)
            
            # Calculate coherence score
            coherence = sum([has_connectors, has_clear_structure, has_confidence]) / 3
            coherence_scores.append(coherence)
        
        return np.mean(coherence_scores)
    
    def _calculate_step_quality(self, step: CoTStep) -> float:
        """Calculate quality score for an individual CoT step"""
        # Base score from confidence
        base_score = step.confidence or 0.5
        
        # Bonus for evidence
        evidence_bonus = 0.2 if step.evidence else 0.0
        
        # Bonus for reasoning length
        reasoning_length = len(step.reasoning.split())
        length_bonus = min(reasoning_length / 30, 0.2)  # 30 words as target
        
        return min(base_score + evidence_bonus + length_bonus, 1.0)

class CoTBenchmark:
    """
    Comprehensive benchmark system for evaluating CoT capabilities in AI models.
    
    This class provides standardized evaluation of debating, judging, and feedback
    capabilities using Chain-of-Thought analysis.
    """
    
    def __init__(self, benchmark_dir: str = "cot_benchmarks"):
        """
        Initialize the CoT benchmark system.
        
        Args:
            benchmark_dir: Directory to store benchmark data
        """
        self.benchmark_dir = benchmark_dir
        self.evaluator = CoTEvaluator()
        self.extractor = CoTExtractor()
        
        # Ensure benchmark directory exists
        os.makedirs(benchmark_dir, exist_ok=True)
        
        # Load test cases
        self.test_cases = self._load_test_cases()
    
    def _load_test_cases(self) -> Dict[CoTCapability, List[Dict[str, Any]]]:
        """Load test cases for each capability"""
        test_cases = {
            CoTCapability.DEBATING: [
                {
                    "id": "debate_hr40_pro",
                    "description": "Pro argument for H.R. 40 reparations study",
                    "prompt": "Argue in favor of H.R. 40 - Commission to Study and Develop Reparation Proposals for African-Americans Act. Present exactly 3 main arguments with evidence.",
                    "expected_elements": ["historical context", "economic impact", "social justice", "evidence integration"]
                },
                {
                    "id": "debate_hr40_con",
                    "description": "Con argument against H.R. 40 reparations study",
                    "prompt": "Argue against H.R. 40 - Commission to Study and Develop Reparation Proposals for African-Americans Act. Present exactly 3 main arguments with evidence.",
                    "expected_elements": ["practical concerns", "economic feasibility", "legal issues", "evidence integration"]
                }
            ],
            CoTCapability.JUDGING: [
                {
                    "id": "judge_hr40_debate",
                    "description": "Judge a debate on H.R. 40 reparations study",
                    "prompt": "Evaluate this debate transcript and determine the winner. Provide detailed analysis of argument quality, evidence usage, and rebuttal effectiveness.",
                    "expected_elements": ["argument analysis", "evidence evaluation", "winner determination", "detailed reasoning"]
                }
            ],
            CoTCapability.FEEDBACK: [
                {
                    "id": "feedback_improvement",
                    "description": "Provide feedback for debate improvement",
                    "prompt": "Provide constructive feedback to help improve this debater's performance. Focus on specific areas for improvement with actionable suggestions.",
                    "expected_elements": ["specific feedback", "actionable suggestions", "strength identification", "improvement areas"]
                }
            ]
        }
        
        return test_cases
    
    def run_benchmark(self, 
                     model_name: str, 
                     capability: CoTCapability,
                     test_case_id: str = None) -> List[CoTBenchmarkResult]:
        """
        Run CoT benchmark evaluation for a specific model and capability.
        
        Args:
            model_name: Name of the model to evaluate
            capability: The capability to evaluate
            test_case_id: Specific test case ID (optional)
            
        Returns:
            List of CoTBenchmarkResult objects
        """
        results = []
        
        # Get test cases for the capability
        test_cases = self.test_cases[capability]
        
        # Filter by test case ID if specified
        if test_case_id:
            test_cases = [tc for tc in test_cases if tc['id'] == test_case_id]
        
        for test_case in test_cases:
            logger.info(f"Running benchmark: {test_case['id']} for {model_name}")
            
            # This would integrate with the actual model API
            # For now, we'll simulate the response
            response_text = self._simulate_model_response(test_case, capability)
            
            # Extract CoT steps
            extracted_steps = self.extractor.extract_cot_steps(response_text)
            
            # Evaluate CoT quality
            analysis = self.evaluator.evaluate_cot_quality(
                response_text, capability, extracted_steps
            )
            
            # Calculate performance metrics
            performance_metrics = self._calculate_performance_metrics(analysis, test_case)
            
            # Create benchmark result
            result = CoTBenchmarkResult(
                model_name=model_name,
                capability=capability,
                test_case=test_case['id'],
                analysis=analysis,
                performance_metrics=performance_metrics
            )
            
            results.append(result)
        
        return results
    
    def _simulate_model_response(self, test_case: Dict[str, Any], capability: CoTCapability) -> str:
        """
        Simulate a model response for testing purposes.
        
        In a real implementation, this would call the actual model API.
        """
        if capability == CoTCapability.DEBATING:
            return """
            ### 1. Historical Justice
            First, we must acknowledge that H.R. 40 addresses centuries of systemic discrimination. The bill establishes a commission to study the lasting effects of slavery and Jim Crow laws. This is important because understanding historical context is crucial for addressing current inequalities.
            
            ### 2. Economic Impact
            Second, reparations would have significant economic benefits. Studies show that closing the racial wealth gap would add trillions to the economy. The commission would analyze these economic impacts thoroughly, considering both direct payments and systemic reforms.
            
            ### 3. Social Healing
            Finally, this process would promote national reconciliation. By officially acknowledging past injustices, we can begin healing the wounds that continue to divide our nation. The commission's work would provide a foundation for meaningful dialogue and understanding.
            """
        elif capability == CoTCapability.JUDGING:
            return """
            After carefully analyzing this debate, I will evaluate each side's performance.
            
            First, the Pro side presented strong historical arguments with specific evidence from the bill text. Their economic analysis was well-reasoned and supported by data. However, they could have addressed more counterarguments.
            
            Second, the Con side raised valid practical concerns about implementation costs and legal challenges. Their arguments were logically structured, but they lacked sufficient evidence to support their economic projections.
            
            Therefore, I conclude that the Pro side wins this debate due to superior evidence integration and more comprehensive argumentation, despite the Con side's valid practical concerns.
            """
        else:  # FEEDBACK
            return """
            Here's my feedback for improving your debate performance:
            
            First, your argument structure was clear, but you need to integrate more specific evidence. The bill text provides excellent support for your position - use direct quotes more frequently.
            
            Second, your rebuttals were effective but could be more systematic. Address each of your opponent's arguments point-by-point rather than grouping them together.
            
            Third, your conclusion was strong, but consider adding more weighing analysis. Explain why your arguments outweigh your opponent's concerns.
            
            Overall, you showed good reasoning skills and clear communication. Focus on evidence integration and systematic rebuttals for improvement.
            """
    
    def _calculate_performance_metrics(self, analysis: CoTAnalysis, test_case: Dict[str, Any]) -> Dict[str, float]:
        """Calculate performance metrics for a benchmark result"""
        expected_elements = test_case.get('expected_elements', [])
        
        # Check for expected elements in the response
        element_coverage = 0
        for element in expected_elements:
            if element.lower() in analysis.response_text.lower():
                element_coverage += 1
        
        element_score = element_coverage / len(expected_elements) if expected_elements else 1.0
        
        return {
            'total_score': analysis.total_score,
            'reasoning_depth': analysis.reasoning_depth,
            'evidence_integration': analysis.evidence_integration,
            'logical_flow': analysis.logical_flow,
            'step_coherence': analysis.step_coherence,
            'element_coverage': element_score,
            'step_count': len(analysis.extracted_steps),
            'avg_step_quality': np.mean([step.quality_score for step in analysis.extracted_steps]) if analysis.extracted_steps else 0.0
        }
    
    def compare_models(self, 
                      model_results: Dict[str, List[CoTBenchmarkResult]]) -> Dict[str, Any]:
        """
        Compare CoT performance across different models.
        
        Args:
            model_results: Dictionary mapping model names to their benchmark results
            
        Returns:
            Comparison analysis
        """
        comparison = {
            'models': list(model_results.keys()),
            'capabilities': {},
            'overall_rankings': {}
        }
        
        # Compare by capability
        for capability in CoTCapability:
            capability_results = {}
            
            for model_name, results in model_results.items():
                capability_specific_results = [r for r in results if r.capability == capability]
                
                if capability_specific_results:
                    avg_score = np.mean([r.analysis.total_score for r in capability_specific_results])
                    capability_results[model_name] = avg_score
            
            # Sort by performance
            sorted_models = sorted(capability_results.items(), key=lambda x: x[1], reverse=True)
            comparison['capabilities'][capability.value] = {
                'rankings': sorted_models,
                'scores': capability_results
            }
        
        # Calculate overall rankings
        overall_scores = {}
        for model_name, results in model_results.items():
            overall_scores[model_name] = np.mean([r.analysis.total_score for r in results])
        
        comparison['overall_rankings'] = sorted(overall_scores.items(), key=lambda x: x[1], reverse=True)
        
        return comparison
    
    def save_benchmark_results(self, 
                              results: List[CoTBenchmarkResult], 
                              filename: str = None) -> str:
        """
        Save benchmark results to a JSON file.
        
        Args:
            results: List of benchmark results to save
            filename: Optional filename
            
        Returns:
            Path to saved file
        """
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"cot_benchmark_results_{timestamp}.json"
        
        filepath = os.path.join(self.benchmark_dir, filename)
        
        # Convert results to serializable format
        serializable_results = []
        for result in results:
            result_dict = {
                'model_name': result.model_name,
                'capability': result.capability.value,
                'test_case': result.test_case,
                'analysis': {
                    'capability': result.analysis.capability.value,
                    'overall_quality': result.analysis.overall_quality.value,
                    'reasoning_depth': result.analysis.reasoning_depth,
                    'evidence_integration': result.analysis.evidence_integration,
                    'logical_flow': result.analysis.logical_flow,
                    'step_coherence': result.analysis.step_coherence,
                    'total_score': result.analysis.total_score,
                    'timestamp': result.analysis.timestamp,
                    'extracted_steps': [
                        {
                            'step_number': step.step_number,
                            'description': step.description,
                            'reasoning': step.reasoning,
                            'evidence': step.evidence,
                            'confidence': step.confidence,
                            'quality_score': step.quality_score
                        }
                        for step in result.analysis.extracted_steps
                    ]
                },
                'performance_metrics': result.performance_metrics
            }
            serializable_results.append(result_dict)
        
        # Save to file
        with open(filepath, 'w') as f:
            json.dump(serializable_results, f, indent=2)
        
        logger.info(f"Benchmark results saved to: {filepath}")
        return filepath

# Example usage and testing
if __name__ == "__main__":
    # Initialize CoT benchmark
    benchmark = CoTBenchmark()
    
    # Run benchmark for debating capability
    print("Running CoT benchmark for debating capability...")
    debating_results = benchmark.run_benchmark(
        model_name="gpt-4o-mini",
        capability=CoTCapability.DEBATING
    )
    
    # Run benchmark for judging capability
    print("Running CoT benchmark for judging capability...")
    judging_results = benchmark.run_benchmark(
        model_name="gpt-4o-mini",
        capability=CoTCapability.JUDGING
    )
    
    # Run benchmark for feedback capability
    print("Running CoT benchmark for feedback capability...")
    feedback_results = benchmark.run_benchmark(
        model_name="gpt-4o-mini",
        capability=CoTCapability.FEEDBACK
    )
    
    # Combine all results
    all_results = debating_results + judging_results + feedback_results
    
    # Print results
    for result in all_results:
        print(f"\n{result.capability.value.upper()} - {result.test_case}")
        print(f"Overall Quality: {result.analysis.overall_quality.value}")
        print(f"Total Score: {result.analysis.total_score:.3f}")
        print(f"Reasoning Depth: {result.analysis.reasoning_depth:.3f}")
        print(f"Evidence Integration: {result.analysis.evidence_integration:.3f}")
        print(f"Logical Flow: {result.analysis.logical_flow:.3f}")
        print(f"Step Coherence: {result.analysis.step_coherence:.3f}")
        print(f"Steps Extracted: {len(result.analysis.extracted_steps)}")
    
    # Save results
    filename = benchmark.save_benchmark_results(all_results)
    print(f"\nResults saved to: {filename}")
    
    # Example model comparison
    model_results = {
        "gpt-4o-mini": all_results
    }
    
    comparison = benchmark.compare_models(model_results)
    print(f"\nModel Comparison:")
    print(f"Overall Rankings: {comparison['overall_rankings']}")
