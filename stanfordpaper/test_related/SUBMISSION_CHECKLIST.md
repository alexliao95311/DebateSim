# NeurIPS 2024 Submission Checklist

## Pre-Submission Checklist

### ✅ Paper Preparation
- [ ] Paper compiled successfully with no LaTeX errors
- [ ] All figures and tables included and properly formatted
- [ ] Page count within limits (8 pages + references + appendix)
- [ ] Bibliography properly formatted
- [ ] All co-authors listed and affiliations correct
- [ ] Abstract within word limit (250 words)
- [ ] Keywords provided (3-5 relevant terms)

### ✅ Reproducibility Package
- [ ] All required files copied to `papercontent/` folder
- [ ] `reproduce_experiments.py` runs without errors
- [ ] `make reproduce` command works
- [ ] Docker container builds and runs successfully
- [ ] All API keys documented in README
- [ ] Model configurations match paper exactly
- [ ] Data files included and accessible

### ✅ Code and Data
- [ ] Source code is clean and well-commented
- [ ] All dependencies listed in `requirements.txt`
- [ ] Model parameters documented in `model_config.json`
- [ ] Prompts are versioned and documented
- [ ] Evaluation scripts produce expected results
- [ ] Data files are properly formatted and complete

### ✅ Documentation
- [ ] `README.md` provides clear setup instructions
- [ ] `REPRODUCIBILITY.md` explains full reproduction process
- [ ] `SUBMISSION_CHECKLIST.md` (this file) completed
- [ ] Code comments explain key algorithms
- [ ] API usage documented with examples

## Submission Process

### Step 1: Create Submission Package
```bash
# Create submission directory
mkdir neurips2024_submission
cd neurips2024_submission

# Copy paper files
cp ../stanfordpaper/papercontent/neurips_paper_template.tex .
cp ../stanfordpaper/papercontent/references.bib .
cp ../stanfordpaper/papercontent/agents4science_2025.sty .

# Compile paper
pdflatex neurips_paper_template.tex
bibtex neurips_paper_template
pdflatex neurips_paper_template.tex
pdflatex neurips_paper_template.tex

# Create supplementary materials
mkdir supplementary
cp ../stanfordpaper/papercontent/README.md supplementary/
cp ../stanfordpaper/papercontent/REPRODUCIBILITY.md supplementary/
cp ../stanfordpaper/papercontent/SUBMISSION_CHECKLIST.md supplementary/
cp ../stanfordpaper/papercontent/reproduce_experiments.py supplementary/
cp ../stanfordpaper/papercontent/Makefile supplementary/
cp ../stanfordpaper/papercontent/requirements.txt supplementary/
cp ../stanfordpaper/papercontent/Dockerfile supplementary/
cp ../stanfordpaper/papercontent/model_config.json supplementary/

# Copy code
mkdir supplementary/code
cp ../stanfordpaper/papercontent/prompts_*.py supplementary/code/
cp ../stanfordpaper/papercontent/drift_analyzer.py supplementary/code/
cp ../stanfordpaper/papercontent/cot_benchmark.py supplementary/code/
cp ../stanfordpaper/papercontent/gamestate_manager.py supplementary/code/
cp ../stanfordpaper/papercontent/auto_logger.py supplementary/code/

# Copy data
mkdir supplementary/data
cp ../stanfordpaper/papercontent/hr*_debate_transcript.txt supplementary/data/
cp ../stanfordpaper/papercontent/drift_analysis_*.json supplementary/data/
cp ../stanfordpaper/papercontent/cot_benchmark_results_*.json supplementary/data/
cp ../stanfordpaper/papercontent/ablation_study_*.json supplementary/data/

# Create archive
zip -r neurips2024_submission.zip neurips_paper_template.pdf supplementary/
```

### Step 2: Verify Package
- [ ] PDF compiles without errors
- [ ] All files included in ZIP archive
- [ ] Archive size within limits (50MB)
- [ ] No sensitive information (API keys, personal data)
- [ ] All paths are relative and portable

### Step 3: OpenReview Submission
- [ ] Account created and verified
- [ ] Conference selected (NeurIPS 2024)
- [ ] Title matches paper exactly
- [ ] Abstract copied correctly
- [ ] All authors added with correct affiliations
- [ ] Keywords provided
- [ ] PDF uploaded successfully
- [ ] Supplementary materials uploaded
- [ ] Submission form completed
- [ ] Final review before submission

## Post-Submission

### Immediate Actions
- [ ] Save submission confirmation number
- [ ] Download submitted files for records
- [ ] Set calendar reminder for review period
- [ ] Prepare for potential reviewer questions

### During Review Period
- [ ] Monitor OpenReview for updates
- [ ] Prepare responses to potential questions
- [ ] Keep reproduction package updated
- [ ] Document any issues or improvements

### If Accepted
- [ ] Prepare camera-ready version
- [ ] Update any last-minute changes
- [ ] Ensure all supplementary materials are final
- [ ] Prepare presentation materials

## Quality Assurance

### Final Verification
- [ ] Run `make reproduce` one final time
- [ ] Verify all results match paper tables
- [ ] Check that all code runs without errors
- [ ] Ensure documentation is complete and accurate
- [ ] Test on clean environment (Docker)

### Backup and Version Control
- [ ] Create backup of all submission materials
- [ ] Tag current version in git (if using version control)
- [ ] Store submission package in secure location
- [ ] Document any last-minute changes

## Emergency Contacts

- **OpenReview Support**: https://openreview.net/help
- **NeurIPS 2024 FAQ**: [Conference website]
- **Technical Issues**: Check troubleshooting in REPRODUCIBILITY.md

## Submission Timeline

- **Deadline**: [Check NeurIPS 2024 website for exact date]
- **Time Zone**: [Check conference timezone]
- **Buffer Time**: Submit at least 2 hours before deadline
- **Backup Plan**: Have alternative submission method ready

---

**Remember**: Double-check everything before submitting. It's better to be thorough than to discover issues after submission!
