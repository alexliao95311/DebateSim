.PHONY: all clean

all: neurips_paper_template.pdf

neurips_paper_template.pdf: neurips_paper_template.tex agents4science_2025.sty references.bib
	pdflatex $<
	bibtex $(basename $<)
	pdflatex $<
	pdflatex $<

clean:
	rm -f *.aux *.bbl *.blg *.log *.out *.toc *.fls *.fdb_latexmk *.synctex.gz neurips_paper_template.pdf
