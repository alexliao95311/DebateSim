// components/ShareModal.jsx
import React, { useState } from "react";
import { shareTranscript, unshareTranscript } from "../firebase/shareTranscript";
import { jsPDF } from "jspdf";
import { marked } from 'marked';
import "./ShareModal.css";

function ShareModal({ isOpen, onClose, transcript, transcriptId }) {
  const [shareUrl, setShareUrl] = useState(transcript?.shareId ? `${window.location.origin}/shared/${transcript.shareId}` : "");
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);
  const [pdfError, setPdfError] = useState("");

  const handleShare = async () => {
    setIsSharing(true);
    setError("");
    
    try {
      const result = await shareTranscript(transcriptId, transcript);
      setShareUrl(result.shareUrl);
    } catch (err) {
      if (err.message && err.message.includes("too old or corrupted")) {
        setError(err.message);
      } else if (err.message && err.message.includes("logged in")) {
          setError("You must be logged in to share transcripts.");
      } else {
        setError("Failed to share transcript. Please try again.");
      }
      console.error("Share error:", err);
    } finally {
      setIsSharing(false);
    }
  };

  const handleUnshare = async () => {
    setIsSharing(true);
    setError("");
    
    try {
      await unshareTranscript(transcriptId, transcript.shareId);
      setShareUrl("");
    } catch (err) {
      if (err.message && err.message.includes("too old or corrupted")) {
        setError(err.message);
      } else if (err.message && err.message.includes("logged in")) {
          setError("You must be logged in to unshare transcripts.");
      } else {
        setError("Failed to unshare transcript. Please try again.");
      }
      console.error("Unshare error:", err);
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  const handleSocialShare = (platform) => {
    const text = `Check out this debate transcript: ${transcript.topic}`;
    const url = shareUrl;
    
    let shareLink = "";
    switch (platform) {
      case "twitter":
        shareLink = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
        break;
      case "facebook":
        shareLink = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
        break;
      case "linkedin":
        shareLink = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
        break;
      case "reddit":
        shareLink = `https://reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`;
        break;
      default:
        return;
    }
    
    window.open(shareLink, "_blank", "width=600,height=400");
  };

  const handleDownloadPDF = () => {
    if (!transcript) return;
    
    setPdfError("");
    try {
      // Get the raw markdown content
      let markdownContent = transcript.transcript || "No content available.";
      
      // Decode HTML entities
      const decodeHtmlEntities = (text) => {
        const textArea = document.createElement('textarea');
        textArea.innerHTML = text;
        return textArea.value;
      };
      
      // Decode HTML entities in the content
      markdownContent = decodeHtmlEntities(markdownContent);
      
      // Configure marked to convert markdown to clean plain text
      const renderer = new marked.Renderer();
      renderer.heading = (text, level) => {
        const cleanText = decodeHtmlEntities(text);
        return `${'#'.repeat(level)} ${cleanText}\n\n`;
      };
      renderer.paragraph = (text) => {
        const cleanText = decodeHtmlEntities(text);
        return `${cleanText}\n\n`;
      };
      renderer.strong = (text) => {
        const cleanText = decodeHtmlEntities(text);
        return cleanText; // Remove bold formatting for cleaner text
      };
      renderer.em = (text) => {
        const cleanText = decodeHtmlEntities(text);
        return cleanText; // Remove italic formatting for cleaner text
      };
      renderer.list = (body, ordered) => `${body}\n`;
      renderer.listitem = (text) => {
        const cleanText = decodeHtmlEntities(text);
        return `• ${cleanText}\n`;
      };
      renderer.code = (code) => decodeHtmlEntities(code);
      renderer.codespan = (code) => decodeHtmlEntities(code);
      renderer.blockquote = (quote) => {
        const cleanText = decodeHtmlEntities(quote);
        return `"${cleanText}"\n\n`;
      };
      renderer.hr = () => `${'─'.repeat(50)}\n\n`;
      renderer.br = () => '\n';
      renderer.link = (href, title, text) => {
        const cleanText = decodeHtmlEntities(text);
        return `${cleanText} (${href})`;
      };
      
      marked.setOptions({
        renderer: renderer,
        breaks: true,
        gfm: true
      });

      // Convert markdown to formatted text and clean up
      let formattedText = marked(markdownContent);
      
      // Additional cleanup for better formatting
      formattedText = formattedText
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/\n\s*\n\s*\n/g, '\n\n') // Remove unecessary line breaks
        .trim();
      
      // Create PDF with better text handling, resolves previous issues for pdfs
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "letter",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margins = { top: 60, right: 60, bottom: 80, left: 60 };
      const maxWidth = pageWidth - margins.left - margins.right;
      
      // Add header
      pdf.setFontSize(16);
      pdf.setFont(undefined, 'bold');
      const title = transcript.topic || "Activity Transcript";
      pdf.text(title, margins.left, margins.top);
      
      // Add metadata
      pdf.setFontSize(10);
      pdf.setFont(undefined, 'normal');
      pdf.setTextColor(100);
      const date = transcript.createdAt ? new Date(transcript.createdAt).toLocaleDateString() : new Date().toLocaleDateString();
      let metaInfo = `Generated on ${date}`;
      if (transcript.model) {
        metaInfo += ` • Model: ${transcript.model}`;
      }
      pdf.text(metaInfo, margins.left, margins.top + 25);
      
      // Add separator line
      pdf.setLineWidth(0.5);
      pdf.setDrawColor(200);
      pdf.line(margins.left, margins.top + 35, pageWidth - margins.right, margins.top + 35);
      
      // Reset for content
      pdf.setTextColor(0);
      pdf.setFontSize(11);
      let currentY = margins.top + 55;
      
      // Split content into lines and add to PDF with improved processing
      const lines = formattedText.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        
        if (!line) {
          currentY += 8; // Add space for empty lines
          continue;
        }
        
        // Handle headers (lines starting with #)
        if (line.startsWith('#')) {
          const headerLevel = line.match(/^#+/)[0].length;
          const headerText = line.replace(/^#+\s*/, '');
          
          // Add some space before headers (except first one)
          if (currentY > margins.top + 55) {
            currentY += 15;
          }
          
          pdf.setFont(undefined, 'bold');
          pdf.setFontSize(headerLevel === 1 ? 14 : headerLevel === 2 ? 12 : 11);
          
          // Check if we need a new page
          if (currentY + 20 > pageHeight - margins.bottom) {
            pdf.addPage();
            currentY = margins.top;
          }
          
          const wrappedHeader = pdf.splitTextToSize(headerText, maxWidth);
          pdf.text(wrappedHeader, margins.left, currentY);
          currentY += wrappedHeader.length * (headerLevel === 1 ? 18 : headerLevel === 2 ? 16 : 14) + 8;
          
          pdf.setFont(undefined, 'normal');
          pdf.setFontSize(11);
          continue;
        }
        
        // Simplified text processing - remove all markdown formatting
        line = line
          .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
          .replace(/\*([^*]+)\*/g, '$1') // Remove italic
          .replace(/`([^`]+)`/g, '$1') // Remove code
          .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links, keep text
          .replace(/^[-*+]\s+/g, '• ') // Convert list markers to bullets
          .replace(/^\d+\.\s+/g, '• '); // Convert numbered lists to bullets
        
        // Check if we need a new page
        if (currentY > pageHeight - margins.bottom) {
          pdf.addPage();
          currentY = margins.top;
        }
        
        // Split long lines and add to PDF
        const wrappedLines = pdf.splitTextToSize(line, maxWidth);
        pdf.text(wrappedLines, margins.left, currentY);
        currentY += wrappedLines.length * 14 + 4;
      }
      
      // Add page numbers
      const totalPages = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(9);
        pdf.setTextColor(120);
        pdf.text(
          `Page ${i} of ${totalPages}`,
          pageWidth - margins.right,
          pageHeight - 20,
          { align: "right" }
        );
      }
      
      // Generate filename
      const fileName = transcript.topic 
        ? `${transcript.topic.replace(/[^a-z0-9]/gi, '_')}_transcript.pdf`
        : `activity_transcript_${Date.now()}.pdf`;
      
      pdf.save(fileName);
      
    } catch (err) {
      setPdfError("Failed to generate PDF. Please try again.");
      console.error("PDF generation error:", err);
    }
  };

  if (!isOpen || !transcript) return null;

  return (
    <div className="share-modal-overlay" onClick={onClose}>
      <div className="share-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="share-modal-header">
          <h3>Share Debate Transcript</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="share-modal-body">
          <div className="transcript-preview">
            <h4>{transcript.topic}</h4>
            <p className="transcript-meta">
              {transcript.mode} • {new Date(transcript.createdAt).toLocaleDateString()}
            </p>
          </div>

          {error && <p className="error-message">{error}</p>}
          {pdfError && <p className="error-message">{pdfError}</p>}

          {/* PDF Download Section */}
          <div className="download-section">
            <h4>Download Options</h4>
            <button 
              className="download-button pdf"
              onClick={handleDownloadPDF}
            >
              📄 Download as PDF
            </button>
          </div>

          {!shareUrl ? (
            <div className="share-actions">
              <h4>Online Sharing</h4>
              <p>Share this transcript publicly so others can view it with a link.</p>
              <button 
                className="share-button primary"
                onClick={handleShare}
                disabled={isSharing}
              >
                {isSharing ? "Creating Share Link..." : "Create Share Link"}
              </button>
            </div>
          ) : (
            <div className="share-actions">
              <h4>Online Sharing</h4>
              <p>This transcript is now publicly shareable:</p>
              
              <div className="share-link-container">
                <input 
                  type="text" 
                  value={shareUrl} 
                  readOnly 
                  className="share-link-input"
                />
                <button 
                  className="copy-button"
                  onClick={handleCopyLink}
                >
                  {copySuccess ? "Copied!" : "Copy"}
                </button>
              </div>

              <div className="social-share-buttons">
                <button 
                  className="social-button twitter"
                  onClick={() => handleSocialShare("twitter")}
                >
                  <span>𝕏</span> Twitter
                </button>
                <button 
                  className="social-button facebook"
                  onClick={() => handleSocialShare("facebook")}
                >
                  <span>f</span> Facebook
                </button>
                <button 
                  className="social-button linkedin"
                  onClick={() => handleSocialShare("linkedin")}
                >
                  <span>in</span> LinkedIn
                </button>
                <button 
                  className="social-button reddit"
                  onClick={() => handleSocialShare("reddit")}
                >
                  <span>r</span> Reddit
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ShareModal;
