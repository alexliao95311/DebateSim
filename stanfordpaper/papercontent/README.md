# Reproduction Package: Chain-of-Thought Evaluation and Drift Analysis for Multi-Agent AI Debate Systems

This package contains all artifacts necessary to reproduce the experimental results from the paper.

## Quick Start

```bash
# Install dependencies
make install

# Reproduce all experiments
make reproduce

# Or run in Docker
make docker-run
```

## Contents

### Core Implementation Files
- `prompts_debater_chain.py` - Debater prompt templates and chain implementation
- `prompts_judge_chain.py` - Judge evaluation prompts and scoring
- `drift_analyzer.py` - Custom drift analysis system
- `cot_benchmark.py` - Chain-of-Thought evaluation framework
- `gamestate_manager.py` - Gamestate management system
- `auto_logger.py` - Comprehensive logging system

### Configuration Files
- `model_config.json` - Exact model parameters, seeds, and decoding settings
- `requirements.txt` - Python dependencies with versions
- `Dockerfile` - Containerized environment specification

### Data Files
- `hr1_debate_transcript.txt` - H.R. 1 debate transcript data
- `hr40_debate_transcript.txt` - H.R. 40 debate transcript data
- `*_debate_transcript.txt` - Additional debate transcripts

### Evaluation Results
- `drift_analysis_*.json` - Drift analysis results from real AI responses
- `cot_benchmark_results_*.json` - CoT evaluation benchmark results
- `ablation_study_*.json` - Ablation study results

### Reproduction Scripts
- `reproduce_experiments.py` - Main reproduction script
- `Makefile` - Build and reproduction commands

## Model Configuration

The experiments use the following models with exact parameters:

| Model | Provider | Temperature | Top-p | Max Tokens |
|-------|----------|-------------|-------|------------|
| GPT-4o-mini | OpenAI | 0.7 | 0.9 | 200 |
| Llama-3.3-70b-instruct | Meta | 0.7 | 0.9 | 200 |
| Gemini Pro | Google | 0.7 | 0.9 | 200 |
| Claude-3.5-Sonnet | Anthropic | 0.7 | 0.9 | 200 |

## Reproducing Results

### 1. Environment Setup

```bash
# Python 3.9+ required
python --version

# Install dependencies
pip install -r requirements.txt

# Or use Docker
docker build -t debatesim-reproduction .
```

### 2. API Keys Required

Set up API keys for the following providers:
- OpenAI (for GPT-4o-mini)
- Anthropic (for Claude-3.5-Sonnet)
- Google (for Gemini Pro)
- Meta (for Llama-3.3-70b-instruct)

### 3. Run Experiments

```bash
# Full reproduction with verbose output
make reproduce

# Quick reproduction (minimal output)
make quick-reproduce

# Run specific components
python reproduce_experiments.py --output-dir ./outputs --verbose
```

### 4. Expected Outputs

The reproduction will generate:
- Drift analysis results showing semantic distance and token variation
- CoT benchmark results for debating, judging, and feedback capabilities
- Gamestate management demonstration with debate simulation
- Performance metrics and timing data

## File Structure

```
papercontent/
├── README.md                           # This file
├── requirements.txt                    # Python dependencies
├── Dockerfile                         # Container specification
├── Makefile                          # Build commands
├── model_config.json                 # Model parameters and seeds
├── reproduce_experiments.py          # Main reproduction script
├── prompts_debater_chain.py          # Debater prompts
├── prompts_judge_chain.py            # Judge prompts
├── drift_analyzer.py                 # Drift analysis implementation
├── cot_benchmark.py                  # CoT evaluation framework
├── gamestate_manager.py              # Gamestate management
├── auto_logger.py                    # Logging system
├── hr1_debate_transcript.txt         # H.R. 1 debate data
├── hr40_debate_transcript.txt        # H.R. 40 debate data
├── drift_analysis_*.json             # Drift analysis results
├── cot_benchmark_results_*.json      # CoT benchmark results
└── ablation_study_*.json             # Ablation study results
```

## Troubleshooting

### Common Issues

1. **API Key Errors**: Ensure all required API keys are set in your environment
2. **Dependency Issues**: Use Python 3.9+ and install from requirements.txt
3. **Memory Issues**: The drift analysis may require significant memory for large datasets

### Getting Help

If you encounter issues:
1. Check the error messages in the output
2. Verify all dependencies are installed correctly
3. Ensure API keys are properly configured
4. Check the reproduction report in `./outputs/reproduction_report.json`

## Citation

If you use this reproduction package, please cite the original paper:

```bibtex
@article{debatesim2024,
  title={Chain-of-Thought Evaluation and Drift Analysis for Multi-Agent AI Debate Systems},
  author={Anonymous Authors},
  journal={NeurIPS 2024},
  year={2024}
}
```

## License

This reproduction package is released under the same license as the original paper.
