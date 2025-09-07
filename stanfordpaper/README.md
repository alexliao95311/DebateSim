# AI Debate Model & Drift Analysis Research Paper

This directory contains the research paper and supporting materials for the AI Debate Model & Drift Analysis project, formatted for NeurIPS 2024 submission.

## Paper Structure

### Main Paper
- `neurips_paper_template.tex` - Main LaTeX paper following NeurIPS formatting guidelines
- `references.bib` - Bibliography with relevant citations
- `neurips_2024.sty` - NeurIPS style file for proper formatting

### Supporting Code and Systems

#### Drift Analysis System
- `drift_analysis/drift_analyzer.py` - Custom drift analysis framework for measuring prompt variations and model performance differences

#### Gamestate Management
- `gamestate/gamestate_manager.py` - Comprehensive gamestate framework for tracking debate context and model prompt handling

#### Chain-of-Thought Evaluation
- `cot_evaluation/cot_benchmark.py` - CoT-specific benchmark for evaluating debating, judging, and feedback capabilities

#### Auto-Logging System
- `auto_logging/auto_logger.py` - Comprehensive auto-logging system for tracking inputs, outputs, and drift metrics

#### Performance Monitoring
- `performance_monitor.py` - Existing performance monitoring system (integrated with new components)
- `json_generator.py` - JSON data generation for experimental results

## Key Contributions

1. **Custom Drift Analysis Framework**: Measures semantic distance, token variation, argument structure drift, and evidence consistency between different prompts and their outputs.

2. **Gamestate Management System**: Tracks debate context, model configurations, and performance metrics across multiple rounds with comprehensive state management.

3. **CoT-Specific Benchmark**: Specialized evaluation framework for Chain-of-Thought reasoning in debating, judging, and feedback capabilities.

4. **Comprehensive Auto-Logging**: Complete traceability system for inputs, outputs, drift metrics, and performance data.

## Research Questions Addressed

1. How do different LLM providers perform in specialized debate roles?
2. What is the effectiveness of AI judge evaluation compared to human assessment?
3. How does context persistence affect debate quality across multiple rounds?
4. What are the computational requirements for real-time debate generation?
5. How can we systematically evaluate Chain-of-Thought reasoning quality in multi-agent scenarios?

## Experimental Design

### Dataset
- H.R. 40: Commission to Study and Develop Reparation Proposals for African-Americans Act
- H.R. 1: Comprehensive legislation addressing voting rights and campaign finance

### Models Evaluated
- OpenAI GPT-4o-mini
- Meta Llama-3.3-70b-instruct
- Google Gemini Pro
- Anthropic Claude-3.5-Sonnet

### Evaluation Metrics
- **Drift Analysis**: Semantic distance, token variation, argument structure drift, evidence consistency
- **CoT Quality**: Reasoning depth, evidence integration, logical flow, step coherence
- **Performance**: Response time, memory usage, token consumption, context management efficiency

## Usage Instructions

### Compiling the Paper
```bash
# Install required LaTeX packages
sudo apt-get install texlive-full  # Ubuntu/Debian
# or
brew install --cask mactex  # macOS

# Compile the paper
pdflatex neurips_paper_template.tex
bibtex neurips_paper_template
pdflatex neurips_paper_template.tex
pdflatex neurips_paper_template.tex
```

### Running the Code
```bash
# Install dependencies
pip install -r requirements.txt

# Run drift analysis
python drift_analysis/drift_analyzer.py

# Run gamestate management
python gamestate/gamestate_manager.py

# Run CoT evaluation
python cot_evaluation/cot_benchmark.py

# Run auto-logging system
python auto_logging/auto_logger.py
```

## File Organization

```
stanfordpaper/
├── neurips_paper_template.tex    # Main paper
├── references.bib                # Bibliography
├── neurips_2024.sty             # NeurIPS style file
├── README.md                    # This file
├── drift_analysis/
│   └── drift_analyzer.py        # Drift analysis system
├── gamestate/
│   └── gamestate_manager.py     # Gamestate management
├── cot_evaluation/
│   └── cot_benchmark.py         # CoT evaluation framework
├── auto_logging/
│   └── auto_logger.py           # Auto-logging system
├── performance_monitor.py       # Performance monitoring
├── json_generator.py            # JSON data generation
├── paper.tex                    # Original paper (for reference)
└── data/                        # Experimental data
    └── raw_metrics.json         # Raw performance metrics
```

## Key Features

### Drift Analysis System
- Semantic distance calculation using sentence transformers
- Token variation analysis with Jaccard similarity
- Argument structure drift measurement
- Evidence consistency evaluation
- Comprehensive drift metrics aggregation

### Gamestate Management
- Complete debate session tracking
- Model configuration management
- Round-by-round state persistence
- Performance metrics integration
- JSON serialization for reproducibility

### CoT Evaluation Framework
- Automatic reasoning step extraction
- Quality assessment across multiple dimensions
- Benchmark creation for different capabilities
- Model comparison and ranking
- Comprehensive evaluation metrics

### Auto-Logging System
- SQLite database for structured logging
- JSON files for human-readable logs
- Background processing for performance
- Session management and tracking
- Export capabilities for analysis

## Integration with Existing System

The new components integrate seamlessly with the existing DebateSim system:

1. **Drift Analyzer** can be used to analyze prompt variations in the existing debate chains
2. **Gamestate Manager** provides enhanced state management for the current debate system
3. **CoT Evaluator** can assess the reasoning quality of existing model outputs
4. **Auto-Logger** provides comprehensive logging for all system interactions

## Future Work

1. **Automated CoT Quality Assessment**: Developing more sophisticated automated methods for evaluating reasoning quality
2. **Multi-Modal Integration**: Extending the framework to handle multi-modal inputs and outputs
3. **Real-Time Adaptation**: Implementing real-time prompt adaptation based on drift analysis results
4. **Human-AI Collaboration**: Exploring hybrid human-AI evaluation approaches

## Citation

If you use this work, please cite:

```bibtex
@article{anonymous2024cot,
  title={Chain-of-Thought Evaluation and Drift Analysis for Multi-Agent AI Debate Systems},
  author={Anonymous Authors},
  journal={Advances in Neural Information Processing Systems},
  year={2024}
}
```

## License

This work is licensed under the MIT License. See LICENSE file for details.

## Contact

For questions about this research, please contact [anonymous@email.com].
