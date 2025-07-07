// components/ShareModal.jsx
import React, { useState } from "react";
import { shareTranscript, unshareTranscript } from "../firebase/shareTranscript";
import "./ShareModal.css";

function ShareModal({ isOpen, onClose, transcript, transcriptId }) {
  const [shareUrl, setShareUrl] = useState(transcript?.shareId ? `${window.location.origin}/shared/${transcript.shareId}` : "");
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);

  const handleShare = async () => {
    setIsSharing(true);
    setError("");
    
    try {
      const result = await shareTranscript(transcriptId, transcript);
      setShareUrl(result.shareUrl);
    } catch (err) {
      setError("Failed to share transcript. Please try again.");
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
      setError("Failed to unshare transcript. Please try again.");
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

          {!shareUrl ? (
            <div className="share-actions">
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