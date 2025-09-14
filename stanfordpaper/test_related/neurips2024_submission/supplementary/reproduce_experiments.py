#!/usr/bin/env python3
"""
Reproduction script for Chain-of-Thought Evaluation and Drift Analysis for Multi-Agent AI Debate Systems

This script reproduces the main experimental results from the paper by running:
1. Drift analysis on real AI responses
2. CoT evaluation benchmarks
3. Gamestate management demonstrations
4. Performance analysis

Usage:
    python reproduce_experiments.py [--output-dir OUTPUT_DIR] [--verbose]
"""

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path

# Add current directory to path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from drift_analyzer import DriftAnalyzer
from cot_benchmark import CoTBenchmark, CoTCapability
from gamestate_manager import GamestateManager, DebateTopic, DebaterConfig, JudgeConfig, DebateFormat

def load_model_config():
    """Load model configuration from JSON file"""
    config_path = Path(__file__).parent / "model_config.json"
    with open(config_path, 'r') as f:
        return json.load(f)

def run_drift_analysis(output_dir: Path, verbose: bool = False):
    """Run drift analysis on real AI responses"""
    print("Running drift analysis...")
    
    # Initialize drift analyzer
    analyzer = DriftAnalyzer()
    
    # Run analysis on real responses
    drift_results = analyzer.run_real_drift_analysis()
    
    if drift_results:
        # Save results
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"drift_analysis_reproduction_{timestamp}.json"
        filepath = output_dir / filename
        analyzer.save_drift_analysis(str(filepath))
        
        # Calculate and print summary
        avg_drift = sum(r.overall_drift_score for r in drift_results) / len(drift_results)
        print(f"Average drift score: {avg_drift:.3f}")
        
        if verbose:
            for i, result in enumerate(drift_results, 1):
                print(f"Response {i} -> {i+1}: Drift Score = {result.overall_drift_score:.3f}")
        
        return filepath
    else:
        print("Failed to run drift analysis")
        return None

def run_cot_benchmarks(output_dir: Path, verbose: bool = False):
    """Run Chain-of-Thought evaluation benchmarks"""
    print("Running CoT benchmarks...")
    
    # Initialize benchmark
    benchmark = CoTBenchmark(str(output_dir / "cot_benchmarks"))
    
    # Run benchmarks for all capabilities
    all_results = []
    
    for capability in CoTCapability:
        print(f"Running {capability.value} benchmark...")
        results = benchmark.run_benchmark(
            model_name="gpt-4o-mini",
            capability=capability
        )
        all_results.extend(results)
        
        if verbose:
            for result in results:
                print(f"  {result.capability.value}: {result.analysis.total_score:.3f}")
    
    # Save all results
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"cot_benchmark_reproduction_{timestamp}.json"
    filepath = benchmark.save_benchmark_results(all_results, filename)
    
    print(f"CoT benchmark results saved to: {filepath}")
    return filepath

