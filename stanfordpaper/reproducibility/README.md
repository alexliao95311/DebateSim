# Reproducibility Package for Chain-of-Thought Evaluation and Drift Analysis for Multi-Agent AI Debate Systems

This repository contains all artifacts required to reproduce the results presented in our NeurIPS 2024 paper on Chain-of-Thought evaluation and drift analysis for multi-agent AI debate systems.

## Installation

### Prerequisites
- Python 3.9+
- CUDA-compatible GPU (recommended)
- Docker (for containerized environment)

### Quick Setup
```bash
# Clone the repository
git clone https://github.com/alexliao95311/cot-debate-drift
cd cot-debate-drift

# Option 1: Use Docker (recommended)
cd docker
docker build -t debate-sim .
docker run -it --gpus all debate-sim

# Option 2: Local installation
pip install -r models/requirements.txt
```

### Detailed Installation
1. **Environment Setup**: Create a virtual environment
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install Dependencies**: Install required packages
   ```bash
   pip install -r models/requirements.txt
   ```

3. **API Keys**: Set up API keys for LLM providers
   ```bash
   export OPENAI_API_KEY="your-openai-key"
   export ANTHROPIC_API_KEY="your-anthropic-key"
   export GOOGLE_API_KEY="your-google-key"
   export HUGGINGFACE_API_KEY="your-huggingface-key"
   ```

## Data

### Dataset Overview
The experiments use two legislative debate topics:
- **H.R. 40**: Commission to Study and Develop Reparation Proposals for African-Americans Act
- **H.R. 1**: Comprehensive legislation addressing voting rights and campaign finance

### Data Files
- `data/hr1_debate_transcript.txt`: Complete debate transcript for H.R. 1
- `data/hr40_debate_transcript.txt`: Complete debate transcript for H.R. 40
- `results/`: Contains all experimental results and analysis outputs

### Data Format
Debate transcripts are stored in structured JSON format with the following schema:
```json
{
  "session_id": "unique_session_identifier",
  "topic": "debate_topic",
  "rounds": [
    {
      "round_number": 1,
      "pro_argument": "argument_text",
      "con_argument": "argument_text",
      "judge_evaluation": "evaluation_text",
      "feedback": "feedback_text",
      "timestamps": {...},
      "model_config": {...}
    }
  ]
}
```

## Running Experiments

### Basic Usage
```bash
# Run complete evaluation pipeline
make reproduce

# Run specific components
python scripts/reproduce_experiments.py --component drift_analysis
python scripts/reproduce_experiments.py --component cot_evaluation
python scripts/reproduce_experiments.py --component gamestate_analysis
```

### Individual Scripts
1. **Drift Analysis**:
   ```bash
   python scripts/drift_analyzer.py --input data/hr1_debate_transcript.txt --output results/drift_analysis.json
   ```

2. **CoT Evaluation**:
   ```bash
   python scripts/cot_benchmark.py --model gpt-4o-mini --temperature 0.7 --output results/cot_results.json
   ```

3. **Gamestate Management**:
   ```bash
   python scripts/gamestate_manager.py --session-id test_session --topic hr1
   ```

### Configuration
Modify `models/model_config.json` to adjust:
- Model parameters (temperature, top-p, max tokens)
- Provider settings
- Evaluation thresholds
- Hardware specifications

## Reproducing Results

### Step-by-Step Reproduction
1. **Environment Setup**: Follow installation instructions above
2. **Data Preparation**: Ensure all data files are in the `data/` directory
3. **Configuration**: Review and adjust `models/model_config.json` if needed
4. **Run Experiments**: Execute `make reproduce` or individual scripts
5. **Verify Results**: Compare outputs in `results/` with paper tables

### Expected Outputs
The reproduction should generate:
- `results/drift_analysis_*.json`: Drift analysis results
- `results/cot_benchmark_results_*.json`: Chain-of-Thought evaluation results
- `results/ablation_study_*.json`: Ablation study results
- `results/debatesim_performance_results.json`: Performance metrics

### Validation
Compare your results with the tables in the paper:
- Table 1: Drift Analysis Results
- Table 2: CoT Quality Scores
- Table 3: Performance Metrics
- Table 4: Model Comparison

### Troubleshooting
- **API Rate Limits**: Implement delays between requests
- **Memory Issues**: Reduce batch sizes in configuration
- **CUDA Errors**: Ensure proper GPU setup and driver compatibility

## Citation

If you use this code or data in your research, please cite our paper:

```bibtex
@article{debate_sim_2024,
  title={Chain-of-Thought Evaluation and Drift Analysis for Multi-Agent AI Debate Systems},
  author={Anonymous Authors},
  journal={Advances in Neural Information Processing Systems},
  year={2024}
}
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contact

For questions or issues, please open an issue on the GitHub repository or contact the authors.

## Acknowledgments

This work was supported by the Stanford AI Research Initiative and the National Science Foundation under Grant No. 2024-001.

---

**Note**: This reproducibility package is designed to work with the exact model versions and configurations specified in the paper. Results may vary slightly due to provider-side model updates or hardware differences.
