import { jsPDF } from "jspdf";
import { marked } from "marked";

/**
 * Professional PDF Generator for DebateSim Application
 * Handles all PDF generation needs with consistent, visually appealing formatting
 */

class PDFGenerator {
  constructor() {
    this.colors = {
      primary: [74, 144, 226],      // #4a90e2
      secondary: [108, 117, 125],   // #6c757d
      success: [40, 167, 69],       // #28a745
      warning: [255, 193, 7],       // #ffc107
      danger: [220, 53, 69],        // #dc3545
      dark: [52, 58, 64],           // #343a40
      light: [248, 249, 250],       // #f8f9fa
      white: [255, 255, 255],
      black: [0, 0, 0],
      gray: [108, 117, 125]
    };
    
    this.margins = {
      top: 80,
      right: 60,
      bottom: 80,
      left: 60
    };
  }

  /**
   * Generate a professional PDF for bill analysis
   */
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

    // Add professional header
    currentY = this.addAnalysisHeader(pdf, analysisData, currentY, pageWidth, contentWidth);
    
    // Add analysis grades section if available
    if (analysisData.grades) {
      currentY = this.addGradesSection(pdf, analysisData.grades, currentY, contentWidth, pageWidth, pageHeight);
    }
    
    // Add detailed analysis content
    currentY = this.addAnalysisContent(pdf, analysisData.content, currentY, contentWidth, pageWidth, pageHeight);
    
    // Add footer with metadata
    this.addFooter(pdf, analysisData);
    
