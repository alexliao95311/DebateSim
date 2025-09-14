"""
Ablation Study Framework for AI Debate Models

This module implements a comprehensive ablation study framework for testing different
prompt variations and model configurations in the AI Debate Model & Drift Analysis system.
"""

import json
import os
import itertools
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple, Union
from dataclasses import dataclass, asdict
from enum import Enum
import logging
import numpy as np
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AblationType(Enum):
    """Types of ablation studies"""
    PROMPT_VARIATION = "prompt_variation"
    MODEL_COMPARISON = "model_comparison"
    CONTEXT_MANAGEMENT = "context_management"
    DRIFT_ANALYSIS = "drift_analysis"
    COT_EVALUATION = "cot_evaluation"

class PromptComponent(Enum):
    """Components of prompts that can be ablated"""
    PERSONA_INSTRUCTIONS = "persona_instructions"
    EVIDENCE_REQUIREMENTS = "evidence_requirements"
    STRUCTURAL_REQUIREMENTS = "structural_requirements"
    REBUTTAL_INSTRUCTIONS = "rebuttal_instructions"
    FORMATTING_RULES = "formatting_rules"
    CONTEXT_INJECTION = "context_injection"

@dataclass
class AblationConfig:
    """Configuration for an ablation study"""
    study_id: str
    ablation_type: AblationType
    base_config: Dict[str, Any]
    variations: List[Dict[str, Any]]
    evaluation_metrics: List[str]
    num_runs: int = 3
    description: str = ""

@dataclass
class AblationResult:
    """Result of an ablation study"""
    study_id: str
    variation_id: str
    run_number: int
    metrics: Dict[str, float]
    raw_data: Dict[str, Any]
    timestamp: str

@dataclass
class AblationSummary:
    """Summary of ablation study results"""
    study_id: str
    ablation_type: AblationType
    total_variations: int
    total_runs: int
    results: List[AblationResult]
    statistical_analysis: Dict[str, Any]
    best_variation: str
    worst_variation: str
    timestamp: str

class PromptVariationGenerator:
    """
    Generates variations of prompts for ablation studies.
    
    This class creates systematic variations of debate prompts by modifying
    specific components while keeping others constant.
    """
    
    def __init__(self):
        """Initialize the prompt variation generator"""
        self.base_prompt_components = {
            PromptComponent.PERSONA_INSTRUCTIONS: {
                "full": "You are {persona}, engaged in a structured debate. Adopt their speaking patterns, vocabulary, and rhetorical style.",
                "minimal": "You are {persona}.",
                "none": ""
            },
            PromptComponent.EVIDENCE_REQUIREMENTS: {
                "full": "Support every argument with specific textual evidence from the bill. Quote relevant sections directly.",
                "minimal": "Use evidence to support your arguments.",
                "none": ""
            },
            PromptComponent.STRUCTURAL_REQUIREMENTS: {
                "full": "Present exactly 3 main arguments. Label them clearly as: 1. [Title], 2. [Title], 3. [Title].",
                "minimal": "Present your main arguments clearly.",
                "none": ""
            },
            PromptComponent.REBUTTAL_INSTRUCTIONS: {
                "full": "Address opponent arguments directly and explain why your position is stronger.",
                "minimal": "Respond to your opponent's points.",
                "none": ""
            },
            PromptComponent.FORMATTING_RULES: {
                "full": "Use only level-3 markdown headings (###) for your main points. Keep paragraphs short (≤ 3 sentences).",
                "minimal": "Format your response clearly.",
                "none": ""
            },
            PromptComponent.CONTEXT_INJECTION: {
                "full": "FULL DEBATE TRANSCRIPT SO FAR:\n{full_transcript}",
                "minimal": "Previous context: {context_summary}",
                "none": ""
            }
        }
    
    def generate_prompt_variations(self, 
                                 base_prompt: str, 
                                 components_to_vary: List[PromptComponent],
                                 variation_levels: List[str] = None) -> List[Dict[str, Any]]:
        """
        Generate systematic variations of a prompt.
        
        Args:
            base_prompt: Base prompt template
            components_to_vary: List of components to vary
            variation_levels: Levels of variation (full, minimal, none)
            
        Returns:
            List of prompt variations
        """
        if variation_levels is None:
            variation_levels = ["full", "minimal", "none"]
        
        variations = []
        
        # Generate all combinations of component variations
        component_combinations = list(itertools.product(
            *[variation_levels for _ in components_to_vary]
        ))
        
        for i, combination in enumerate(component_combinations):
            variation = {
                "variation_id": f"var_{i:03d}",
                "description": self._generate_variation_description(components_to_vary, combination),
                "modified_components": {},
                "prompt": base_prompt
            }
            
            # Apply variations to components
            for j, component in enumerate(components_to_vary):
                level = combination[j]
                component_text = self.base_prompt_components[component][level]
                variation["modified_components"][component.value] = {
                    "level": level,
                    "text": component_text
                }
            
            # Generate the actual prompt with variations
            variation["prompt"] = self._apply_variations_to_prompt(
                base_prompt, variation["modified_components"]
            )
            
            variations.append(variation)
        
        return variations
    
    def _generate_variation_description(self, 
                                      components: List[PromptComponent], 
                                      combination: Tuple[str, ...]) -> str:
        """Generate a human-readable description of the variation"""
        descriptions = []
        for i, component in enumerate(components):
            level = combination[i]
            descriptions.append(f"{component.value}: {level}")
        return "; ".join(descriptions)
    
    def _apply_variations_to_prompt(self, 
                                  base_prompt: str, 
                                  modified_components: Dict[str, Dict[str, Any]]) -> str:
        """Apply component variations to the base prompt"""
        # This is a simplified implementation
        # In practice, you would have more sophisticated prompt templating
        prompt = base_prompt
        
        # Replace component placeholders with variations
        for component_name, component_data in modified_components.items():
            placeholder = f"{{{component_name.upper()}}}"
            replacement = component_data["text"]
            prompt = prompt.replace(placeholder, replacement)
        
        return prompt

