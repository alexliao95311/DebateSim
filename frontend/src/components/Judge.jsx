import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { getAIJudgeFeedback } from "../api";
import { saveTranscriptToUser } from "../firebase/saveTranscript";
import LoadingSpinner from "./LoadingSpinner";
import "./Judge.css";
import { useLocation, useNavigate } from "react-router-dom";
import ShareModal from "./ShareModal";

function Judge() {
  const location = useLocation();
  const navigate = useNavigate();
  
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
      <h1 className="main-heading">Debate Results</h1>
      <h2 className="sub-heading">Topic: {topic}</h2>
      
      <div className="debate-sections-container">
        <div className="debate-sections">
          <div className="transcript-section">
            <div className="section-header">
              <h2>Debate Transcript</h2>
              {billDescription && (
                <button 
                  className="toggle-bill-text" 
                  onClick={() => setShowBillText(!showBillText)}
                >
                  {showBillText ? "Hide Bill Text" : "Show Bill Text"}
                </button>
              )}
            </div>
            <div className="scrollable-content">
              <ReactMarkdown
                rehypePlugins={[rehypeRaw]}
                components={{
                  h1: ({node, ...props}) => <h1 className="debate-heading-h1" {...props} />,
                  h2: ({node, ...props}) => <h2 className="debate-heading-h2" {...props} />,
                  h3: ({node, ...props}) => <h3 className="debate-heading-h3" {...props} />,
                  h4: ({node, ...props}) => <h4 className="debate-heading-h4" {...props} />,
                  p: ({node, ...props}) => <p className="debate-paragraph" {...props} />,
                  ul: ({node, ...props}) => <ul className="debate-list" {...props} />,
                  ol: ({node, ...props}) => <ol className="debate-numbered-list" {...props} />,
                  li: ({node, ...props}) => <li className="debate-list-item" {...props} />,
                  strong: ({node, ...props}) => <strong className="debate-strong" {...props} />,
                  em: ({node, ...props}) => <em className="debate-emphasis" {...props} />,
                  hr: ({node, ...props}) => <hr className="divider" {...props} />
                }}
              >
                {formattedTranscript()}
              </ReactMarkdown>
            </div>
          </div>

          <div className="feedback-section">
            <h2>AI Judge Feedback</h2>
            <div className="scrollable-content">
              {!feedback ? (
                <LoadingSpinner 
                  message="Analyzing debate and generating judgment" 
                  showProgress={true}
                  estimatedTime={60000}
                />
              ) : (
                <div className="speech-block">
                  <h3>AI Judge:</h3>
                  <p className="model-info">Model: {judgeModel}</p>
                  <ReactMarkdown
                    rehypePlugins={[rehypeRaw]}
                    components={{
                      h1: ({node, ...props}) => <h1 className="debate-heading-h1" {...props} />,
                      h2: ({node, ...props}) => <h2 className="debate-heading-h2" {...props} />,
                      h3: ({node, ...props}) => <h3 className="debate-heading-h3" {...props} />,
                      h4: ({node, ...props}) => <h4 className="debate-heading-h4" {...props} />,
                      p: ({node, ...props}) => <p className="debate-paragraph" {...props} />,
                      ul: ({node, ...props}) => <ul className="debate-list" {...props} />,
                      ol: ({node, ...props}) => <ol className="debate-numbered-list" {...props} />,
                      li: ({node, ...props}) => <li className="debate-list-item" {...props} />,
                      strong: ({node, ...props}) => <strong className="debate-strong" {...props} />,
                      em: ({node, ...props}) => <em className="debate-emphasis" {...props} />,
                      hr: ({node, ...props}) => <hr className="divider" {...props} />
                    }}
                  >
                    {feedback}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>


      {error && <p className="error-text">{error}</p>}
      <div className="button-group">
        <button 
          className="share-button" 
          onClick={handleShare} 
          disabled={!feedback || !saved}
        >
          📤 Share Debate
        </button>
        <button className="home-button" onClick={handleBackToHome}>
          Back to Home
        </button>
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
    </div>
  );
}

export default Judge;