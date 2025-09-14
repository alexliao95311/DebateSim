#!/usr/bin/env python3
"""
Test script to verify reproducibility package functionality
"""

import json
import os
import sys
from pathlib import Path

def test_file_structure():
    """Test that all required files exist"""
    required_files = [
        "README.md",
        "Makefile", 
        "requirements.txt",
        "config.yaml",
        "scripts/drift_analyzer.py",
        "scripts/cot_benchmark.py",
        "scripts/gamestate_manager.py",
        "scripts/reproduce_experiments.py",
        "models/model_config.json",
        "data/hr1_debate_transcript.txt",
        "data/hr40_debate_transcript.txt",
        "docker/Dockerfile"
    ]
    
    missing_files = []
    for file_path in required_files:
        if not Path(file_path).exists():
            missing_files.append(file_path)
    
    if missing_files:
        print("❌ Missing files:")
        for file_path in missing_files:
            print(f"  - {file_path}")
        return False
    else:
        print("✅ All required files present")
        return True

def test_data_files():
    """Test that data files are readable"""
    data_files = [
        "data/hr1_debate_transcript.txt",
        "data/hr40_debate_transcript.txt"
    ]
    
    for file_path in data_files:
        try:
            with open(file_path, 'r') as f:
                content = f.read()
                if len(content) < 100:
                    print(f"❌ {file_path} appears to be empty or too short")
                    return False
        except Exception as e:
            print(f"❌ Error reading {file_path}: {e}")
            return False
    
    print("✅ Data files are readable")
    return True

def test_results_files():
    """Test that results files exist and contain data"""
    results_files = [
        "results/drift_analysis_real.json",
        "results/cot_quality_real.json", 
        "results/model_comparison_real.json"
    ]
    
    for file_path in results_files:
        try:
            with open(file_path, 'r') as f:
                data = json.load(f)
                if not data:
                    print(f"❌ {file_path} is empty")
                    return False
        except Exception as e:
            print(f"❌ Error reading {file_path}: {e}")
            return False
    
    print("✅ Results files contain data")
    return True

def test_scripts_importable():
    """Test that Python scripts can be imported"""
    scripts = [
        "scripts.drift_analyzer",
        "scripts.cot_benchmark", 
        "scripts.gamestate_manager"
    ]
    
    for script in scripts:
        try:
            __import__(script)
        except Exception as e:
            print(f"❌ Error importing {script}: {e}")
            return False
    
    print("✅ All scripts are importable")
    return True

def test_dockerfile():
    """Test that Dockerfile is valid"""
    try:
        with open("docker/Dockerfile", 'r') as f:
            content = f.read()
            if "FROM python:" not in content:
                print("❌ Dockerfile missing Python base image")
                return False
            if "WORKDIR" not in content:
                print("❌ Dockerfile missing WORKDIR")
                return False
    except Exception as e:
        print(f"❌ Error reading Dockerfile: {e}")
        return False
    
    print("✅ Dockerfile is valid")
    return True

def test_makefile():
    """Test that Makefile has required targets"""
    try:
        with open("Makefile", 'r') as f:
            content = f.read()
            required_targets = ["install", "setup", "run-drift", "run-cot", "reproduce", "clean"]
            for target in required_targets:
                if f"{target}:" not in content:
                    print(f"❌ Makefile missing target: {target}")
                    return False
    except Exception as e:
        print(f"❌ Error reading Makefile: {e}")
        return False
    
    print("✅ Makefile has required targets")
    return True

def main():
    """Run all tests"""
    print("Testing reproducibility package...")
    print("=" * 50)
    
    tests = [
        test_file_structure,
        test_data_files,
        test_results_files,
        test_scripts_importable,
        test_dockerfile,
        test_makefile
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
    
    print("=" * 50)
    print(f"Tests passed: {passed}/{total}")
    
    if passed == total:
        print("🎉 All tests passed! Reproducibility package is ready.")
        return True
    else:
        print("❌ Some tests failed. Please fix the issues above.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
