# Overleaf Upload Guide

## 📦 **Files to Upload to Overleaf**

### **Essential Files (Required)**
1. `neurips_paper_template.tex` - Main paper file
2. `agents4science_2025.sty` - LaTeX style file
3. `references.bib` - Bibliography file

### **Optional Files (Recommended)**
4. `hr40_debate_transcript.txt` - Real data source
5. `hr1_debate_transcript.txt` - Real data source
6. `debatesim_performance_results.json` - Performance data

## 🚀 **Step-by-Step Upload Instructions**

### **Method 1: Create New Project (Recommended)**

1. **Go to Overleaf**
   - Visit [overleaf.com](https://www.overleaf.com)
   - Sign in or create an account

2. **Create New Project**
   - Click "New Project" → "Blank Project"
   - Name it: "AI Debate Model & Drift Analysis"
   - Choose "Blank Project"

3. **Upload Main Files**
   - Click "Upload" in the file panel
   - Upload `neurips_paper_template.tex` (rename to `main.tex` if needed)
   - Upload `agents4science_2025.sty`
   - Upload `references.bib`

4. **Set Main File**
   - Right-click on `neurips_paper_template.tex`
   - Select "Set as Main File"

5. **Compile**
   - Click "Recompile" button
   - Check for any errors and fix them

### **Method 2: Upload ZIP File**

1. **Create ZIP Package**
   ```bash
   cd stanfordpaper
   zip overleaf-paper.zip neurips_paper_template.tex agents4science_2025.sty references.bib
   ```

2. **Upload to Overleaf**
   - Go to Overleaf
   - Click "New Project" → "Upload Project"
   - Select your ZIP file
   - Click "Create Project"

## ⚙️ **Overleaf Configuration**

### **Compiler Settings**
1. Go to "Menu" (top left)
2. Select "Settings"
3. Set Compiler to: **pdfLaTeX**
4. Set Main file to: **neurips_paper_template.tex**

### **Project Settings**
- **Project Name**: AI Debate Model & Drift Analysis
- **Compiler**: pdfLaTeX
- **Main file**: neurips_paper_template.tex
- **Output format**: PDF

## 🔧 **Troubleshooting Common Issues**

### **Issue 1: Style File Not Found**
- **Error**: `File 'agents4science_2025.sty' not found`
- **Solution**: Make sure `agents4science_2025.sty` is uploaded in the root directory

### **Issue 2: Bibliography Not Working**
- **Error**: Citations show as [?]
- **Solution**: 
  1. Compile with pdfLaTeX
  2. Run BibTeX
  3. Compile with pdfLaTeX twice more

### **Issue 3: Missing Packages**
- **Error**: `Package not found`
- **Solution**: Overleaf has most packages pre-installed, but if missing, add to preamble

## 📋 **Pre-Upload Checklist**

- [ ] `neurips_paper_template.tex` is the main file
- [ ] `agents4science_2025.sty` is uploaded
- [ ] `references.bib` is uploaded
- [ ] All citations in the paper exist in references.bib
- [ ] No temporary files included
- [ ] Project name is descriptive

## 🎯 **After Upload**

1. **Test Compilation**
   - Click "Recompile" to ensure everything works
   - Check for any error messages

2. **Verify Citations**
   - Look for [?] in the text (indicates missing citations)
   - Run BibTeX if needed

3. **Share Project**
   - Click "Share" to get collaboration link
   - Set permissions as needed

## 📁 **File Structure in Overleaf**

```
Project Root/
├── neurips_paper_template.tex (main file)
├── agents4science_2025.sty
├── references.bib
├── hr40_debate_transcript.txt (optional)
├── hr1_debate_transcript.txt (optional)
└── debatesim_performance_results.json (optional)
```

## ✅ **Success Indicators**

- Paper compiles without errors
- All citations appear as numbers [1], [2], etc.
- Bibliography appears at the end
- Tables and figures display correctly
- No missing references

---

**Note**: Overleaf will handle the LaTeX compilation automatically, so you don't need to install LaTeX locally!
