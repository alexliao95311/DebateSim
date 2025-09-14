#!/bin/bash
# Script to prepare NeurIPS 2024 submission package

set -euo pipefail

echo "Preparing NeurIPS 2024 submission package..."

# Create submission directory
SUBMISSION_DIR="neurips2024_submission"
rm -rf "$SUBMISSION_DIR"
mkdir -p "$SUBMISSION_DIR"
cd "$SUBMISSION_DIR"

echo "📄 Copying paper files..."
cp ../neurips_paper_template.tex .
cp ../references.bib .
cp ../agents4science_2025.sty .

echo "🔧 Compiling LaTeX..."
if command -v pdflatex >/dev/null 2>&1; then
    pdflatex neurips_paper_template.tex > /dev/null 2>&1
    bibtex neurips_paper_template > /dev/null 2>&1
    pdflatex neurips_paper_template.tex > /dev/null 2>&1
    pdflatex neurips_paper_template.tex > /dev/null 2>&1
    
    if [ ! -f "neurips_paper_template.pdf" ]; then
        echo "❌ Error: PDF compilation failed"
        echo "Please check LaTeX installation and try again"
        exit 1
    fi
else
    echo "⚠️  Warning: pdflatex not found. PDF compilation skipped."
    echo "Please install LaTeX (e.g., MacTeX on macOS, TeX Live on Linux) and run:"
    echo "  pdflatex neurips_paper_template.tex"
    echo "  bibtex neurips_paper_template"
    echo "  pdflatex neurips_paper_template.tex"
    echo "  pdflatex neurips_paper_template.tex"
    echo ""
    echo "Continuing with supplementary materials preparation..."
fi

echo "📁 Creating supplementary materials..."
mkdir -p supplementary/{code,data}

# Copy documentation
cp ../README.md supplementary/
cp ../REPRODUCIBILITY.md supplementary/
cp ../SUBMISSION_CHECKLIST.md supplementary/

# Copy scripts and configs
cp ../reproduce_experiments.py supplementary/
cp ../Makefile supplementary/
cp ../requirements.txt supplementary/
cp ../Dockerfile supplementary/
cp ../model_config.json supplementary/

# Copy code
cp ../prompts_*.py supplementary/code/
cp ../drift_analyzer.py supplementary/code/
cp ../cot_benchmark.py supplementary/code/
cp ../gamestate_manager.py supplementary/code/
cp ../auto_logger.py supplementary/code/

# Copy data
cp ../hr*_debate_transcript.txt supplementary/data/ 2>/dev/null || true
cp ../drift_analysis_*.json supplementary/data/ 2>/dev/null || true
cp ../cot_benchmark_results_*.json supplementary/data/ 2>/dev/null || true
cp ../ablation_study_*.json supplementary/data/ 2>/dev/null || true

echo "📦 Creating submission archive..."
if [ -f "neurips_paper_template.pdf" ]; then
    zip -r neurips2024_submission.zip neurips_paper_template.pdf supplementary/ > /dev/null
    echo "✅ Submission package created successfully!"
    echo ""
    echo "Files created:"
    echo "  - neurips_paper_template.pdf (main paper)"
    echo "  - neurips2024_submission.zip (complete package)"
    echo ""
    echo "Next steps:"
    echo "  1. Review the PDF for any issues"
    echo "  2. Test the supplementary materials"
    echo "  3. Submit to OpenReview: https://openreview.net/group?id=NeurIPS.cc/2024/Conference"
    echo ""
    echo "Package size: $(du -h neurips2024_submission.zip | cut -f1)"
    echo "PDF size: $(du -h neurips_paper_template.pdf | cut -f1)"
else
    zip -r neurips2024_submission.zip supplementary/ > /dev/null
    echo "✅ Supplementary materials package created successfully!"
    echo ""
    echo "Files created:"
    echo "  - neurips2024_submission.zip (supplementary materials only)"
    echo ""
    echo "⚠️  Note: PDF not created due to missing LaTeX installation"
    echo "Next steps:"
    echo "  1. Install LaTeX (MacTeX on macOS, TeX Live on Linux)"
    echo "  2. Compile the PDF: pdflatex neurips_paper_template.tex"
    echo "  3. Add PDF to the submission package"
    echo "  4. Submit to OpenReview: https://openreview.net/group?id=NeurIPS.cc/2024/Conference"
    echo ""
    echo "Package size: $(du -h neurips2024_submission.zip | cut -f1)"
fi
