#!/usr/bin/env python3
"""
Validation script to verify that reproduced results match paper tables
"""

import json
import sys
from pathlib import Path

def load_json_file(filepath):
    """Load JSON file safely"""
    try:
        with open(filepath, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"❌ Error loading {filepath}: {e}")
        return None

def validate_drift_results():
    """Validate drift analysis results match Table 1"""
    print("Validating drift analysis results...")
    
    # Expected values from paper Table 1 (round-by-round)
    expected = [
        {"round": 1, "semantic": 0.241, "token": 0.638, "structure": 0.156, "evidence": 0.203, "overall": 0.309},
        {"round": 2, "semantic": 0.264, "token": 0.684, "structure": 0.212, "evidence": 0.250, "overall": 0.353},
        {"round": 3, "semantic": 0.296, "token": 0.718, "structure": 0.244, "evidence": 0.339, "overall": 0.399},
        {"round": 4, "semantic": 0.319, "token": 0.733, "structure": 0.284, "evidence": 0.416, "overall": 0.438},
        {"round": 5, "semantic": 0.337, "token": 0.774, "structure": 0.362, "evidence": 0.534, "overall": 0.502}
    ]
    
    data = load_json_file("results/drift_analysis_real.json")
    if not data:
        return False
    
    # Check if data structure matches expected
    if not isinstance(data, list) or len(data) < 5:
        print("❌ Drift data structure incorrect")
        return False
    
    # Validate each round
    for i, expected_round in enumerate(expected):
        if i < len(data):
            actual_round = data[i]
            for key in expected_round:
                if key in actual_round:
                    actual = actual_round[key]
                    expected_val = expected_round[key]
                    if abs(actual - expected_val) > 0.01:  # Allow small tolerance
                        print(f"❌ Round {i+1} {key}: expected {expected_val}, got {actual}")
                        return False
        else:
            print(f"❌ Missing round {i+1}")
            return False
    
    print("✅ Drift analysis results match paper Table 1")
    return True

def validate_cot_results():
    """Validate CoT quality results match Table 2"""
    print("Validating CoT quality results...")
    
    # Expected values from paper Table 2
    expected = {
        "debating_pro": {"reasoning_depth": 0.314, "evidence_integration": 0.655, "logical_flow": 0.478, "overall_score": 0.482},
        "debating_con": {"reasoning_depth": 0.252, "evidence_integration": 0.847, "logical_flow": 0.518, "overall_score": 0.539},
        "judging": {"reasoning_depth": 0.289, "evidence_integration": 0.167, "logical_flow": 0.542, "overall_score": 0.333},
        "feedback": {"reasoning_depth": 0.183, "evidence_integration": 0.144, "logical_flow": 0.501, "overall_score": 0.276}
    }
    
    data = load_json_file("results/cot_quality_real.json")
    if not data:
        return False
    
    # Validate each capability
    for capability, expected_vals in expected.items():
        if capability in data:
            actual_vals = data[capability]
            for key in expected_vals:
                if key in actual_vals:
                    actual = actual_vals[key]
                    expected_val = expected_vals[key]
                    if abs(actual - expected_val) > 0.01:  # Allow small tolerance
                        print(f"❌ {capability} {key}: expected {expected_val}, got {actual}")
                        return False
        else:
            print(f"❌ Missing capability: {capability}")
            return False
    
    print("✅ CoT quality results match paper Table 2")
    return True

def validate_model_comparison():
    """Validate model comparison results match Table 4"""
    print("Validating model comparison results...")
    
    # Expected values from paper Table 4
    expected = [
        {"model": "GPT-4o-mini", "temperature": 0.3, "overall_score": 0.717, "response_time": 15.23},
        {"model": "GPT-4o-mini", "temperature": 0.7, "overall_score": 0.722, "response_time": 15.23},
        {"model": "GPT-4o-mini", "temperature": 1.0, "overall_score": 0.737, "response_time": 15.26},
        {"model": "Gemini Pro", "temperature": 0.3, "overall_score": 0.753, "response_time": 15.49},
        {"model": "Gemini Pro", "temperature": 0.7, "overall_score": 0.758, "response_time": 15.47},
        {"model": "Gemini Pro", "temperature": 1.0, "overall_score": 0.755, "response_time": 15.53}
    ]
    
    data = load_json_file("results/model_comparison_real.json")
    if not data:
        return False
    
    # Validate each model configuration
    for i, expected_config in enumerate(expected):
        if i < len(data):
            actual_config = data[i]
            for key in expected_config:
                if key in actual_config:
                    actual = actual_config[key]
                    expected_val = expected_config[key]
                    # Handle string comparison for model names
                    if key == "model":
                        if actual != expected_val:
                            print(f"❌ Config {i} {key}: expected {expected_val}, got {actual}")
                            return False
                    else:
                        # Handle numeric comparison
                        if isinstance(actual, (int, float)) and isinstance(expected_val, (int, float)):
                            if abs(actual - expected_val) > 0.01:  # Allow small tolerance
                                print(f"❌ Config {i} {key}: expected {expected_val}, got {actual}")
                                return False
                        else:
                            print(f"❌ Config {i} {key}: type mismatch - expected {type(expected_val)}, got {type(actual)}")
                            return False
        else:
            print(f"❌ Missing configuration {i}")
            return False
    
    print("✅ Model comparison results match paper Table 4")
    return True

def main():
    """Run all validation tests"""
    print("Validating reproduced results against paper tables...")
    print("=" * 60)
    
    tests = [
        validate_drift_results,
        validate_cot_results,
        validate_model_comparison
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        try:
            if test():
                passed += 1
            print()
        except Exception as e:
            print(f"❌ Test {test.__name__} failed with exception: {e}")
            print()
    
    print("=" * 60)
    print(f"Validation tests passed: {passed}/{total}")
    
    if passed == total:
        print("🎉 All results match paper tables! Reproducibility verified.")
        return True
    else:
        print("❌ Some results don't match paper tables. Please check the data.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
