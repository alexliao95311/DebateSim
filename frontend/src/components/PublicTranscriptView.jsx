// components/PublicTranscriptView.jsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { getSharedTranscript } from "../firebase/shareTranscript";
import LoadingSpinner from "./LoadingSpinner";
import "./PublicTranscriptView.css";

function PublicTranscriptView() {
  const { shareId } = useParams();
  const navigate = useNavigate();
  const [transcript, setTranscript] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchSharedTranscript = async () => {
      try {
        setLoading(true);
        const sharedTranscript = await getSharedTranscript(shareId);
        
        if (sharedTranscript) {
          setTranscript(sharedTranscript);
        } else {
          setError("This transcript is no longer available or the link is invalid.");
        }
      } catch (err) {
        console.error("Error fetching shared transcript:", err);
        setError("Failed to load the shared transcript. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    if (shareId) {
      fetchSharedTranscript();
    }
  }, [shareId]);

  const handleBackToHome = () => {
    navigate("/debatesim");
  };

  if (loading) {
    return (
      <div className="public-transcript-container">
        <header className="home-header">
          <div className="header-content">
            <div className="header-center">
              <h1 onClick={handleBackToHome} style={{ cursor: "pointer" }}>
                Debate Simulator
              </h1>
            </div>
            <div className="header-right">
              <button className="home-button" onClick={handleBackToHome}>
                Try DebateSim
              </button>
            </div>
          </div>
        </header>
        <div className="main-content">
          <LoadingSpinner message="Loading shared transcript..." />
        </div>
      </div>
    );
  }

  if (error || !transcript) {
    return (
      <div className="public-transcript-container">
        <header className="home-header">
          <div className="header-content">
            <div className="header-center">
              <h1 onClick={handleBackToHome} style={{ cursor: "pointer" }}>
                Debate Simulator
              </h1>
            </div>
            <div className="header-right">
              <button className="home-button" onClick={handleBackToHome}>
                Try DebateSim
              </button>
            </div>
          </div>
        </header>
        <div className="main-content">
          <div className="error-container">
            <h2>Transcript Not Found</h2>
            <p>{error || "The shared transcript you're looking for doesn't exist."}</p>
            <button className="home-button" onClick={handleBackToHome}>
              Go to DebateSim
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="public-transcript-container">
      {/* Header */}
      <header className="home-header">
        <div className="header-content">
          <div className="header-center">
            <h1 onClick={handleBackToHome} style={{ cursor: "pointer" }}>
              Debate Simulator
            </h1>
          </div>
          <div className="header-right">
            <button className="home-button" onClick={handleBackToHome}>
              Try DebateSim
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="main-content">
        <div className="transcript-header">
          <h1>Shared Debate Transcript</h1>
          <div className="transcript-meta">
            <span className="topic">{transcript.topic}</span>
            <span className="mode">{transcript.mode}</span>
            <span className="date">
              {new Date(transcript.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
        
        <div className="transcript-viewer">
          <div className="transcript-content">
            <ReactMarkdown
              rehypePlugins={[rehypeRaw]}
              components={{
                h1: ({node, ...props}) => <h1 className="transcript-heading-h1" {...props} />,
                h2: ({node, ...props}) => <h2 className="transcript-heading-h2" {...props} />,
                h3: ({node, ...props}) => <h3 className="transcript-heading-h3" {...props} />,
                h4: ({node, ...props}) => <h4 className="transcript-heading-h4" {...props} />,
                p: ({node, ...props}) => <p className="transcript-paragraph" {...props} />,
                ul: ({node, ...props}) => <ul className="transcript-list" {...props} />,
                ol: ({node, ...props}) => <ol className="transcript-numbered-list" {...props} />,
                li: ({node, ...props}) => <li className="transcript-list-item" {...props} />,
                strong: ({node, ...props}) => <strong className="transcript-strong" {...props} />,
                em: ({node, ...props}) => <em className="transcript-emphasis" {...props} />,
                hr: ({node, ...props}) => <hr className="transcript-divider" {...props} />
              }}
            >
              {transcript.transcript}
            </ReactMarkdown>
          </div>
        </div>
        
        {/* Footer */}
        <div className="transcript-footer">
          <p>
            This debate transcript was generated using{" "}
            <span className="debatesim-link" onClick={handleBackToHome}>
              DebateSim
            </span>
            {" "}— Try creating your own AI-powered debates!
          </p>
          <p className="shared-info">
            Shared on {new Date(transcript.sharedAt).toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
}

export default PublicTranscriptView;