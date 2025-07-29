import { jsPDF } from "jspdf";
import { marked } from "marked";

class PDFGenerator {
  constructor() {
    this.colors = {
      primary: [74, 144, 226],      // #4a90e2 - Professional blue
      secondary: [108, 117, 125],   // #6c757d - Neutral gray
      success: [40, 167, 69],       // #28a745 - Success green
      warning: [255, 193, 7],       // #ffc107 - Warning amber
      danger: [220, 53, 69],        // #dc3545 - Error red
      dark: [52, 58, 64],           // #343a40 - Dark text
      light: [248, 249, 250],       // #f8f9fa - Light background
      white: [255, 255, 255],
      black: [0, 0, 0],
      gray: [108, 117, 125],
      accent: [0, 123, 191],        
      text: [33, 37, 41]           
    };
    
    this.margins = {
      top: 85,      
      right: 65,
      bottom: 85,
      left: 65
    };
  }

  generateAnalysisPDF(analysisData) {
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "letter"
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const contentWidth = pageWidth - this.margins.left - this.margins.right;
    
    let currentY = this.margins.top;

    currentY = this.addAnalysisHeader(pdf, analysisData, currentY, pageWidth, contentWidth);
    
    if (analysisData.grades) {
      currentY = this.addGradesSection(pdf, analysisData.grades, currentY, contentWidth, pageWidth, pageHeight);
    }
    
    currentY = this.addAnalysisContent(pdf, analysisData.content, currentY, contentWidth, pageWidth, pageHeight);
    
    this.addFooter(pdf, analysisData);
    
    const fileName = this.generateFileName(analysisData.topic, 'analysis');
    pdf.save(fileName);
  }

  // Debate PDF
  generateDebatePDF(debateData) {
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "letter"
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const contentWidth = pageWidth - this.margins.left - this.margins.right;
    
    let currentY = this.margins.top;

    currentY = this.addDebateHeader(pdf, debateData, currentY, pageWidth, contentWidth);
    
    currentY = this.addDebateSetup(pdf, debateData, currentY, contentWidth, pageWidth, pageHeight);
    
    currentY = this.addDebateTranscript(pdf, debateData.transcript, currentY, contentWidth, pageWidth, pageHeight);
    
    this.addFooter(pdf, debateData);
    
    const fileName = this.generateFileName(debateData.topic, 'debate');
    pdf.save(fileName);
  }

// Analysis pdf's
addAnalysisHeader(pdf, data, startY, pageWidth, contentWidth) {
  let maxTitleFontSize = 24;
  const headerHeightBase = data.model ? 70 : 55;
  const title = "BILL ANALYSIS REPORT";
  let titleFontSize = maxTitleFontSize;

  pdf.setFillColor(...this.colors.primary);
  pdf.rect(0, 0, pageWidth, startY + headerHeightBase, 'F');

  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...this.colors.white);

  let titleWidth = pdf.getStringUnitWidth(title) * titleFontSize / pdf.internal.scaleFactor;
  while (titleWidth > pageWidth - 40 && titleFontSize > 14) {
    titleFontSize -= 1;
    titleWidth = pdf.getStringUnitWidth(title) * titleFontSize / pdf.internal.scaleFactor;
  }
  pdf.setFontSize(titleFontSize);
  pdf.text(title, (pageWidth - titleWidth) / 2, startY - 15);

