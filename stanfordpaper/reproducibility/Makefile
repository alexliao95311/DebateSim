# Makefile for reproducing DebateSim experiments
# Usage: make reproduce

.PHONY: help install setup data run-drift run-cot run-gamestate run-all clean

# Default target
help:
	@echo "Available targets:"
	@echo "  install     - Install dependencies"
	@echo "  setup       - Setup environment and data"
	@echo "  run-drift   - Run drift analysis experiments"
	@echo "  run-cot     - Run Chain-of-Thought evaluation"
	@echo "  run-gamestate - Run gamestate management tests"
	@echo "  run-all     - Run all experiments"
	@echo "  reproduce   - Complete reproduction pipeline"
	@echo "  clean       - Clean generated files"

# Install dependencies
install:
	pip install -r models/requirements.txt

# Setup environment
setup: install
	mkdir -p results
	@echo "Environment setup complete"

# Run drift analysis
run-drift: setup
	python scripts/drift_analyzer.py \
		--input data/hr1_debate_transcript.txt \
		--output results/drift_analysis_hr1.json
	python scripts/drift_analyzer.py \
		--input data/hr40_debate_transcript.txt \
		--output results/drift_analysis_hr40.json

# Run CoT evaluation
run-cot: setup
	python scripts/cot_benchmark.py \
		--model gpt-4o-mini \
		--temperature 0.7 \
		--output results/cot_benchmark_results.json

# Run gamestate management
run-gamestate: setup
	python scripts/gamestate_manager.py \
		--session-id test_session \
		--topic hr1

# Run all experiments
run-all: run-drift run-cot run-gamestate
	@echo "All experiments completed"

# Complete reproduction pipeline
reproduce: setup run-all
	@echo "Reproduction pipeline completed successfully"
	@echo "Results available in results/ directory"

# Clean generated files
clean:
	rm -rf results/*.json
	rm -rf __pycache__/
	rm -rf .pytest_cache/
	@echo "Cleanup complete"