class ModelComparisonFramework:
    """
    Framework for comparing different models in ablation studies.
    
    This class manages model configurations and generates comparison studies.
    """
    
    def __init__(self):
        """Initialize the model comparison framework"""
        self.available_models = {
            "gpt-4o-mini": {
                "provider": "openai",
                "model_name": "gpt-4o-mini",
                "temperature": 0.7,
                "max_tokens": 2000
            },
            "llama-3.3-70b": {
                "provider": "meta",
                "model_name": "llama-3.3-70b-instruct",
                "temperature": 0.7,
                "max_tokens": 2000
            },
            "gemini-pro": {
                "provider": "google",
                "model_name": "gemini-pro",
                "temperature": 0.7,
                "max_tokens": 2000
            },
            "claude-3.5-sonnet": {
                "provider": "anthropic",
                "model_name": "claude-3.5-sonnet",
                "temperature": 0.7,
                "max_tokens": 2000
            }
        }
    
    def generate_model_variations(self, 
                                models_to_compare: List[str] = None,
                                temperature_variations: List[float] = None) -> List[Dict[str, Any]]:
        """
        Generate model configuration variations.
        
        Args:
            models_to_compare: List of model names to compare
            temperature_variations: List of temperature values to test
            
        Returns:
            List of model configuration variations
        """
        if models_to_compare is None:
            models_to_compare = list(self.available_models.keys())
        
        if temperature_variations is None:
            temperature_variations = [0.3, 0.7, 1.0]
        
        variations = []
        
        for model_name in models_to_compare:
            if model_name not in self.available_models:
                logger.warning(f"Model {model_name} not found in available models")
                continue
            
            base_config = self.available_models[model_name].copy()
            
            for temp in temperature_variations:
                variation = {
                    "variation_id": f"{model_name}_temp_{temp}",
                    "model_name": model_name,
                    "config": base_config.copy(),
                    "description": f"{model_name} with temperature {temp}"
                }
                variation["config"]["temperature"] = temp
                variations.append(variation)
        
        return variations

