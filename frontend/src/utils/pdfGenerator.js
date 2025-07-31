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
  const title = "BILL ANALYSIS REPORT";
  let titleFontSize = 24;

  // calcs title width, also shrinks font
  pdf.setFont('helvetica', 'bold');
  let titleWidth = pdf.getStringUnitWidth(title) * titleFontSize / pdf.internal.scaleFactor;
  while (titleWidth > pageWidth - 40 && titleFontSize > 14) {
    titleFontSize--;
    titleWidth = pdf.getStringUnitWidth(title) * titleFontSize / pdf.internal.scaleFactor;
  }

  // Subtitle and meta info
  const subtitle = (data.topic || "Legislative Analysis")
    .replace(/["'%]/g, '')
    .replace(/[^\w\s\-.,!?;:()]/g, '')  
    .trim();

  const subtitleFontSize = 14;
  pdf.setFontSize(subtitleFontSize);
  pdf.setFont('helvetica', 'normal');
  const subtitleLines = pdf.splitTextToSize(subtitle, contentWidth - 40);
  const subtitleHeight = subtitleLines.length * (subtitleFontSize + 2); // approx line height

  const hasModel = !!data.model;
  const metaLines = hasModel ? 2 : 1;
  const metaLineHeight = 12;
  const metaHeight = metaLines * metaLineHeight;

  // padding + title + subtitle + meta info
  const paddingTop = 20;
  const paddingBottom = 20;
  const spacing = 10;

  const headerHeight = paddingTop + titleFontSize + spacing + subtitleHeight + spacing + metaHeight + paddingBottom;

  // background
  pdf.setFillColor(...this.colors.primary);
  pdf.rect(0, 0, pageWidth, startY + headerHeight, 'F');

  // title
  pdf.setTextColor(...this.colors.white);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(titleFontSize);
  pdf.text(title, (pageWidth - titleWidth) / 2, startY + paddingTop + titleFontSize);

  // subtitle
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(subtitleFontSize);
  pdf.text(subtitleLines, this.margins.left + 20, startY + paddingTop + titleFontSize + spacing + 5);

  // date and model name
  pdf.setFontSize(10);
  const dateY = startY + paddingTop + titleFontSize + spacing + subtitleHeight + spacing + 5;
  const date = new Date(data.createdAt || Date.now()).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  pdf.text(`Generated: ${date}`, this.margins.left + 20, dateY);
  if (data.model) {
    pdf.text(`AI Model: ${data.model}`, this.margins.left + 20, dateY + metaLineHeight);
  }

  return startY + headerHeight + 10;
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
    const headerHeight = data.model ? 85 : 70;
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
    const topic = (data.topic || "Debate Topic")
      .replace(/["'%]/g, '')
      .replace(/[^\w\s\-.,!?;:()]/g, '')  
      .trim();
    const topicLines = pdf.splitTextToSize(topic, contentWidth - 40);
    pdf.text(topicLines, this.margins.left + 20, startY + 15);
    
    pdf.setFontSize(10);
    const date = new Date(data.createdAt || Date.now()).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    pdf.text(`Generated: ${date}`, this.margins.left + 20, startY + 35); 
    if (data.model) {
      pdf.text(`AI Model: ${data.model}`, this.margins.left + 20, startY + 50); 
    }
    
    return startY + headerHeight + 25;
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
    const cleanText = text.replace(/^#+\s*/, '').trim();
    return `HEADING_${level}:${cleanText}\n\n`;
  };
  renderer.paragraph = (text) => `${text}\n\n`;
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
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/%20/g, ' ')
    .replace(/%([0-9A-Fa-f]{2})/g, (match, hex) => {
      try {
        const decoded = String.fromCharCode(parseInt(hex, 16));
        if (decoded.match(/[a-zA-Z0-9\s\-_.,!?;:()]/)) {
          return decoded;
        }
        return match;
      } catch (e) {
        return match; // og if decoding fails
      }
    })
    .replace(/(?<!%[0-9A-Fa-f])%(?![0-9A-Fa-f]{2})(?!\d)/g, '')
    .replace(/%+\s*$/gm, '')
    // Remove random percent signs 
    .replace(/\b%+\b(?!\d)/g, '')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();

  return processedContent;
}

  addFormattedText(pdf, content, startY, contentWidth, pageWidth, pageHeight) {
    let currentY = startY;
    const lineHeight = 16;
    const paragraphSpacing = 12;
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();

      if (!line) {
        currentY += paragraphSpacing;
        continue;
      }

      if (currentY + 40 > pageHeight - this.margins.bottom) {
        pdf.addPage();
        currentY = this.margins.top;
      }
      const headingMatch = line.match(/^HEADING_(\d+):(.+)$/);
      const isMarkdownHeader = line.match(/^#{1,6}\s+/);
      const isAllCapsHeader = /^[A-Z][A-Z\s]{8,}$/.test(line) && line.length < 60 && !line.includes('.') && !line.includes(',');
      const isSectionHeader = line.match(/^(SECTION|CHAPTER|TITLE|PART)\s+[IVX\d]+/i) || 
                              line.match(/^(Executive Summary|Bill Details|Policy Analysis|Overall Assessment|Potential Benefits|Potential Concerns|Key Provisions|Implementation Timeline|Fiscal Impact|Legal Framework)$/i);
      
      const isHeader = headingMatch || isMarkdownHeader || isAllCapsHeader || isSectionHeader;
      
      if (isHeader) {
        let headerText;
        let fontSize;

        
        if (headingMatch) {
          const level = parseInt(headingMatch[1]);
          headerText = headingMatch[2].trim();
          fontSize = Math.max(16, 20 - (level * 2));
        } else {
          headerText = line.replace(/^#+\s*/, '').trim();
          fontSize = 16;
        }
        currentY += 25; 
        
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(fontSize);
        pdf.setTextColor(...this.colors.primary);
        
        const wrappedHeader = pdf.splitTextToSize(headerText, contentWidth);
        pdf.text(wrappedHeader, this.margins.left, currentY);
        if (fontSize >= 16) {
          const headerWidth = Math.max(...wrappedHeader.map(h => pdf.getStringUnitWidth(h) * fontSize / pdf.internal.scaleFactor));
          pdf.setDrawColor(...this.colors.primary);
          pdf.setLineWidth(1);
          pdf.line(this.margins.left, currentY + 5, this.margins.left + headerWidth, currentY + 5);
        }
        currentY += wrappedHeader.length * (fontSize + 4) + 15;

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(11);
        pdf.setTextColor(...this.colors.text);
        continue;
      }

      if (line.startsWith('• ')) {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(11);
        pdf.setTextColor(...this.colors.text);
        
        const bulletText = line.substring(2).trim();
        const wrappedBullet = pdf.splitTextToSize(bulletText, contentWidth - 20);
        
        pdf.text('•', this.margins.left, currentY);
        
        // indent
        pdf.text(wrappedBullet, this.margins.left + 15, currentY);
        currentY += wrappedBullet.length * lineHeight + 6;
        continue;
      }
      pdf.setFont('helvetica', 'normal');
      pdf.setgiFontSize(11);
      pdf.setTextColor(...this.colors.text);

      line = this.processInlineFormatting(pdf, line);
      
      const wrappedLines = pdf.splitTextToSize(line, contentWidth);
      pdf.text(wrappedLines, this.margins.left, currentY);
      currentY += wrappedLines.length * lineHeight + 8;
    }

    return currentY;
  }

  processInlineFormatting(pdf, text) {
    // For now, remove markdown formatting for cleaner PDF
    return text
      .replace(/^#+\s*/, '')                    // remove remaining hashtags
      .replace(/\*\*([^*]+)\*\*/g, '$1')        // remove bold markdown but keep text
      .replace(/\*([^*]+)\*/g, '$1')            // remove italic markdown but keep text
      .replace(/`([^`]+)`/g, '[$1]')            
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // remove urls
      .replace(/^[-*+]\s+/g, '• ')              //  bullet points
      .replace(/^\d+\.\s+/g, '• ')              // numbered lists to bullets
      .replace(/^>\s*/g, '"')                   // blockquotes to quotes
      .replace(/^["']\s*/, '"')                 
      .replace(/\s*["']$/, '"')                 
      .replace(/\s+/g, ' ')                     //  whitespace
      .replace(/[""]/g, '"')                    //  smart quotes to regular quotes
      .replace(/['']/g, "'")                    //  smart apostrophes
      .replace(/–/g, '-')                       //  en-dash to hyphen
      .replace(/—/g, '-')                       //  em-dash to hyphen
      .replace(/…/g, '...')                     //  ellipsis
      .replace(/[\u2000-\u200B\u2028-\u2029]/g, ' ') // Remove unicode spaces
      .replace(/%+(?!\d)/g, '')                 // Remove percent signs not followed by digits
      .replace(/\s%+\s/g, ' ')     
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