  const subtitle = (data.topic || "Legislative Analysis").replace(/["'%]/g, '');
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(14);
  const subtitleLines = pdf.splitTextToSize(subtitle, contentWidth - 40);
  pdf.text(subtitleLines, this.margins.left + 20, startY + 10);

  pdf.setFontSize(10);
  const date = new Date(data.createdAt || Date.now()).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  pdf.text(`Generated: ${date}`, this.margins.left + 20, startY + 30);

  if (data.model) {
    pdf.text(`AI Model: ${data.model}`, this.margins.left + 20, startY + 45);
  }

  return startY + headerHeightBase + 25;
}

  // grades
  addGradesSection(pdf, grades, startY, contentWidth, pageWidth, pageHeight) {
    if (startY + 300 > pageHeight - this.margins.bottom) {
      pdf.addPage();
      startY = this.margins.top;
    }

    const gradeCategories = [
      { 
        key: 'overall', 
        label: 'Overall Rating', 
        description: 'Comprehensive assessment based on all criteria',
        icon: '📊'
      },
      { 
        key: 'economicImpact', 
        label: 'Economic Impact', 
        description: 'Fiscal responsibility and economic benefits',
        icon: '💰'
      },
      { 
        key: 'publicBenefit', 
        label: 'Public Benefit', 
        description: 'Benefits to citizens and public welfare',
        icon: '👥'
      },
      { 
        key: 'feasibility', 
        label: 'Implementation Feasibility', 
        description: 'Practicality and realistic execution potential',
        icon: '🛠️'
      },
      { 
        key: 'legalSoundness', 
        label: 'Legal Soundness', 
        description: 'Constitutional compliance and legal framework',
        icon: '⚖️'
      },
      { 
        key: 'effectiveness', 
        label: 'Goal Effectiveness', 
        description: 'Achievement of stated objectives and problem-solving',
        icon: '🎯'
      }
    ];

    const cols = 2;
    const gradeBoxWidth = (contentWidth - 20) / cols;
    const gradeBoxHeight = 80;
    
    let col = 0;
    let row = 0;

    gradeCategories.forEach((category, index) => {
      const score = grades[category.key] || 0;
      const x = this.margins.left + (col * (gradeBoxWidth + 10));
      const y = startY + (row * (gradeBoxHeight + 15));

      const boxColor = this.getGradeColor(score);
      pdf.setFillColor(...boxColor);
      pdf.setDrawColor(200, 200, 200);
      pdf.rect(x, y, gradeBoxWidth, gradeBoxHeight, 'FD');

      pdf.setTextColor(...this.colors.white);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(28);
      const scoreText = `${Math.round(score)}%`;
      const scoreWidth = pdf.getStringUnitWidth(scoreText) * 28 / pdf.internal.scaleFactor;
      pdf.text(scoreText, x + gradeBoxWidth - scoreWidth - 10, y + 35);

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.text(category.label, x + 10, y + 20);

      // Description
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      const descLines = pdf.splitTextToSize(category.description, gradeBoxWidth - 20);
      pdf.text(descLines, x + 10, y + 50);

      col++;
      if (col >= cols) {
        col = 0;
        row++;
      }
    });

    return startY + Math.ceil(gradeCategories.length / cols) * (gradeBoxHeight + 15) + 40;
  }

  addAnalysisContent(pdf, content, startY, contentWidth, pageWidth, pageHeight) {
    pdf.setTextColor(...this.colors.primary);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.text("DETAILED ANALYSIS", this.margins.left, startY);
    
    startY += 35;

    const processedContent = this.processMarkdownContent(content);
    
    return this.addFormattedText(pdf, processedContent, startY, contentWidth, pageWidth, pageHeight);
  }

  addDebateHeader(pdf, data, startY, pageWidth, contentWidth) {
    const headerHeight = data.model ? 70 : 55;
    pdf.setFillColor(...this.colors.primary);
    pdf.rect(0, 0, pageWidth, startY + headerHeight, 'F');
    
    // Main title
    pdf.setTextColor(...this.colors.white);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(24);
    const title = "DEBATE TRANSCRIPT";
    const titleWidth = pdf.getStringUnitWidth(title) * 24 / pdf.internal.scaleFactor;
    pdf.text(title, (pageWidth - titleWidth) / 2, startY - 15);
    
    // Topic
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'normal');
    const topic = data.topic || "Debate Topic";
    const topicLines = pdf.splitTextToSize(topic, contentWidth - 40);
    pdf.text(topicLines, this.margins.left + 20, startY + 10);
    
    pdf.setFontSize(10);
    const date = new Date(data.createdAt || Date.now()).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    pdf.text(`Generated: ${date}`, this.margins.left + 20, startY + 30);
    
    return startY + 80;
  }