class AblationStudyManager:
    """
    Main manager for conducting ablation studies.
    
    This class orchestrates the execution of ablation studies, manages
    configurations, and analyzes results.
    """
    
    def __init__(self, results_dir: str = "stanfordpaper/ablation_results"):
        """
        Initialize the ablation study manager.
        
        Args:
            results_dir: Directory to store ablation study results
        """
        self.results_dir = Path(results_dir)
        self.results_dir.mkdir(parents=True, exist_ok=True)
        
        self.prompt_generator = PromptVariationGenerator()
        self.model_framework = ModelComparisonFramework()
        
        self.active_studies: Dict[str, AblationConfig] = {}
        self.completed_studies: Dict[str, AblationSummary] = {}
    
    def create_prompt_ablation_study(self, 
                                   study_id: str,
                                   base_prompt: str,
                                   components_to_vary: List[PromptComponent],
                                   evaluation_metrics: List[str],
                                   num_runs: int = 3,
                                   description: str = "") -> AblationConfig:
        """
        Create a prompt variation ablation study.
        
        Args:
            study_id: Unique identifier for the study
            base_prompt: Base prompt to vary
            components_to_vary: Components to systematically vary
            evaluation_metrics: Metrics to evaluate
            num_runs: Number of runs per variation
            description: Study description
            
        Returns:
            AblationConfig object
        """
        variations = self.prompt_generator.generate_prompt_variations(
            base_prompt, components_to_vary
        )
        
        config = AblationConfig(
            study_id=study_id,
            ablation_type=AblationType.PROMPT_VARIATION,
            base_config={"base_prompt": base_prompt},
            variations=variations,
            evaluation_metrics=evaluation_metrics,
            num_runs=num_runs,
            description=description
        )
        
        self.active_studies[study_id] = config
        logger.info(f"Created prompt ablation study: {study_id}")
        return config
    
    def create_model_ablation_study(self, 
                                  study_id: str,
                                  models_to_compare: List[str],
                                  evaluation_metrics: List[str],
                                  num_runs: int = 3,
                                  description: str = "") -> AblationConfig:
        """
        Create a model comparison ablation study.
        
        Args:
            study_id: Unique identifier for the study
            models_to_compare: Models to compare
            evaluation_metrics: Metrics to evaluate
            num_runs: Number of runs per variation
            description: Study description
            
        Returns:
            AblationConfig object
        """
        variations = self.model_framework.generate_model_variations(models_to_compare)
        
        config = AblationConfig(
            study_id=study_id,
            ablation_type=AblationType.MODEL_COMPARISON,
            base_config={"models": models_to_compare},
            variations=variations,
            evaluation_metrics=evaluation_metrics,
            num_runs=num_runs,
            description=description
        )
        
        self.active_studies[study_id] = config
        logger.info(f"Created model ablation study: {study_id}")
        return config
    
    def run_ablation_study(self, 
                          study_id: str,
                          integration_callback: callable = None) -> AblationSummary:
        """
        Run an ablation study.
        
        Args:
            study_id: Study identifier
            integration_callback: Callback function to integrate with existing systems
            
        Returns:
            AblationSummary with results
        """
        if study_id not in self.active_studies:
            raise ValueError(f"Study {study_id} not found")
        
        config = self.active_studies[study_id]
        results = []
        
        logger.info(f"Running ablation study: {study_id}")
        
        for variation in config.variations:
            for run_num in range(config.num_runs):
                logger.info(f"Running variation {variation['variation_id']}, run {run_num + 1}")
                
                # Simulate or run actual experiment
                if integration_callback:
                    metrics, raw_data = integration_callback(variation, run_num)
                else:
                    metrics, raw_data = self._simulate_experiment(variation, run_num)
                
                result = AblationResult(
                    study_id=study_id,
                    variation_id=variation["variation_id"],
                    run_number=run_num + 1,
                    metrics=metrics,
                    raw_data=raw_data,
                    timestamp=datetime.now().isoformat()
                )
                results.append(result)
        
        # Analyze results
        summary = self._analyze_results(config, results)
        
        # Save results
        self._save_study_results(summary)
        
        # Move to completed studies
        self.completed_studies[study_id] = summary
        del self.active_studies[study_id]
        
        logger.info(f"Completed ablation study: {study_id}")
        return summary
    
    def _simulate_experiment(self, variation: Dict[str, Any], run_num: int) -> Tuple[Dict[str, float], Dict[str, Any]]:
        """Simulate an experiment for testing purposes"""
        # Simulate metrics based on variation characteristics
        base_score = 0.7
        
        # Add some variation based on the variation ID
        variation_factor = hash(variation["variation_id"]) % 100 / 1000
        run_factor = (run_num - 1) * 0.05
        
        metrics = {
            "overall_score": base_score + variation_factor + run_factor,
            "response_time": 15.0 + variation_factor * 10,
            "memory_usage": 50.0 + variation_factor * 20,
            "drift_score": 0.2 + variation_factor * 0.1,
            "cot_quality": 0.75 + variation_factor * 0.1
        }
        
        raw_data = {
            "variation": variation,
            "run_number": run_num,
            "simulated": True
        }
        
        return metrics, raw_data
    
    def _analyze_results(self, config: AblationConfig, results: List[AblationResult]) -> AblationSummary:
        """Analyze ablation study results"""
        # Group results by variation
        variation_results = {}
        for result in results:
            if result.variation_id not in variation_results:
                variation_results[result.variation_id] = []
            variation_results[result.variation_id].append(result)
        
        # Calculate statistics for each variation
        statistical_analysis = {}
        for variation_id, var_results in variation_results.items():
            metrics_by_variation = {}
            for metric in config.evaluation_metrics:
                values = [r.metrics.get(metric, 0) for r in var_results]
                metrics_by_variation[metric] = {
                    "mean": np.mean(values),
                    "std": np.std(values),
                    "min": np.min(values),
                    "max": np.max(values),
                    "values": values
                }
            statistical_analysis[variation_id] = metrics_by_variation
        
        # Find best and worst variations
        overall_scores = {}
        for variation_id, stats in statistical_analysis.items():
            if "overall_score" in stats:
                overall_scores[variation_id] = stats["overall_score"]["mean"]
            else:
                # Use first available metric as overall score
                first_metric = list(stats.keys())[0]
                overall_scores[variation_id] = stats[first_metric]["mean"]
        
        best_variation = max(overall_scores, key=overall_scores.get)
        worst_variation = min(overall_scores, key=overall_scores.get)
        
        return AblationSummary(
            study_id=config.study_id,
            ablation_type=config.ablation_type,
            total_variations=len(config.variations),
            total_runs=len(results),
            results=results,
            statistical_analysis=statistical_analysis,
            best_variation=best_variation,
            worst_variation=worst_variation,
            timestamp=datetime.now().isoformat()
        )
    
    def _save_study_results(self, summary: AblationSummary):
        """Save ablation study results to file"""
        filename = f"ablation_study_{summary.study_id}_{summary.timestamp[:10]}.json"
        filepath = self.results_dir / filename
        
        # Convert to serializable format
        serializable_summary = {
            "study_id": summary.study_id,
            "ablation_type": summary.ablation_type.value,
            "total_variations": summary.total_variations,
            "total_runs": summary.total_runs,
            "statistical_analysis": summary.statistical_analysis,
            "best_variation": summary.best_variation,
            "worst_variation": summary.worst_variation,
            "timestamp": summary.timestamp,
            "results": [
                {
                    "variation_id": r.variation_id,
                    "run_number": r.run_number,
                    "metrics": r.metrics,
                    "timestamp": r.timestamp
                }
                for r in summary.results
            ]
        }
        
        with open(filepath, 'w') as f:
            json.dump(serializable_summary, f, indent=2)
        
        logger.info(f"Saved ablation study results to: {filepath}")
    
    def load_study_results(self, study_id: str) -> Optional[AblationSummary]:
        """Load ablation study results from file"""
        # Find the most recent file for this study
        pattern = f"ablation_study_{study_id}_*.json"
        matching_files = list(self.results_dir.glob(pattern))
        
        if not matching_files:
            logger.warning(f"No results found for study: {study_id}")
            return None
        
        # Load the most recent file
        latest_file = max(matching_files, key=lambda f: f.stat().st_mtime)
        
        with open(latest_file, 'r') as f:
            data = json.load(f)
        
        # Reconstruct AblationSummary object
        results = []
        for result_data in data["results"]:
            result = AblationResult(
                study_id=result_data["study_id"],
                variation_id=result_data["variation_id"],
                run_number=result_data["run_number"],
                metrics=result_data["metrics"],
                raw_data={},  # Not saved in simplified format
                timestamp=result_data["timestamp"]
            )
            results.append(result)
        
        summary = AblationSummary(
            study_id=data["study_id"],
            ablation_type=AblationType(data["ablation_type"]),
            total_variations=data["total_variations"],
            total_runs=data["total_runs"],
            results=results,
            statistical_analysis=data["statistical_analysis"],
            best_variation=data["best_variation"],
            worst_variation=data["worst_variation"],
            timestamp=data["timestamp"]
        )
        
        return summary
    
    def compare_studies(self, study_ids: List[str]) -> Dict[str, Any]:
        """Compare multiple ablation studies"""
        studies = {}
        for study_id in study_ids:
            summary = self.load_study_results(study_id)
            if summary:
                studies[study_id] = summary
        
        if not studies:
            return {"error": "No studies found"}
        
        comparison = {
            "studies_compared": list(studies.keys()),
            "comparison_metrics": {},
            "rankings": {}
        }
        
        # Compare overall scores
        overall_scores = {}
        for study_id, summary in studies.items():
            if summary.best_variation in summary.statistical_analysis:
                stats = summary.statistical_analysis[summary.best_variation]
                if "overall_score" in stats:
                    overall_scores[study_id] = stats["overall_score"]["mean"]
        
        if overall_scores:
            sorted_studies = sorted(overall_scores.items(), key=lambda x: x[1], reverse=True)
            comparison["rankings"]["overall_score"] = sorted_studies
        
        return comparison
    
    def print_study_summary(self, study_id: str):
        """Print a summary of an ablation study"""
        summary = self.load_study_results(study_id)
        if not summary:
            print(f"No results found for study: {study_id}")
            return
        
        print(f"\n{'='*60}")
        print(f"ABLATION STUDY SUMMARY: {study_id}")
        print(f"{'='*60}")
        
        print(f"Type: {summary.ablation_type.value}")
        print(f"Total Variations: {summary.total_variations}")
        print(f"Total Runs: {summary.total_runs}")
        print(f"Best Variation: {summary.best_variation}")
        print(f"Worst Variation: {summary.worst_variation}")
        print(f"Completed: {summary.timestamp}")
        
        print(f"\nStatistical Analysis:")
        for variation_id, stats in summary.statistical_analysis.items():
            print(f"\n  {variation_id}:")
            for metric, values in stats.items():
                print(f"    {metric}: {values['mean']:.3f} ± {values['std']:.3f}")
        
        print("="*60)

