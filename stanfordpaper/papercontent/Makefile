# Makefile for reproducing experiments from the paper
# Chain-of-Thought Evaluation and Drift Analysis for Multi-Agent AI Debate Systems

.PHONY: help install reproduce clean docker-build docker-run test

# Default target
help:
	@echo "Available targets:"
	@echo "  install      - Install Python dependencies"
	@echo "  reproduce    - Run all experiments to reproduce paper results"
	@echo "  clean        - Clean output files and temporary data"
	@echo "  docker-build - Build Docker container for reproduction"
	@echo "  docker-run   - Run experiments in Docker container"
	@echo "  test         - Run basic tests to verify setup"

# Install dependencies
install:
	pip install -r requirements.txt

# Reproduce all experiments
reproduce: install
	python reproduce_experiments.py --output-dir ./outputs --verbose

# Clean output files
clean:
	rm -rf ./outputs
	rm -rf ./cot_benchmarks
	rm -rf ./gamestates
	rm -rf __pycache__
	rm -f *.pyc

# Build Docker container
docker-build:
	docker build -t debatesim-reproduction .

# Run experiments in Docker
docker-run: docker-build
	docker run -v $(PWD)/outputs:/app/outputs debatesim-reproduction

# Run basic tests
test:
	python -c "import drift_analyzer; print('Drift analyzer: OK')"
	python -c "import cot_benchmark; print('CoT benchmark: OK')"
	python -c "import gamestate_manager; print('Gamestate manager: OK')"
	python -c "import json; json.load(open('model_config.json')); print('Model config: OK')"
	@echo "All tests passed!"

# Quick reproduction (minimal output)
quick-reproduce: install
	python reproduce_experiments.py --output-dir ./outputs

# Generate paper tables and figures
generate-figures: reproduce
	python generate_paper_figures.py --input-dir ./outputs --output-dir ./figures

# Validate reproduction results
validate: reproduce
	python validate_reproduction.py --output-dir ./outputs