  addDebateSetup(pdf, data, startY, contentWidth, pageWidth, pageHeight) {
    if (startY + 100 > pageHeight - this.margins.bottom) {
      pdf.addPage();
      startY = this.margins.top;
    }

    pdf.setFillColor(...this.colors.light);
    pdf.setDrawColor(...this.colors.gray);
    pdf.rect(this.margins.left, startY, contentWidth, 80, 'FD');
    pdf.setTextColor(...this.colors.text);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.text("DEBATE CONFIGURATION", this.margins.left + 15, startY + 20);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    
    let detailY = startY + 40;
    if (data.mode) {
      pdf.text(`Mode: ${this.formatDebateMode(data.mode)}`, this.margins.left + 15, detailY);
      detailY += 15;
    }
    
    if (data.model) {
      pdf.text(`AI Model: ${data.model}`, this.margins.left + 15, detailY);
      detailY += 15;
    }

    if (data.activityType) {
      pdf.text(`Activity Type: ${data.activityType}`, this.margins.left + 15, detailY);
    }

    return startY + 100;
  }

  addDebateTranscript(pdf, transcript, startY, contentWidth, pageWidth, pageHeight) {
    pdf.setTextColor(...this.colors.primary);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.text("TRANSCRIPT", this.margins.left, startY);
    
    startY += 35;

    const processedTranscript = this.processMarkdownContent(transcript);
    
    return this.addFormattedText(pdf, processedTranscript, startY, contentWidth, pageWidth, pageHeight);
  }

processMarkdownContent(content) {
  if (!content) return "No content available.";

  const renderer = new marked.Renderer();
 renderer.heading = (text, level) => {
    const cleanText = text.replace(/^#+\s*/, '');
    return `${cleanText}\n\n`;
  };
  renderer.paragraph = (text) => `${text}\\n\\n`;
  renderer.strong = (text) => `**${text}**`;
  renderer.em = (text) => `*${text}*`;
  renderer.list = (body, ordered) => `${body}\n`;
  renderer.listitem = (text) => {
    const cleanText = text.replace(/^[-*+•]\s*/, '').trim();
    return `• ${cleanText}\n`;
  };
  renderer.code = (code) => `[${code}]`;
  renderer.codespan = (code) => `[${code}]`;
  renderer.blockquote = (quote) => {
    const cleanQuote = quote.replace(/^["'>\s]*/, '').replace(/["'>\s]*$/, '').trim();
    return `"${cleanQuote}"\n\n`;
  };
  renderer.hr = () => `${'─'.repeat(50)}\n\n`;
  renderer.br = () => '\n';
  renderer.link = (href, title, text) => `${text} (${href})`;

  marked.setOptions({
    renderer: renderer,
    breaks: true,
    gfm: true
  });

  let processedContent = marked(content);

  processedContent = processedContent
    .replace(/&quot;/g, '"')    
    .replace(/%/g, '')                      
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/%20/g, ' ')
    .replace(/%([0-9A-Fa-f]{2})/g, (match, hex) => {
      try {
        return String.fromCharCode(parseInt(hex, 16));
      } catch (e) {
        return match; // og if decoding fails
      }
    })
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();

  return processedContent;
}

  addFormattedText(pdf, content, startY, contentWidth, pageWidth, pageHeight) {
    let currentY = startY;
    const lineHeight = 16;
    const paragraphSpacing = 8;
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();

      if (!line) {
        currentY += paragraphSpacing;
        continue;
      }

      if (currentY + 30 > pageHeight - this.margins.bottom) {
        pdf.addPage();
        currentY = this.margins.top;
      }

      const isMarkdownHeader = line.match(/^#{1,6}\s+/);
      const isAllCapsHeader = /^[A-Z][A-Z\s]{8,}$/.test(line) && line.length < 60 && !line.includes('.') && !line.includes(',');
      const isSectionHeader = line.match(/^(SECTION|CHAPTER|TITLE|PART)\s+[IVX\d]+/i) || 
                              line.match(/^(Executive Summary|Bill Details|Policy Analysis|Overall Assessment|Potential Benefits|Potential Concerns)$/);
      
      const isHeader = isMarkdownHeader || isAllCapsHeader || isSectionHeader;
      
      if (isHeader) {
        const headerText = line.replace(/^#+\s*/, ''); // Remove any hashtags
        
        currentY += 20; 
        
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        pdf.setTextColor(...this.colors.primary);
        
        const wrappedHeader = pdf.splitTextToSize(headerText, contentWidth);
        pdf.text(wrappedHeader, this.margins.left, currentY);
        currentY += wrappedHeader.length * 18 + 10;
        
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(11);
        pdf.setTextColor(...this.colors.dark);
        continue;
      }
      pdf.setFont('helvetica', 'normal');
      pdf.setgiFontSize(11);
      pdf.setTextColor(...this.colors.dark);

      line = this.processInlineFormatting(pdf, line);
      
      const wrappedLines = pdf.splitTextToSize(line, contentWidth);
      pdf.text(wrappedLines, this.margins.left, currentY);
      currentY += wrappedLines.length * lineHeight + 4;
    }

    return currentY;
  }

  processInlineFormatting(pdf, text) {
    // For now, remove markdown formatting for cleaner PDF
    return text
      .replace(/^#+\s*/, '')              // Remove hashtags if it somehow didn't do it yet
      .replace(/\*\*([^*]+)\*\*/g, '$1')  // Remove bold 
      .replace(/\*([^*]+)\*/g, '$1')      // Remove italic 
      .replace(/`([^`]+)`/g, '[$1]')      // Code to brackets
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // Links to text only
      .replace(/^[-*+]\s+/g, '• ')        // Consistent bullet points
      .replace(/^\d+\.\s+/g, '• ')        // Numbered lists to bullets
      .replace(/^>\s*/g, '"')             // Blockquotes to quotes
      .replace(/^["']\s*/, '"')           // Normalize quote marks
      .replace(/\s*["']$/, '"')           // Normalize ending quotes
      .replace(/\s+/g, ' ')               // Normalize whitespace
      .trim();
  }

  addFooter(pdf, _data) {
    const totalPages = pdf.internal.getNumberOfPages();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      
      pdf.setDrawColor(...this.colors.gray);
      pdf.setLineWidth(0.5);
      pdf.line(this.margins.left, pageHeight - this.margins.bottom + 20, 
               pageWidth - this.margins.right, pageHeight - this.margins.bottom + 20);
      
      pdf.setFontSize(10);
      pdf.setTextColor(...this.colors.gray);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Page ${i} of ${totalPages}`, 
               pageWidth - this.margins.right, 
               pageHeight - this.margins.bottom + 35, 
               { align: "right" });
      
      pdf.text("Generated by DebateSim • Bill and Legislation Analysis Platform", 
               this.margins.left, 
               pageHeight - this.margins.bottom + 35);
    }
  }

  getGradeColor(score) {
    if (score >= 90) return this.colors.success;
    if (score >= 70) return [32, 201, 151]; // Teal
    if (score >= 50) return this.colors.warning;
    if (score >= 30) return [253, 126, 20]; // Orange
    return this.colors.danger;
  }

  formatDebateMode(mode) {
    const modeMap = {
      'ai-vs-ai': 'AI vs AI',
      'ai-vs-user': 'AI vs User',
      'user-vs-user': 'User vs User',
      'bill-debate': 'Bill Debate'
    };
    return modeMap[mode] || mode;
  }

  generateFileName(topic, type) {
    const sanitizedTopic = (topic || 'document')
      .replace(/[^a-z0-9\s]/gi, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);
    
    const timestamp = new Date().toISOString().split('T')[0];
    return `${type}_${sanitizedTopic}_${timestamp}.pdf`;
  }
}
export default new PDFGenerator();