def run_gamestate_demo(output_dir: Path, verbose: bool = False):
    """Run gamestate management demonstration"""
    print("Running gamestate management demo...")
    
    # Initialize gamestate manager
    manager = GamestateManager(str(output_dir / "gamestates"))
    
    # Create debate topic
    topic = DebateTopic(
        title="H.R. 40 - Commission to Study and Develop Reparation Proposals for African-Americans Act",
        description="This bill establishes a commission to study and develop reparation proposals for African-Americans.",
        bill_text="[Bill text would go here]",
        bill_id="HR40-119",
        evidence_requirements=[
            "Direct quotes from bill text",
            "Historical context",
            "Economic impact data"
        ]
    )
    
    # Create debater configurations
    pro_config = DebaterConfig(
        role="pro",
        persona="Kamala Harris",
        model="openai/gpt-4o-mini",
        temperature=0.7
    )
    
    con_config = DebaterConfig(
        role="con",
        persona="Donald Trump",
        model="openai/gpt-4o-mini",
        temperature=0.8
    )
    
    # Create judge configuration
    judge_config = JudgeConfig(
        model="openai/gpt-4o-mini",
        temperature=0.5,
        evaluation_criteria=[
            "Argument quality and logic",
            "Evidence usage and accuracy",
            "Rebuttal effectiveness",
            "Overall persuasiveness"
        ]
    )
    
    # Create gamestate
    gamestate = manager.create_gamestate(
        topic=topic,
        debate_format=DebateFormat.STANDARD,
        pro_config=pro_config,
        con_config=con_config,
        judge_config=judge_config,
        created_by="reproduction_script"
    )
    
    # Simulate a few rounds
    for round_num in range(1, 4):
        round_data = {
            "round_num": round_num,
            "debater": "pro" if round_num % 2 == 1 else "con",
            "prompt": topic.title,
            "speech_type": "constructive" if round_num == 1 else "rebuttal"
        }
        
        # Simulate response
        response = f"### Round {round_num} Response\nThis is a simulated response for round {round_num}..."
        
        # Update gamestate
        manager.update_gamestate(
            round_data=round_data,
            response=response,
            response_time=15.3,
            metrics={"word_count": 150, "argument_count": 3}
        )
        
        if verbose:
            print(f"  Completed round {round_num}")
    
    # Save gamestate
    filepath = manager.save_gamestate()
    print(f"Gamestate saved to: {filepath}")
    
    return filepath

def generate_summary_report(output_dir: Path, drift_file: str, cot_file: str, gamestate_file: str):
    """Generate a summary report of all experiments"""
    print("Generating summary report...")
    
    # Load model config
    config = load_model_config()
    
    # Create summary report
    report = {
        "reproduction_info": {
            "timestamp": datetime.now().isoformat(),
            "script_version": "1.0.0",
            "output_directory": str(output_dir)
        },
        "model_configuration": config,
        "experiments_run": {
            "drift_analysis": {
                "file": drift_file,
                "status": "completed" if drift_file else "failed"
            },
            "cot_benchmarks": {
                "file": cot_file,
                "status": "completed" if cot_file else "failed"
            },
            "gamestate_demo": {
                "file": gamestate_file,
                "status": "completed" if gamestate_file else "failed"
            }
        },
        "reproduction_instructions": {
            "setup": [
                "1. Install dependencies: pip install -r requirements.txt",
                "2. Set up API keys for OpenAI, Anthropic, Google, and Meta",
                "3. Run: python reproduce_experiments.py"
            ],
            "expected_outputs": [
                "Drift analysis results showing semantic distance and token variation",
                "CoT benchmark results for debating, judging, and feedback capabilities",
                "Gamestate management demonstration with debate simulation"
            ]
        }
    }
    
    # Save report
    report_file = output_dir / "reproduction_report.json"
    with open(report_file, 'w') as f:
        json.dump(report, f, indent=2)
    
    print(f"Summary report saved to: {report_file}")
    return report_file

def main():
    parser = argparse.ArgumentParser(description="Reproduce experiments from the paper")
    parser.add_argument("--output-dir", default="./outputs", help="Output directory for results")
    parser.add_argument("--verbose", action="store_true", help="Enable verbose output")
    
    args = parser.parse_args()
    
    # Create output directory
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print("="*60)
    print("REPRODUCING EXPERIMENTS")
    print("Chain-of-Thought Evaluation and Drift Analysis for Multi-Agent AI Debate Systems")
    print("="*60)
    
    # Run experiments
    drift_file = run_drift_analysis(output_dir, args.verbose)
    cot_file = run_cot_benchmarks(output_dir, args.verbose)
    gamestate_file = run_gamestate_demo(output_dir, args.verbose)
    
    # Generate summary report
    report_file = generate_summary_report(output_dir, drift_file, cot_file, gamestate_file)
    
    print("\n" + "="*60)
    print("REPRODUCTION COMPLETE")
    print("="*60)
    print(f"Results saved to: {output_dir}")
    print(f"Summary report: {report_file}")
    
    if args.verbose:
        print("\nFiles generated:")
        for file in output_dir.rglob("*.json"):
            print(f"  - {file}")

if __name__ == "__main__":
    main()
