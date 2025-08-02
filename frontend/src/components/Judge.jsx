import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { getAIJudgeFeedback } from "../api";
import { saveTranscriptToUser } from "../firebase/saveTranscript";
import LoadingSpinner from "./LoadingSpinner";
import "./Judge.css";
import { useLocation, useNavigate } from "react-router-dom";
import ShareModal from "./ShareModal";
import { MessageSquare, Code, User, LogOut, ChevronDown, Menu } from "lucide-react";
import { getAuth, signOut } from "firebase/auth";

function Judge() {
  const location = useLocation();
  const navigate = useNavigate();
  const auth = getAuth();
  
  // Retrieve debate details from router state
  const { transcript, topic, mode, judgeModel } = location.state || {};

  // If required state is missing, redirect back to DebateSim
  if (!transcript || !topic || !mode || !judgeModel) {
    navigate("/debatesim");
    return null;
  }

  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [timestamp] = useState(() => new Date().toLocaleString());
  const [showBillText, setShowBillText] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [user, setUser] = useState(auth.currentUser);
  const [showMobileDropdown, setShowMobileDropdown] = useState(false);
  const dropdownRef = useRef(null);
  
  // Extract bill description from transcript
  const [billDescription, setBillDescription] = useState("");
  
  // Reset scroll position on component mount
  useEffect(() => {
    // Force scroll reset with slight delay to ensure it works after navigation
    const scrollTimer = setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }, 0);
    
    return () => clearTimeout(scrollTimer);
  }, []);

  // Handle click outside dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowMobileDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    // Extract bill description from transcript if it exists
    const billMatch = transcript.match(/## Bill Description\s+([\s\S]*?)(?:\n## |\n### |$)/);
    if (billMatch && billMatch[1]) {
      setBillDescription(billMatch[1].trim());
    }
    
    const fetchFeedback = async () => {
      try {
        const result = await getAIJudgeFeedback(transcript);
        setFeedback(result);
      } catch (err) {
        setError("Failed to fetch judge feedback. Please try again.");
      }
    };
    fetchFeedback();
  }, [transcript]);

  // Automatically save after feedback is rendered
  useEffect(() => {
    if (feedback && !saved && !saving) {
      const timer = setTimeout(() => {
        handleSaveTranscript();
      }, 100); // 100ms delay
      return () => clearTimeout(timer);
    }
  }, [feedback, saved, saving]);

  const handleSaveTranscript = async () => {
    if (!feedback || saved || saving) return;
    
    setSaving(true);
    setError("");
    try {
      // Create a combined transcript with judge feedback
      const combinedTranscript = `${transcript}

---

# AI Judge Feedback
*Model: ${judgeModel}*

${feedback}`;

      // Determine activity type based on topic content
      let activityType;
      if (topic.includes('Bill Analysis:')) {
        activityType = 'Analyze Bill';
      } else if (billDescription || topic.toLowerCase().includes('bill') || mode === 'bill-debate') {
        activityType = 'Debate Bill';
      } else {
        activityType = 'Debate Topic';
      }
      
      // Save using the improved saveTranscriptToUser function with model info
      await saveTranscriptToUser(combinedTranscript, topic, mode, activityType, null, judgeModel);
      console.log("Complete transcript with judge feedback saved!");
      setSaved(true);
    } catch (err) {
      console.error("Error saving transcript:", err);
      setError("Failed to save transcript. Please try again.");
    } finally {
      setSaving(false);
    }
  };



  const handleBackToHome = () => {
    navigate("/");
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleShare = () => {
    if (!feedback || !transcript) return;
    
    // Create a complete transcript with judge feedback
    const combinedTranscript = `${transcript}\n\n---\n\n## Judge Feedback\n\n${feedback}`;
    
    // Determine activity type based on topic content
    let activityType;
    if (topic.includes('Bill Analysis:')) {
      activityType = 'Analyze Bill';
    } else if (billDescription || topic.toLowerCase().includes('bill') || mode === 'bill-debate') {
      activityType = 'Debate Bill';
    } else {
      activityType = 'Debate Topic';
    }
    
    // Create transcript object for sharing
    const debateTranscript = {
      transcript: combinedTranscript,
      topic: topic,
      mode: mode,
      activityType: activityType,
      model: judgeModel,
      createdAt: new Date().toISOString()
    };
    
    // Use the same sharing mechanism as the Legislation component
    setShowShareModal(true);
  };

  // Format transcript to hide bill description unless requested
  const formattedTranscript = () => {
    if (!billDescription || showBillText) {
      return transcript;
    }
    // Remove the "## Bill Description" section from Markdown
    return transcript.replace(
      /## Bill Description\s+[\s\S]*?(?=\n## |\n### |$)/,
      ''
    );
  };

  return (
    <div className="judge-container">
      <header className="judge-header">
        <div className="judge-header-content">
          <div className="judge-header-left">
            <button 
              className="judge-back-button"
              onClick={() => navigate("/")}
            >
              ← Home
            </button>
          </div>

          <div className="judge-header-center">
            <h1 className="judge-site-title" onClick={() => navigate("/")}>
              Judge Results
            </h1>
          </div>

          <div className="judge-header-right">
            {/* Desktop user section */}
            <div className="judge-user-section judge-desktop-user">
              <div className="judge-user-info">
                <User size={18} />
                <span>{user?.displayName || "Guest"}</span>
              </div>
              <button className="judge-logout-button" onClick={handleLogout}>
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            </div>

            {/* Mobile dropdown */}
            <div className="judge-mobile-dropdown-container" ref={dropdownRef}>
              <button
                className="judge-mobile-dropdown-trigger"
                onClick={() => setShowMobileDropdown(!showMobileDropdown)}
              >
                <Menu size={18} />
                <ChevronDown size={16} className={`judge-dropdown-arrow ${showMobileDropdown ? 'rotated' : ''}`} />
              </button>

              {showMobileDropdown && (
                <div className="judge-mobile-dropdown-menu">
                  <div className="judge-dropdown-user-info">
                    <User size={16} />
                    <span>{user?.displayName || "Guest"}</span>
                  </div>
                  <button
                    className="judge-dropdown-option judge-dropdown-logout"
                    onClick={() => {
                      handleLogout();
                      setShowMobileDropdown(false);
                    }}
                  >
                    <LogOut size={16} />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="judge-main-content">
        <h1 className="judge-main-heading">Debate Results</h1>
        <h2 className="judge-sub-heading">Topic: {topic}</h2>
      
      <div className="judge-sections-container">
        <div className="judge-sections">
          <div className="judge-transcript-section">
            <div className="judge-section-header">
              <h2 className="judge-section-title">Debate Transcript</h2>
              {billDescription && (
                <button 
                  className="judge-toggle-bill-text" 
                  onClick={() => setShowBillText(!showBillText)}
                >
                  {showBillText ? "Hide Bill Text" : "Show Bill Text"}
                </button>
              )}
            </div>
            <div className="judge-scrollable-content">
              <ReactMarkdown
                rehypePlugins={[rehypeRaw]}
                components={{
                  h1: ({node, ...props}) => <h1 className="judge-markdown-h1" {...props} />,
                  h2: ({node, ...props}) => <h2 className="judge-markdown-h2" {...props} />,
                  h3: ({node, ...props}) => <h3 className="judge-markdown-h3" {...props} />,
                  h4: ({node, ...props}) => <h4 className="judge-markdown-h4" {...props} />,
                  p: ({node, ...props}) => <p className="judge-markdown-p" {...props} />,
                  ul: ({node, ...props}) => <ul className="judge-markdown-ul" {...props} />,
                  ol: ({node, ...props}) => <ol className="judge-markdown-ol" {...props} />,
                  li: ({node, ...props}) => <li className="judge-markdown-li" {...props} />,
                  strong: ({node, ...props}) => <strong className="judge-markdown-strong" {...props} />,
                  em: ({node, ...props}) => <em className="judge-markdown-em" {...props} />,
                  hr: ({node, ...props}) => <hr className="judge-markdown-hr" {...props} />
                }}
              >
                {formattedTranscript()}
              </ReactMarkdown>
            </div>
          </div>

          <div className="judge-feedback-section">
            <h2 className="judge-section-title">AI Judge Feedback</h2>
            <div className="judge-scrollable-content">
              {!feedback ? (
                <LoadingSpinner 
                  message="Analyzing debate and generating judgment" 
                  showProgress={true}
                  estimatedTime={60000}
                />
              ) : (
                <>
                  <h3 className="judge-speech-title">AI Judge:</h3>
                  <p className="judge-model-info">Model: {judgeModel}</p>
                  <ReactMarkdown
                    rehypePlugins={[rehypeRaw]}
                    components={{
                      h1: ({node, ...props}) => <h1 className="judge-markdown-h1" {...props} />,
                      h2: ({node, ...props}) => <h2 className="judge-markdown-h2" {...props} />,
                      h3: ({node, ...props}) => <h3 className="judge-markdown-h3" {...props} />,
                      h4: ({node, ...props}) => <h4 className="judge-markdown-h4" {...props} />,
                      p: ({node, ...props}) => <p className="judge-markdown-p" {...props} />,
                      ul: ({node, ...props}) => <ul className="judge-markdown-ul" {...props} />,
                      ol: ({node, ...props}) => <ol className="judge-markdown-ol" {...props} />,
                      li: ({node, ...props}) => <li className="judge-markdown-li" {...props} />,
                      strong: ({node, ...props}) => <strong className="judge-markdown-strong" {...props} />,
                      em: ({node, ...props}) => <em className="judge-markdown-em" {...props} />,
                      hr: ({node, ...props}) => <hr className="judge-markdown-hr" {...props} />
                    }}
                  >
                    {feedback}
                  </ReactMarkdown>
                </>
              )}
            </div>
          </div>
        </div>
        </div>

        {error && <p className="judge-error-text">{error}</p>}
        <div className="judge-button-group">
          <button 
            className="judge-share-button" 
            onClick={handleShare} 
            disabled={!feedback || !saved}
          >
            📤 Share Debate
          </button>
          <button className="judge-home-button" onClick={handleBackToHome}>
            Back to Home
          </button>
        </div>
      </div>
      
      {/* Share Modal */}
      {showShareModal && (
        <ShareModal 
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          transcript={{
            transcript: `${transcript}\n\n---\n\n## Judge Feedback\n\n${feedback}`,
            topic: topic,
            mode: mode,
            activityType: topic.includes('Bill Analysis:') ? 'Analyze Bill' : 
                         (billDescription || topic.toLowerCase().includes('bill') || mode === 'bill-debate') ? 'Debate Bill' : 'Debate Topic',
            model: judgeModel,
            createdAt: new Date().toISOString()
          }}
          transcriptId={null}
        />
      )}
      
      <footer className="bottom-text">
        <div className="footer-links">
          <a
            href="https://docs.google.com/forms/d/e/1FAIpQLSf_bXEj_AJSyY17WA779h-ESk4om3QmPFT4sdyce7wcnwBr7Q/viewform?usp=sharing&ouid=109634392449391866526"
            target="_blank"
            rel="noopener noreferrer"
            className="feedback-link"
          >
            <MessageSquare size={16} />
            Give Feedback
          </a>
          <a
            href="https://github.com/alexliao95311/DebateSim"
            target="_blank"
            rel="noopener noreferrer"
            className="github-link"
          >
            <Code size={16} />
            GitHub
          </a>
        </div>
        <span className="copyright">&copy; {new Date().getFullYear()} DebateSim. All rights reserved.</span>
      </footer>
    </div>
  );
}

export default Judge;