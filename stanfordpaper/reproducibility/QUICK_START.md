# Quick Start Guide

This guide will help you quickly reproduce the results from our NeurIPS 2024 paper.

## Prerequisites

- Python 3.9+
- Git
- Docker (optional, for containerized environment)

## Option 1: Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/alexliao95311/cot-debate-drift
cd cot-debate-drift

# Build and run with Docker
cd docker
docker build -t debate-sim .
docker run -it --gpus all debate-sim

# Inside the container, run:
make reproduce
```

## Option 2: Local Installation

```bash
# Clone the repository
git clone https://github.com/alexliao95311/cot-debate-drift
cd cot-debate-drift

# Run the setup script
chmod +x setup_environment.sh
./setup_environment.sh

# Activate virtual environment
source venv/bin/activate

# Set up API keys (edit .env file)
cp .env.template .env
# Edit .env with your API keys

# Reproduce all results
make reproduce
```

## Verify Results

After running the experiments, verify that the results match the paper:

```bash
python3 validate_results.py
```

This should show:
```
🎉 All results match paper tables! Reproducibility verified.
```

## Expected Output

The reproduction will generate:
- `results/drift_analysis_*.json` - Drift analysis results
- `results/cot_benchmark_results_*.json` - CoT evaluation results  
- `results/ablation_study_*.json` - Ablation study results
- `results/debatesim_performance_results.json` - Performance metrics

## Troubleshooting

### Common Issues

1. **API Rate Limits**: Add delays between requests in the configuration
2. **Memory Issues**: Reduce batch sizes in `models/model_config.json`
3. **CUDA Errors**: Ensure proper GPU setup and driver compatibility

### Getting Help

- Check the full [README.md](README.md) for detailed instructions
- Open an issue on the GitHub repository
- Contact the authors

## Next Steps

- Explore the individual scripts in `scripts/`
- Modify `models/model_config.json` to experiment with different settings
- Check out the detailed analysis in `results/`
