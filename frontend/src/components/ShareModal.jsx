// components/ShareModal.jsx
import React, { useState, useEffect } from "react";
import { shareTranscript, unshareTranscript } from "../firebase/shareTranscript";
import { marked } from 'marked';
import PDFGenerator from "../utils/pdfGenerator";
import { useTranslation } from '../utils/translations';
import "./ShareModal.css";

function ShareModal({ isOpen, onClose, transcript, transcriptId, isSimulatedDebate = false }) {
  const { t } = useTranslation();
  const [shareUrl, setShareUrl] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);
  const [pdfError, setPdfError] = useState("");

  // Reset share URL when transcript changes
  useEffect(() => {
    if (transcript?.shareId) {
      setShareUrl(`${window.location.origin}/shared/${transcript.shareId}`);
    } else {
      setShareUrl("");
    }
    // Reset other states when transcript changes
    setError("");
    setCopySuccess(false);
    setPdfError("");
  }, [transcript?.id, transcript?.shareId]);

  // Reset states when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      // Clear temporary states when modal closes
      setError("");
      setCopySuccess(false);
      setPdfError("");
      setIsSharing(false);
    }
  }, [isOpen]);

  const handleShare = async () => {
    setIsSharing(true);
    setError("");

    try {
      const result = await shareTranscript(transcriptId, transcript, isSimulatedDebate);
      setShareUrl(result.shareUrl);
    } catch (err) {
      if (err.message && err.message.includes("too old or corrupted")) {
        setError(err.message);
      } else if (err.message && err.message.includes("logged in")) {
          setError(t('shareModal.mustLogin'));
      } else {
        setError(t('shareModal.failedShare'));
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
          setError(t('shareModal.mustLogin'));
      } else {
        setError(t('shareModal.failedUnshare'));
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



  const handleDownloadPDF = () => {
    if (!transcript) return;
    
    setPdfError("");
    try {
      const pdfData = {
        topic: transcript.topic || "Activity Transcript",
        transcript: transcript.transcript || "No content available.",
        mode: transcript.mode,
        activityType: transcript.activityType,
        model: transcript.model,
        createdAt: transcript.createdAt
      };

      // check which type
      if (transcript.activityType === 'Analyze Bill') {
        PDFGenerator.generateAnalysisPDF({
          topic: transcript.topic,
          content: transcript.transcript,
          grades: transcript.grades,
          model: transcript.model,
          createdAt: transcript.createdAt
        });
      } else {
        PDFGenerator.generateDebatePDF(pdfData);
      }     
    } catch (err) {
      setPdfError(t('shareModal.failedPDF'));
      console.error("PDF generation error:", err);
    }
  };

  if (!isOpen || !transcript) return null;

  return (
    <div className="share-modal-overlay" onClick={onClose}>
      <div className="share-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="share-modal-header">
          <h3>{t('shareModal.title')}</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="share-modal-body">
          <div className="transcript-preview">
            <h4>{transcript.topic}</h4>
            <p className="transcript-meta centered">
              {transcript.mode} • {(() => {
                if (!transcript.createdAt) return 'No date';
                try {
                  // Handle Firestore timestamp
                  if (transcript.createdAt?.toDate) {
                    return transcript.createdAt.toDate().toLocaleDateString();
                  }
                  // Handle ISO string or regular date
                  const date = new Date(transcript.createdAt);
                  if (isNaN(date.getTime())) return 'Invalid date';
                  return date.toLocaleDateString();
                } catch (e) {
                  return 'Invalid date';
                }
              })()}
            </p>
          </div>

          {error && <p className="error-message">{error}</p>}
          {pdfError && <p className="error-message">{pdfError}</p>}

          {/* PDF Download Section */}
          <div className="download-section">
            <h4>{t('shareModal.downloadOptions')}</h4>
            <button 
              className="download-button pdf"
              onClick={handleDownloadPDF}
            >
              📄 {t('shareModal.downloadPDF')}
            </button>
          </div>

          {!shareUrl ? (
            <div className="share-actions">
              <h4>{t('shareModal.onlineSharing')}</h4>
              <p>{t('shareModal.shareDescription')}</p>
              <button 
                className="share-button primary"
                onClick={handleShare}
                disabled={isSharing}
              >
                {isSharing ? t('shareModal.creatingLink') : t('shareModal.createLink')}
              </button>
            </div>
          ) : (
            <div className="share-actions">
              <h4>{t('shareModal.onlineSharing')}</h4>
              <p>{t('shareModal.shareable')}</p>
              
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
                  {copySuccess ? t('shareModal.copied') : t('shareModal.copy')}
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