# Example usage and testing

    def call_real_ai_model(self, model_config: Dict[str, Any], prompt: str) -> Dict[str, Any]:
        """Call real AI model and return response with metrics"""
        start_time = time.time()
        
        try:
            # Prepare request data
            request_data = {
                "prompt": prompt,
                "model": model_config["model_name"],
                "temperature": model_config.get("temperature", 0.7),
                "max_tokens": model_config.get("max_tokens", 2000)
            }
            
            # Call the DebateSim API
            response = requests.post(
                "http://localhost:8000/generate-response",
                json=request_data,
                timeout=120
            )
            
            end_time = time.time()
            response_time = end_time - start_time
            
            if response.status_code == 200:
                response_data = response.json()
                ai_text = response_data.get('response', '')
                
                # Calculate metrics
                word_count = len(ai_text.split())
                char_count = len(ai_text)
                
                return {
                    "response": ai_text,
                    "response_time": response_time,
                    "word_count": word_count,
                    "char_count": char_count,
                    "status": "success"
                }
            else:
                return {
                    "response": "",
                    "response_time": response_time,
                    "word_count": 0,
                    "char_count": 0,
                    "status": "error",
                    "error": f"HTTP {response.status_code}"
                }
                
        except Exception as e:
            end_time = time.time()
            return {
                "response": "",
                "response_time": end_time - start_time,
                "word_count": 0,
                "char_count": 0,
                "status": "error",
                "error": str(e)
            }
    
    def run_real_ablation_study(self, study_id: str) -> AblationSummary:
        """Run ablation study with real AI model calls"""
        if study_id not in self.active_studies:
            raise ValueError(f"Study {study_id} not found")
        
        config = self.active_studies[study_id]
        results = []
        
        print(f"Running REAL ablation study: {study_id}")
        print(f"Total variations: {len(config.variations)}")
        
        for i, variation in enumerate(config.variations):
            print(f"Processing variation {i+1}/{len(config.variations)}: {variation['variation_id']}")
            
            for run_num in range(config.num_runs):
                print(f"  Run {run_num + 1}/{config.num_runs}")
                
                # Create test prompt based on variation
                if config.ablation_type == AblationType.PROMPT_VARIATION:
                    test_prompt = variation.get('prompt', 'Test prompt for debate analysis')
                else:  # MODEL_COMPARISON
                    test_prompt = "Present a structured argument for H.R. 40 reparations study with evidence and reasoning."
                
                # Call real AI model
                model_config = variation.get('config', {})
                real_result = self.call_real_ai_model(model_config, test_prompt)
                
                # Calculate performance metrics
                metrics = {
                    "overall_score": min(real_result["word_count"] / 1000, 1.0),  # Normalize word count
                    "response_time": real_result["response_time"],
                    "memory_usage": 50.0 + (real_result["word_count"] * 0.01),  # Estimate memory
                    "drift_score": 0.1 + (real_result["response_time"] * 0.01),  # Estimate drift
                    "cot_quality": min(real_result["word_count"] / 500, 1.0)  # Estimate CoT quality
                }
                
                # Add word count and character count
                metrics["word_count"] = real_result["word_count"]
                metrics["char_count"] = real_result["char_count"]
                
                result = AblationResult(
                    study_id=study_id,
                    variation_id=variation["variation_id"],
                    run_number=run_num + 1,
                    metrics=metrics,
                    raw_data={
                        "real_response": real_result["response"][:200] + "..." if len(real_result["response"]) > 200 else real_result["response"],
                        "status": real_result["status"],
                        "error": real_result.get("error", None)
                    },
                    timestamp=time.strftime("%Y-%m-%dT%H:%M:%S")
                )
                results.append(result)
                
                # Small delay to avoid rate limiting
                time.sleep(1)
        
        # Analyze results
        summary = self._analyze_results(config, results)
        
        # Save results
        self._save_study_results(summary)
        
        # Move to completed studies
        self.completed_studies[study_id] = summary
        del self.active_studies[study_id]
        
        print(f"✅ Completed REAL ablation study: {study_id}")
        return summary


