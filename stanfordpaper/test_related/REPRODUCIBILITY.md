# Reproducibility Guide: Chain-of-Thought Evaluation and Drift Analysis for Multi-Agent AI Debate Systems

This document provides comprehensive instructions for reproducing the experimental results from our NeurIPS 2024 paper submission and explains the complete submission process.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Detailed Reproduction Instructions](#detailed-reproduction-instructions)
3. [Understanding the Results](#understanding-the-results)
4. [OpenReview Submission Process](#openreview-submission-process)
5. [Troubleshooting](#troubleshooting)
6. [File Organization](#file-organization)
7. [Citation and Attribution](#citation-and-attribution)

## Quick Start

### Option 1: Docker (Recommended)
```bash
# Build and run in Docker
make docker-build
make docker-run
```

### Option 2: Local Python
```bash
# Install dependencies and run
make install
make reproduce
```

### Option 3: Manual Steps
```bash
pip install -r requirements.txt
python reproduce_experiments.py --output-dir ./outputs --verbose
```

## Detailed Reproduction Instructions

### Prerequisites

- **Python 3.9+** (tested with 3.9.7)
- **8GB+ RAM** (for drift analysis with sentence transformers)
- **API Keys** for the following providers:
  - OpenAI (for GPT-4o-mini)
  - Anthropic (for Claude-3.5-Sonnet) 
  - Google (for Gemini Pro)
  - Meta (for Llama-3.3-70b-instruct)

### Step 1: Environment Setup

#### Using Docker (Recommended)
```bash
# Build the container
docker build -t debatesim-reproduction .

# Run experiments
docker run -v $(PWD)/outputs:/app/outputs debatesim-reproduction
```

#### Using Local Python
```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### Step 2: API Key Configuration

Set up your API keys as environment variables:

```bash
# Required API keys
export OPENAI_API_KEY="your_openai_key"
export ANTHROPIC_API_KEY="your_anthropic_key"
export GOOGLE_API_KEY="your_google_key"
export META_API_KEY="your_meta_key"

# Optional: Set specific model endpoints
export OPENROUTER_API_KEY="your_openrouter_key"  # Alternative to individual keys
```

### Step 3: Run Experiments

#### Full Reproduction
```bash
# Run all experiments with verbose output
make reproduce

# Or run directly
python reproduce_experiments.py --output-dir ./outputs --verbose
```

#### Individual Components
```bash
# Run only drift analysis
python -c "
from drift_analyzer import DriftAnalyzer
analyzer = DriftAnalyzer()
results = analyzer.run_real_drift_analysis()
print(f'Average drift: {sum(r.overall_drift_score for r in results)/len(results):.3f}')
"

# Run only CoT benchmarks
python -c "
from cot_benchmark import CoTBenchmark, CoTCapability
benchmark = CoTBenchmark()
results = benchmark.run_benchmark('gpt-4o-mini', CoTCapability.DEBATING)
print(f'Debating score: {results[0].analysis.total_score:.3f}')
"
```

### Step 4: Verify Results

The reproduction should generate the following outputs in `./outputs/`:

```
outputs/
├── reproduction_report.json          # Summary of all experiments
├── drift_analysis_reproduction_*.json # Drift analysis results
├── cot_benchmark_reproduction_*.json  # CoT benchmark results
├── gamestates/                        # Gamestate management demo
└── cot_benchmarks/                   # Detailed CoT results
```

## Understanding the Results

### Expected Outputs

#### 1. Drift Analysis Results
- **File**: `drift_analysis_reproduction_*.json`
- **Key Metrics**:
  - `semantic_distance`: 0.3-0.5 (higher = more different)
  - `token_variation`: 0.3-0.5 (higher = more variation)
  - `overall_drift_score`: 0.3-0.4 (weighted average)

#### 2. CoT Benchmark Results
- **File**: `cot_benchmark_reproduction_*.json`
- **Capabilities Tested**:
  - Debating: 0.2-0.3 (reasoning depth)
  - Judging: 0.25-0.3 (evaluation quality)
  - Feedback: 0.2-0.3 (constructive feedback)

#### 3. Gamestate Management
- **File**: `gamestates/*.json`
- **Features Demonstrated**:
  - Context persistence across rounds
  - Performance tracking
  - State management

### Interpreting the Numbers

The results should match the values reported in the paper's tables:

| Metric | Expected Range | Paper Value |
|--------|----------------|-------------|
| Average Drift Score | 0.35-0.45 | 0.394 |
| Debating CoT Score | 0.2-0.3 | 0.202-0.204 |
| Judging CoT Score | 0.25-0.3 | 0.293-0.299 |
| Response Time | 15-20s | 15.38s |

## OpenReview Submission Process

### Step 1: Prepare Submission Package

1. **Create submission directory**:
```bash
mkdir neurips2024_submission
cd neurips2024_submission
```

2. **Copy paper files**:
```bash
cp ../stanfordpaper/papercontent/neurips_paper_template.tex .
cp ../stanfordpaper/papercontent/references.bib .
cp ../stanfordpaper/papercontent/agents4science_2025.sty .
```

3. **Create supplementary materials**:
```bash
mkdir supplementary
cp ../stanfordpaper/papercontent/README.md supplementary/
cp ../stanfordpaper/papercontent/REPRODUCIBILITY.md supplementary/
cp ../stanfordpaper/papercontent/reproduce_experiments.py supplementary/
cp ../stanfordpaper/papercontent/Makefile supplementary/
cp ../stanfordpaper/papercontent/requirements.txt supplementary/
cp ../stanfordpaper/papercontent/Dockerfile supplementary/
cp ../stanfordpaper/papercontent/model_config.json supplementary/
```

4. **Copy implementation files**:
```bash
mkdir supplementary/code
cp ../stanfordpaper/papercontent/prompts_*.py supplementary/code/
cp ../stanfordpaper/papercontent/drift_analyzer.py supplementary/code/
cp ../stanfordpaper/papercontent/cot_benchmark.py supplementary/code/
cp ../stanfordpaper/papercontent/gamestate_manager.py supplementary/code/
cp ../stanfordpaper/papercontent/auto_logger.py supplementary/code/
```

5. **Copy data files**:
```bash
mkdir supplementary/data
cp ../stanfordpaper/papercontent/hr*_debate_transcript.txt supplementary/data/
cp ../stanfordpaper/papercontent/drift_analysis_*.json supplementary/data/
cp ../stanfordpaper/papercontent/cot_benchmark_results_*.json supplementary/data/
cp ../stanfordpaper/papercontent/ablation_study_*.json supplementary/data/
```

### Step 2: Compile Paper

1. **Compile LaTeX**:
```bash
pdflatex neurips_paper_template.tex
bibtex neurips_paper_template
pdflatex neurips_paper_template.tex
pdflatex neurips_paper_template.tex
```

2. **Verify output**:
   - Check `neurips_paper_template.pdf` is generated
   - Ensure all figures and tables are included
   - Verify page count is within limits

### Step 3: Create Archive

1. **Create ZIP archive**:
```bash
zip -r neurips2024_submission.zip neurips_paper_template.pdf supplementary/
```

2. **Verify archive**:
```bash
unzip -l neurips2024_submission.zip
```

### Step 4: Submit to OpenReview

1. **Go to OpenReview**: https://openreview.net/group?id=NeurIPS.cc/2024/Conference

2. **Create account** (if needed) and log in

3. **Start new submission**:
   - Click "New Submission"
   - Select "NeurIPS 2024" conference

4. **Fill submission form**:
   - **Title**: "Chain-of-Thought Evaluation and Drift Analysis for Multi-Agent AI Debate Systems"
   - **Abstract**: Copy from paper
   - **Authors**: Add all co-authors
   - **Keywords**: "multi-agent systems, chain-of-thought, drift analysis, debate systems, AI evaluation"

5. **Upload files**:
   - **PDF**: Upload `neurips_paper_template.pdf`
   - **Supplementary Material**: Upload `neurips2024_submission.zip`

6. **Complete submission**:
   - Review all information
   - Submit for review

### Step 5: Post-Submission

1. **Monitor status**: Check OpenReview for updates
2. **Respond to reviews**: Address reviewer comments
3. **Camera-ready preparation**: If accepted, prepare final version

## Troubleshooting

### Common Issues

#### 1. API Key Errors
```
Error: API key not found
```
**Solution**: Ensure all required API keys are set in environment variables.

#### 2. Memory Issues
```
Error: Out of memory during drift analysis
```
**Solution**: 
- Use smaller batch sizes in `drift_analyzer.py`
- Increase system memory or use cloud instance
- Use Docker with memory limits

#### 3. Dependency Conflicts
```
Error: Package version conflicts
```
**Solution**:
```bash
pip install --upgrade pip
pip install -r requirements.txt --force-reinstall
```

#### 4. Missing Data Files
```
Error: Transcript files not found
```
**Solution**: Ensure all data files are copied to the correct location.

### Performance Optimization

#### For Large-Scale Reproduction
```bash
# Use parallel processing
export OMP_NUM_THREADS=4
python reproduce_experiments.py --parallel --workers 4
```

#### For Memory-Constrained Systems
```bash
# Reduce batch sizes
python reproduce_experiments.py --batch-size 32 --output-dir ./outputs
```

## File Organization

### Directory Structure
```
papercontent/
├── README.md                           # Quick start guide
├── REPRODUCIBILITY.md                  # This file
├── requirements.txt                    # Python dependencies
├── Dockerfile                         # Container specification
├── Makefile                          # Build commands
├── model_config.json                 # Model parameters and seeds
├── reproduce_experiments.py          # Main reproduction script
├── neurips_paper_template.tex        # Main paper LaTeX
├── references.bib                     # Bibliography
├── agents4science_2025.sty           # LaTeX style file
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

### Key Files Explained

- **`reproduce_experiments.py`**: Main script that runs all experiments
- **`model_config.json`**: Contains exact model parameters used in paper
- **`drift_analyzer.py`**: Implements custom drift analysis beyond standard prompt drift
- **`cot_benchmark.py`**: Evaluates Chain-of-Thought reasoning quality
- **`gamestate_manager.py`**: Manages debate context and state
- **`prompts_*.py`**: Exact prompt templates used for each agent role

## Citation and Attribution

### If You Use This Work

Please cite our paper:

```bibtex
@article{debatesim2024,
  title={Chain-of-Thought Evaluation and Drift Analysis for Multi-Agent AI Debate Systems},
  author={Anonymous Authors},
  journal={NeurIPS 2024},
  year={2024}
}
```

### Reproducibility Statement

This reproduction package provides:
- ✅ Exact prompts for each agent role (debater/judge/feedback)
- ✅ Topic lists and split files for H.R. 40 and H.R. 1
- ✅ Scoring rubrics and aggregation scripts
- ✅ Seeds and decoding parameters (temperature, top-p, max tokens)
- ✅ Provider/model identifiers and versions
- ✅ Cached raw model outputs to mitigate provider-side drift
- ✅ Containerized environment (Dockerfile and requirements)
- ✅ Scripts to re-run ablations and regenerate tables/figures

### Limitations

- Some third-party data may require separate licensing
- API costs may apply for full reproduction
- Hardware requirements may vary based on system configuration

### Support

For questions about reproduction:
1. Check this guide first
2. Review the error messages and troubleshooting section
3. Check the reproduction report in `./outputs/reproduction_report.json`
4. Contact the authors through OpenReview

---

**Last Updated**: September 2024  
**Version**: 1.0.0  
**Compatibility**: Python 3.9+, Docker 20.0+
