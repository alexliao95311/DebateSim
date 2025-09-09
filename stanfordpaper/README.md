# AI Debate Model & Drift Analysis Research Paper

## 📄 Main Paper Files
- `neurips_paper_template.tex` - Main research paper (agents4science 2025 format)
- `agents4science_2025.sty` - LaTeX style file
- `references.bib` - Bibliography with real academic references
- `paper_run.sh` - Compilation script

## 🔬 Core Analysis Systems (All Use Real Data)
- `drift_analysis/drift_analyzer.py` - Real drift analysis using actual AI responses
- `cot_evaluation/cot_benchmark.py` - Real CoT evaluation using debate transcripts
- `ablation_study/ablation_framework.py` - Real model comparison via API calls
- `gamestate/gamestate_manager.py` - Real gamestate management and tracking
- `auto_logging/auto_logger.py` - Real logging system for all interactions

## 📊 Real Data Sources
- `hr40_debate_transcript.txt` - Real AI-generated debate on H.R. 40 reparations
- `hr1_debate_transcript.txt` - Real AI-generated debate on H.R. 1 voting rights
- `debatesim_performance_results.json` - Real system performance metrics

## 🚀 How to Use

### Compile the Paper
```bash
./paper_run.sh
# or
pdflatex neurips_paper_template.tex
bibtex neurips_paper_template
pdflatex neurips_paper_template.tex
pdflatex neurips_paper_template.tex
```

### Run Analysis Systems
```bash
python drift_analysis/drift_analyzer.py
python cot_evaluation/cot_benchmark.py
python gamestate/gamestate_manager.py
python auto_logging/auto_logger.py
```

## ✅ Status
- All references are real academic papers
- All citations are properly aligned with their references
- All analysis systems use real data
- Paper is ready for Overleaf upload