if __name__ == "__main__":
    # Initialize ablation study manager
    manager = AblationStudyManager()
    
    print("🚀 Starting REAL ablation studies with actual AI model calls...")
    print("⚠️  Make sure the DebateSim API is running on localhost:8000")
    
    # Create a prompt variation study
    base_prompt = """
    You are engaged in a structured debate on H.R. 40 - Commission to Study and Develop Reparation Proposals for African-Americans Act.
    
    Present exactly 3 main arguments with evidence from the bill text. Use direct quotes and specific section references.
    Structure your response clearly with numbered points and logical reasoning.
    """
    
    components_to_vary = [
        PromptComponent.PERSONA_INSTRUCTIONS,
        PromptComponent.EVIDENCE_REQUIREMENTS,
        PromptComponent.STRUCTURAL_REQUIREMENTS
    ]
    
    evaluation_metrics = [
        "overall_score",
        "response_time",
        "memory_usage",
        "drift_score",
        "cot_quality",
        "word_count",
        "char_count"
    ]
    
    prompt_study = manager.create_prompt_ablation_study(
        study_id="real_prompt_variation_001",
        base_prompt=base_prompt,
        components_to_vary=components_to_vary,
        evaluation_metrics=evaluation_metrics,
        num_runs=2,  # Reduced for real API calls
        description="REAL ablation study of prompt components using actual AI model calls"
    )
    
    # Create a model comparison study
    model_study = manager.create_model_ablation_study(
        study_id="real_model_comparison_001",
        models_to_compare=["gpt-4o-mini"],  # Start with one model for testing
        evaluation_metrics=evaluation_metrics,
        num_runs=2,  # Reduced for real API calls
        description="REAL comparison of different models using actual API calls"
    )
    
    # Run the studies with real AI calls
    try:
        print("
🔄 Running REAL prompt variation study...")
        prompt_results = manager.run_real_ablation_study("real_prompt_variation_001")
        
        print("
🔄 Running REAL model comparison study...")
        model_results = manager.run_real_ablation_study("real_model_comparison_001")
        
        # Print summaries
        print("
" + "="*60)
        print("REAL ABLATION STUDY RESULTS")
        print("="*60)
        
        manager.print_study_summary("real_prompt_variation_001")
        manager.print_study_summary("real_model_comparison_001")
        
    except Exception as e:
        print(f"❌ Error running real ablation studies: {e}")
        print("💡 Make sure the DebateSim API is running: python main.py")