    // Generate and download
    const fileName = this.generateFileName(analysisData.topic, 'analysis');
    pdf.save(fileName);
  }

  /**
   * Generate a professional PDF for debate transcripts
   */
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

    // Add debate header
    currentY = this.addDebateHeader(pdf, debateData, currentY, pageWidth, contentWidth);
    
    // Add debate setup information
    currentY = this.addDebateSetup(pdf, debateData, currentY, contentWidth, pageWidth, pageHeight);
    
    // Add debate transcript
    currentY = this.addDebateTranscript(pdf, debateData.transcript, currentY, contentWidth, pageWidth, pageHeight);
    
    // Add footer
    this.addFooter(pdf, debateData);
    
    // Generate and download
    const fileName = this.generateFileName(debateData.topic, 'debate');
    pdf.save(fileName);
  }

  /**
   * Add professional header for analysis PDFs
   */
  addAnalysisHeader(pdf, data, startY, pageWidth, contentWidth) {
    // Background header box
    pdf.setFillColor(...this.colors.primary);
    pdf.rect(0, 0, pageWidth, startY + 40, 'F');
    
    // Main title
    pdf.setTextColor(...this.colors.white);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(24);
    const title = "BILL ANALYSIS REPORT";
    const titleWidth = pdf.getStringUnitWidth(title) * 24 / pdf.internal.scaleFactor;
    pdf.text(title, (pageWidth - titleWidth) / 2, startY - 15);
    
    // Subtitle
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'normal');
    const subtitle = data.topic || "Legislative Analysis";
    const subtitleLines = pdf.splitTextToSize(subtitle, contentWidth - 40);
    pdf.text(subtitleLines, this.margins.left + 20, startY + 10);
    
    // Date and metadata
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
    
    return startY + 80;
  }

  /**
   * Add grades section with visual elements
   */
  addGradesSection(pdf, grades, startY, contentWidth, pageWidth, pageHeight) {
    // Check if we need a new page
    if (startY + 300 > pageHeight - this.margins.bottom) {
      pdf.addPage();
      startY = this.margins.top;
    }

    // Section header
    pdf.setTextColor(...this.colors.dark);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.text("ANALYSIS GRADES", this.margins.left, startY);
    
    startY += 35;

    // Grade categories with descriptions
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

    // Draw grades in a grid layout
    const cols = 2;
    const gradeBoxWidth = (contentWidth - 20) / cols;
    const gradeBoxHeight = 80;
    
    let col = 0;
    let row = 0;

    gradeCategories.forEach((category, index) => {
      const score = grades[category.key] || 0;
      const x = this.margins.left + (col * (gradeBoxWidth + 10));
      const y = startY + (row * (gradeBoxHeight + 15));

      // Draw grade box
      const boxColor = this.getGradeColor(score);
      pdf.setFillColor(...boxColor);
      pdf.setDrawColor(200, 200, 200);
      pdf.rect(x, y, gradeBoxWidth, gradeBoxHeight, 'FD');

      // Grade score (large)
      pdf.setTextColor(...this.colors.white);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(28);
      const scoreText = `${Math.round(score)}%`;
      const scoreWidth = pdf.getStringUnitWidth(scoreText) * 28 / pdf.internal.scaleFactor;
      pdf.text(scoreText, x + gradeBoxWidth - scoreWidth - 10, y + 35);

      // Category label
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

  /**
   * Add formatted analysis content
   */
  addAnalysisContent(pdf, content, startY, contentWidth, pageWidth, pageHeight) {
    // Section header
    pdf.setTextColor(...this.colors.dark);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.text("DETAILED ANALYSIS", this.margins.left, startY);
    
    startY += 35;

    // Process and format the content
    const processedContent = this.processMarkdownContent(content);
    
    return this.addFormattedText(pdf, processedContent, startY, contentWidth, pageWidth, pageHeight);
  }

  /**
   * Add debate header
   */
  addDebateHeader(pdf, data, startY, pageWidth, contentWidth) {
    // Background header box
    pdf.setFillColor(...this.colors.primary);
    pdf.rect(0, 0, pageWidth, startY + 40, 'F');
    
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
    
    // Date
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

  /**
   * Add debate setup information
   */
  addDebateSetup(pdf, data, startY, contentWidth, pageWidth, pageHeight) {
    if (startY + 100 > pageHeight - this.margins.bottom) {
      pdf.addPage();
      startY = this.margins.top;
    }

    // Setup box
    pdf.setFillColor(...this.colors.light);
    pdf.setDrawColor(...this.colors.gray);
    pdf.rect(this.margins.left, startY, contentWidth, 80, 'FD');

    // Setup header
    pdf.setTextColor(...this.colors.dark);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.text("DEBATE CONFIGURATION", this.margins.left + 15, startY + 20);

    // Setup details
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

  /**
   * Add formatted debate transcript
   */
  addDebateTranscript(pdf, transcript, startY, contentWidth, pageWidth, pageHeight) {
    // Section header
    pdf.setTextColor(...this.colors.dark);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.text("TRANSCRIPT", this.margins.left, startY);
    
    startY += 35;

    // Process transcript content
    const processedTranscript = this.processMarkdownContent(transcript);
    
    return this.addFormattedText(pdf, processedTranscript, startY, contentWidth, pageWidth, pageHeight);
  }

  /**
   * Process markdown content for better PDF formatting
   */
  processMarkdownContent(content) {
    if (!content) return "No content available.";

    // Configure marked for better PDF output
    const renderer = new marked.Renderer();
    
    renderer.heading = (text, level) => {
      const prefix = '### '.repeat(Math.min(level, 3));
      return `${prefix}${text}\n\n`;
    };
    
    renderer.paragraph = (text) => `${text}\n\n`;
    renderer.strong = (text) => `**${text}**`;
    renderer.em = (text) => `*${text}*`;
    renderer.list = (body, ordered) => `${body}\n`;
    renderer.listitem = (text) => `• ${text}\n`;
    renderer.code = (code) => `[${code}]`;
    renderer.codespan = (code) => `[${code}]`;
    renderer.blockquote = (quote) => `"${quote}"\n\n`;
    renderer.hr = () => `${'─'.repeat(50)}\n\n`;
    renderer.br = () => '\n';
    renderer.link = (href, title, text) => `${text} (${href})`;

    marked.setOptions({
      renderer: renderer,
      breaks: true,
      gfm: true
    });

    let processedContent = marked(content);
    
    // Clean up HTML entities and extra whitespace
    processedContent = processedContent
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();

    return processedContent;
  }

  /**
   * Add formatted text with proper styling and pagination
   */
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

      // Check if we need a new page
      if (currentY + 30 > pageHeight - this.margins.bottom) {
        pdf.addPage();
        currentY = this.margins.top;
      }

      // Handle headers
      if (line.startsWith('###')) {
        const headerText = line.replace(/^###\s*/, '');
        
        currentY += 20; // Space before header
        
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

      // Handle regular text with formatting
      line = this.processInlineFormatting(pdf, line);
      
      // Split long lines
      const wrappedLines = pdf.splitTextToSize(line, contentWidth);
      pdf.text(wrappedLines, this.margins.left, currentY);
      currentY += wrappedLines.length * lineHeight + 4;
    }

    return currentY;
  }

  /**
   * Process inline formatting (bold, italic, etc.)
   */
  processInlineFormatting(pdf, text) {
    // For now, remove markdown formatting for cleaner PDF
    return text
      .replace(/\*\*([^*]+)\*\*/g, '$1')  // Remove bold
      .replace(/\*([^*]+)\*/g, '$1')      // Remove italic
      .replace(/`([^`]+)`/g, '[$1]')      // Code to brackets
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // Links
      .replace(/^[-*+]\s+/g, '• ')        // List bullets
      .replace(/^\d+\.\s+/g, '• ');       // Numbered lists
  }

  /**
   * Add professional footer with page numbers and metadata
   */
  addFooter(pdf, data) {
    const totalPages = pdf.internal.getNumberOfPages();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      
      // Footer line
      pdf.setDrawColor(...this.colors.gray);
      pdf.setLineWidth(0.5);
      pdf.line(this.margins.left, pageHeight - this.margins.bottom + 20, 
               pageWidth - this.margins.right, pageHeight - this.margins.bottom + 20);
      
      // Page number
      pdf.setFontSize(10);
      pdf.setTextColor(...this.colors.gray);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Page ${i} of ${totalPages}`, 
               pageWidth - this.margins.right, 
               pageHeight - this.margins.bottom + 35, 
               { align: "right" });
      
      // App name and generation info
      pdf.text("Generated by DebateSim • Bill and Legislation Analysis Platform", 
               this.margins.left, 
               pageHeight - this.margins.bottom + 35);
    }
  }

  /**
   * Get color based on grade score
   */
  getGradeColor(score) {
    if (score >= 90) return this.colors.success;
    if (score >= 70) return [32, 201, 151]; // Teal
    if (score >= 50) return this.colors.warning;
    if (score >= 30) return [253, 126, 20]; // Orange
    return this.colors.danger;
  }

  /**
   * Format debate mode for display
   */
  formatDebateMode(mode) {
    const modeMap = {
      'ai-vs-ai': 'AI vs AI',
      'ai-vs-user': 'AI vs User',
      'user-vs-user': 'User vs User',
      'bill-debate': 'Bill Debate'
    };
    return modeMap[mode] || mode;
  }

  /**
   * Generate appropriate filename
   */
  generateFileName(topic, type) {
    const sanitizedTopic = (topic || 'document')
      .replace(/[^a-z0-9\s]/gi, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);
    
    const timestamp = new Date().toISOString().split('T')[0];
    return `${type}_${sanitizedTopic}_${timestamp}.pdf`;
  }
}

// Export a singleton instance
export default new PDFGenerator();