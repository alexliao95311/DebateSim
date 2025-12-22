import React, { useState, useEffect, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Play, Loader2, RotateCcw, History, Share2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import UserDropdown from './UserDropdown';
import Footer from './Footer';
import ShareModal from './ShareModal';
import { useTranslation } from '../utils/translations';
import { db } from '../firebase/firebaseConfig';
import { collection, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import './Leaderboard.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

const AVAILABLE_MODELS = [
  "anthropic/claude-sonnet-4.5",
  "google/gemini-2.5-flash",
  "google/gemini-2.0-flash-001",
  "x-ai/grok-4-fast",
  "openai/gpt-5-mini",
  "anthropic/claude-sonnet-4",
  "openai/gpt-4o-mini",
  "openai/gpt-5.1",
  "openai/gpt-4.1-mini",
  "anthropic/claude-opus-4.5",
  "x-ai/grok-3-mini",
  "x-ai/grok-4",
  "x-ai/grok-4.1-fast",
  "qwen/qwen-2.5-72b-instruct",
  "deepseek/deepseek-chat-v3-0324",
  "deepseek/deepseek-chat-v3.1",
  "mistralai/mistral-nemo",
  "mistralai/mistral-small-3.2-24b-instruct",
  "meta-llama/llama-3.1-8b-instruct",
  "meta-llama/llama-4-maverick",
  "qwen/qwen3-next-80b-a3b-instruct"
];

function Leaderboard({ user, onLogout }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(false);
  const [debateLoading, setDebateLoading] = useState(false);
  const [currentDebate, setCurrentDebate] = useState(null);
  const [eloChanges, setEloChanges] = useState(null);
  const [topics, setTopics] = useState([]);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [debateStatus, setDebateStatus] = useState(null);
  const [streamingTranscript, setStreamingTranscript] = useState([]);
  const [debateInfo, setDebateInfo] = useState(null); // Topic, models, ELO
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [currentDebateId, setCurrentDebateId] = useState(null);

  // Immediate scroll reset using useLayoutEffect
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  // Animation trigger
  useEffect(() => {
    const animationTimer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(animationTimer);
  }, []);

  // Load topics and leaderboard from Firebase
  useEffect(() => {
    loadTopics();
    loadLeaderboard();
  }, []);

  const loadTopics = async () => {
    setLoadingTopics(true);
    try {
      // For now, we'll use a placeholder. Later, this will fetch from Firestore
      // You can implement a backend endpoint to fetch topics from Firestore
      const response = await fetch(`${API_BASE}/leaderboard/topics`);
      if (response.ok) {
        const data = await response.json();
        setTopics(data.topics || []);
      } else {
        // Fallback: use a few sample topics
        setTopics([
          "Should AI be regulated like a public utility?",
          "Should voting be mandatory?",
          "Should college be free?",
          "Should social media be banned for children?",
          "Should universal basic income be implemented?"
        ]);
      }
    } catch (error) {
      console.error("Error loading topics:", error);
      // Fallback topics
      setTopics([
        "Should AI be regulated like a public utility?",
        "Should voting be mandatory?",
        "Should college be free?"
      ]);
    } finally {
      setLoadingTopics(false);
    }
  };

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const modelsRef = collection(db, 'models');
      const snapshot = await getDocs(modelsRef);

      const models = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        models.push({
          model: data.model || '',
          elo: data.elo || 1500,
          wins: data.wins || 0,
          losses: data.losses || 0,
          draws: data.draws || 0
        });
      });

      // Sort by ELO rating (highest first)
      const sorted = models.sort((a, b) => (b.elo || 1500) - (a.elo || 1500));
      setLeaderboard(sorted);
      return sorted;
    } catch (error) {
      console.error("Error loading leaderboard:", error);
      setLeaderboard([]);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const runRandomDebate = async () => {
    if (topics.length === 0) {
      alert("No topics available. Please wait for topics to load.");
      return;
    }

    setDebateLoading(true);
    setDebateStatus(null);
    setStreamingTranscript([]);
    setCurrentDebate(null);
    setEloChanges(null);

    try {
      // Select random topic
      const randomTopic = topics[Math.floor(Math.random() * topics.length)];
      
      // Select two random different models
      const shuffled = [...AVAILABLE_MODELS].sort(() => 0.5 - Math.random());
      const model1 = shuffled[0];
      const model2 = shuffled[1];

      // Load current leaderboard to get ELO ratings for display
      const currentLeaderboard = await loadLeaderboard();
      const model1Data = currentLeaderboard.find(m => m.model === model1) || { elo: 1500 };
      const model2Data = currentLeaderboard.find(m => m.model === model2) || { elo: 1500 };

      // Set debate info immediately
      setDebateInfo({
        topic: randomTopic,
        model1: model1,
        model2: model2,
        model1Elo: model1Data.elo || 1500,
        model2Elo: model2Data.elo || 1500
      });

      // Use fetch with streaming response for real-time updates
      const response = await fetch(`${API_BASE}/leaderboard/run-debate-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: randomTopic,
          model1: model1,
          model2: model2,
          judge_model: "anthropic/claude-3.5-sonnet",
          debate_format: "default",
          max_rounds: 5,
          language: "en",
          model1_elo: model1Data.elo || 1500,
          model2_elo: model2Data.elo || 1500
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to run debate');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamComplete = false;

      // Set a timeout to prevent hanging
      const timeoutId = setTimeout(() => {
        if (!streamComplete) {
          console.error('Stream timeout - debate taking too long');
          setDebateLoading(false);
          setDebateStatus({ message: 'Debate timed out. Please try again.' });
        }
      }, 300000); // 5 minute timeout

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            streamComplete = true;
            clearTimeout(timeoutId);
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.type === 'status') {
                  setDebateStatus(data);
                } else if (data.type === 'transcript_part') {
                  setStreamingTranscript(prev => [...prev, data.part]);
                } else if (data.type === 'complete') {
                  streamComplete = true;
                  clearTimeout(timeoutId);
                  
                  // Add judge feedback as a special transcript part
                  if (data.judge_feedback) {
                    setStreamingTranscript(prev => [...prev, {
                      speaker: 'Judge',
                      model: 'Judge Panel',
                      round: 'Final',
                      content: data.judge_feedback
                    }]);
                  }
                  
                  setCurrentDebate(data);
                  setDebateStatus(null); // Clear status when complete
                  
                  // Save debate to Firestore for sharing
                  const debateId = await saveDebateToFirestore(data, [...streamingTranscript, {
                    speaker: 'Judge',
                    model: 'Judge Panel',
                    round: 'Final',
                    content: data.judge_feedback
                  }]);
                  
                  if (debateId) {
                    setCurrentDebateId(debateId);
                  }
                  
                  // Update ELO ratings and get changes
                  const changes = await updateELO(data);
                  setEloChanges(changes);
                  // Reload leaderboard to show updated rankings
                  await loadLeaderboard();
                  setDebateLoading(false);
                  break; // Exit the loop when complete
                } else if (data.type === 'error') {
                  streamComplete = true;
                  clearTimeout(timeoutId);
                  throw new Error(data.message);
                }
              } catch (e) {
                console.error('Error parsing SSE data:', e);
              }
            }
          }
        }
      } finally {
        clearTimeout(timeoutId);
        streamComplete = true;
      }
      
      // Ensure loading is set to false even if stream ends without 'complete'
      if (!streamComplete) {
        setDebateLoading(false);
        setDebateStatus({ message: 'Stream ended unexpectedly' });
      }
    } catch (error) {
      console.error("Error running debate:", error);
      alert("Failed to run debate. Please try again.");
      setDebateLoading(false);
      setDebateStatus(null);
      setDebateInfo(null);
    }
  };

  const saveDebateToFirestore = async (debateData, transcript) => {
    try {
      const debatesRef = collection(db, 'simulatedDebates');
      
      // Format the transcript into readable text
      const transcriptText = transcript.map(part => {
        if (part.speaker === 'Judge') {
          return `## Judge Feedback\n\n${part.content}`;
        }
        return `## ${part.speaker} - Round ${part.round}\n\n${part.content}`;
      }).join('\n\n');

      const debateDoc = {
        topic: debateData.topic,
        model1: debateData.model1,
        model2: debateData.model2,
        judge_model: debateData.judge_model || "anthropic/claude-3.5-sonnet",
        winner: debateData.winner,
        judge_feedback: debateData.judge_feedback,
        transcript: transcriptText,
        mode: "Leaderboard Debate",
        activityType: "Debate",
        createdAt: new Date().toISOString(),
        model1_elo: debateData.model1_elo,
        model2_elo: debateData.model2_elo,
        isShared: false
      };

      const docRef = await setDoc(doc(debatesRef), debateDoc);
      return docRef.id || Date.now().toString(); // Return doc ID or fallback
    } catch (error) {
      console.error("Error saving debate to Firestore:", error);
      return null;
    }
  };

  const updateELO = async (debateResult) => {
    try {
      // Calculate ELO changes
      const model1Name = debateResult.model1;
      const model2Name = debateResult.model2;
      const winner = debateResult.winner;

      // Get current ELO ratings from Firebase (reload to ensure we have latest)
      const currentLeaderboard = await loadLeaderboard();
      const model1Data = currentLeaderboard.find(m => m.model === model1Name) || { elo: 1500, wins: 0, losses: 0, draws: 0 };
      const model2Data = currentLeaderboard.find(m => m.model === model2Name) || { elo: 1500, wins: 0, losses: 0, draws: 0 };

      const oldModel1Elo = model1Data.elo;
      const oldModel2Elo = model2Data.elo;

      let newModel1Elo = model1Data.elo;
      let newModel2Elo = model2Data.elo;
      let model1Wins = model1Data.wins || 0;
      let model1Losses = model1Data.losses || 0;
      let model1Draws = model1Data.draws || 0;
      let model2Wins = model2Data.wins || 0;
      let model2Losses = model2Data.losses || 0;
      let model2Draws = model2Data.draws || 0;

      if (winner === "model1") {
        // Model 1 wins
        const [newElo1, newElo2] = calculateELO(model1Data.elo, model2Data.elo, 1, 0);
        newModel1Elo = newElo1;
        newModel2Elo = newElo2;
        model1Wins += 1;
        model2Losses += 1;
      } else if (winner === "model2") {
        // Model 2 wins
        const [newElo2, newElo1] = calculateELO(model2Data.elo, model1Data.elo, 1, 0);
        newModel1Elo = newElo1;
        newModel2Elo = newElo2;
        model2Wins += 1;
        model1Losses += 1;
      } else {
        // Draw
        const [newElo1, newElo2] = calculateELO(model1Data.elo, model2Data.elo, 0.5, 0.5);
        newModel1Elo = newElo1;
        newModel2Elo = newElo2;
        model1Draws += 1;
        model2Draws += 1;
      }

      // Store ELO changes for display
      const eloChanges = {
        model1: {
          name: model1Name,
          oldElo: oldModel1Elo,
          newElo: newModel1Elo,
          change: newModel1Elo - oldModel1Elo
        },
        model2: {
          name: model2Name,
          oldElo: oldModel2Elo,
          newElo: newModel2Elo,
          change: newModel2Elo - oldModel2Elo
        }
      };

      // Update both models in Firebase directly
      const modelsRef = collection(db, 'models');

      const model1DocId = model1Name.replace(/\//g, '_');
      const model1Ref = doc(modelsRef, model1DocId);
      await setDoc(model1Ref, {
        model: model1Name,
        elo: newModel1Elo,
        wins: model1Wins,
        losses: model1Losses,
        draws: model1Draws,
        updatedAt: new Date()
      }, { merge: true });

      const model2DocId = model2Name.replace(/\//g, '_');
      const model2Ref = doc(modelsRef, model2DocId);
      await setDoc(model2Ref, {
        model: model2Name,
        elo: newModel2Elo,
        wins: model2Wins,
        losses: model2Losses,
        draws: model2Draws,
        updatedAt: new Date()
      }, { merge: true });

      return eloChanges;
    } catch (error) {
      console.error("Error updating ELO:", error);
      return null;
    }
  };

  const calculateELO = (rating1, rating2, score1, score2, kFactor = 32) => {
    // Expected scores
    const expected1 = 1 / (1 + Math.pow(10, (rating2 - rating1) / 400));
    const expected2 = 1 / (1 + Math.pow(10, (rating1 - rating2) / 400));

    // New ratings
    const newRating1 = rating1 + kFactor * (score1 - expected1);
    const newRating2 = rating2 + kFactor * (score2 - expected2);

    return [newRating1, newRating2];
  };

  const resetAllStats = async () => {
    // Confirm before resetting
    const confirmed = window.confirm(
      'Are you sure you want to reset all ELO ratings and win/loss records? This action cannot be undone.'
    );
    
    if (!confirmed) {
      return;
    }

    try {
      const modelsRef = collection(db, 'models');
      const snapshot = await getDocs(modelsRef);
      
      let resetCount = 0;
      const updatePromises = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const modelName = data.model;
        
        if (modelName) {
          const docId = modelName.replace(/\//g, '_');
          const docRef = doc(modelsRef, docId);
          
          updatePromises.push(
            setDoc(docRef, {
              model: modelName,
              elo: 1500,
              wins: 0,
              losses: 0,
              draws: 0,
              updatedAt: new Date()
            }, { merge: true })
          );
          resetCount++;
        }
      });

      await Promise.all(updatePromises);
      
      alert(`Successfully reset ${resetCount} model(s). All ELO ratings set to 1500, wins/losses/draws set to 0.`);
      await loadLeaderboard();
    } catch (error) {
      console.error('Error resetting stats:', error);
      alert(`Error resetting stats: ${error.message}`);
    }
  };

  const formatModelName = (model) => {
    // Format model names for display
    return model
      .replace('openai/', '')
      .replace('meta-llama/', '')
      .replace('google/', '')
      .replace('anthropic/', '')
      .replace('llama-3.3-70b-instruct', 'LLaMA 3.3 70B')
      .replace('gpt-4o-mini', 'GPT-4o Mini')
      .replace('gemini-2.0-flash-001', 'Gemini 2.0 Flash')
      .replace('claude-3.5-sonnet', 'Claude 3.5 Sonnet');
  };

  const handleLogout = () => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    onLogout();
  };

  return (
    <div className="leaderboard-container">
      <header className="leaderboard-header">
        <div className="leaderboard-header-content">
          <div className="leaderboard-header-left">
            {/* Empty space for alignment */}
          </div>

          <div className="leaderboard-header-center" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1
          }}>
            <h1 className="leaderboard-site-title" onClick={() => navigate("/")}>
              AI Debate Leaderboard
            </h1>
          </div>

          <div className="leaderboard-header-right">
            <UserDropdown user={user} onLogout={handleLogout} className="leaderboard-user-dropdown" />
          </div>
        </div>
      </header>

      <div className="leaderboard-main-content">
        <div className={`leaderboard-hero-section ${isVisible ? 'visible' : ''}`}>
          <h1 className="leaderboard-welcome-message">
            <Trophy className="trophy-icon-hero" />
            Rank AI Models by Debate Performance
          </h1>
          <p className="leaderboard-hero-subtitle">
            Watch AI models compete in debates and see how they rank with ELO ratings
          </p>
        </div>

      <div className="leaderboard-controls">
        <button
          className="run-debate-button"
          onClick={runRandomDebate}
          disabled={debateLoading || loadingTopics}
        >
          {debateLoading ? (
            <>
              <Loader2 className="spinner" />
              Running Debate...
            </>
          ) : (
            <>
              <Play className="play-icon" />
              Run Random Debate
            </>
          )}
        </button>
        <button
          className="see-rankings-button"
          onClick={() => navigate("/rankings")}
        >
          <Trophy className="trophy-icon-small" />
          See Rankings
        </button>
        <button
          className="view-history-button"
          onClick={() => navigate("/simulated-debates")}
        >
          <History className="history-icon-small" />
          View Debate History
        </button>
        <button
          className="reset-stats-button"
          onClick={resetAllStats}
          disabled={loading}
        >
          <RotateCcw className="reset-icon" />
          Reset All Stats
        </button>
        {loadingTopics && <p className="loading-text">Loading topics...</p>}
      </div>

      {/* Initialize Models Button - only show if leaderboard is empty */}
      {leaderboard.length === 0 && !loading && (
        <div className="initialize-models-section">
          <p className="initialize-models-text">
            No models found. Initialize models from models.txt to start ranking.
          </p>
          <button
            className="initialize-models-button"
            onClick={async () => {
              try {
                const modelsRef = collection(db, 'models');
                let initialized = 0;

                for (const modelName of AVAILABLE_MODELS) {
                  const docId = modelName.replace(/\//g, '_');
                  const docRef = doc(modelsRef, docId);
                  const docSnap = await getDoc(docRef);

                  if (!docSnap.exists()) {
                    await setDoc(docRef, {
                      model: modelName,
                      elo: 1500,
                      wins: 0,
                      losses: 0,
                      draws: 0,
                      createdAt: new Date(),
                      updatedAt: new Date()
                    });
                    initialized++;
                  }
                }

                alert(`Success! Initialized ${initialized} new models`);
                await loadLeaderboard();
              } catch (error) {
                console.error('Error initializing models:', error);
                alert(`Error initializing models: ${error.message}`);
              }
            }}
          >
            Initialize Models
          </button>
        </div>
      )}

      {(debateInfo || debateStatus || streamingTranscript.length > 0 || currentDebate) && (
        <div className="debate-result-card">
          {debateInfo && (
            <div className="debate-header-info">
              <h3 className="debate-topic-header">{debateInfo.topic}</h3>
              <div className="debate-models-header">
                <div className="debate-model-header">
                  <span className="model-label-pro">Pro:</span>
                  <span className="model-name-header">{formatModelName(debateInfo.model1)}</span>
                  <span className="elo-badge">ELO: {Math.round(debateInfo.model1Elo)}</span>
                </div>
                <span className="vs-header">vs</span>
                <div className="debate-model-header">
                  <span className="model-label-con">Con:</span>
                  <span className="model-name-header">{formatModelName(debateInfo.model2)}</span>
                  <span className="elo-badge">ELO: {Math.round(debateInfo.model2Elo)}</span>
                </div>
              </div>
            </div>
          )}

          {debateStatus && (
            <div className="debate-status">
              <Loader2 className="spinner" />
              <span>{debateStatus.message}</span>
              {debateStatus.round > 0 && debateStatus.total_rounds && (
                <span className="round-progress">
                  Round {debateStatus.round} of {debateStatus.total_rounds}
                </span>
              )}
            </div>
          )}

          {streamingTranscript.length > 0 && (
            <details className="debate-transcript-details" open={debateLoading}>
              <summary className="transcript-summary">
                {debateLoading ? '📖 Debate in Progress' : '📖 Full Debate Transcript'}
              </summary>
              <div className="streaming-transcript-preview">
                <div className="transcript-parts">
                  {streamingTranscript.map((part, index) => (
                    <div key={index} className={`transcript-part ${part.speaker.toLowerCase()}`}>
                      <div className="transcript-header">
                        <span className="transcript-speaker">
                          {part.speaker} ({formatModelName(part.model)})
                        </span>
                        <span className="transcript-round">Round {part.round}</span>
                      </div>
                      <div className="transcript-text">
                        <ReactMarkdown>{part.content}</ReactMarkdown>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </details>
          )}
        </div>
      )}

      {currentDebate && (
        <div className="debate-result-card">
          <h3 className="debate-result-title">
            <Trophy className="trophy-icon-small" />
            Latest Debate Result
          </h3>
          
          <div className="debate-info-grid">
            <div className="debate-info-item">
              <span className="debate-info-label">Topic:</span>
              <span className="debate-info-value">{currentDebate.topic}</span>
            </div>
            
            <div className="debate-info-item">
              <span className="debate-info-label">Debating Models:</span>
              <div className="models-display">
                <span className="model-badge model-pro">
                  {formatModelName(currentDebate.model1)} (Pro)
                </span>
                <span className="vs-text">vs</span>
                <span className="model-badge model-con">
                  {formatModelName(currentDebate.model2)} (Con)
                </span>
              </div>
            </div>

            <div className="debate-info-item">
              <span className="debate-info-label">Judge Model:</span>
              <span className="debate-info-value judge-model">
                {formatModelName(currentDebate.judge_model || "anthropic/claude-3.5-sonnet")}
              </span>
            </div>

            <div className="debate-info-item">
              <span className="debate-info-label">Winner:</span>
              <span className={`winner-badge ${
                currentDebate.winner === "model1" ? "winner-pro" :
                currentDebate.winner === "model2" ? "winner-con" : "winner-draw"
              }`}>
                {currentDebate.winner === "model1" ? formatModelName(currentDebate.model1) :
                 currentDebate.winner === "model2" ? formatModelName(currentDebate.model2) :
                 "Draw"}
              </span>
            </div>

            {eloChanges && (
              <div className="elo-changes-section">
                <span className="debate-info-label">ELO Changes:</span>
                <div className="elo-changes-grid">
                  <div className="elo-change-item">
                    <span className="elo-model-name">{formatModelName(eloChanges.model1.name)}</span>
                    <span className="elo-change-value">
                      {Math.round(eloChanges.model1.oldElo)} → {Math.round(eloChanges.model1.newElo)}
                      {eloChanges.model1.change !== 0 && (
                        <span className={`elo-delta ${eloChanges.model1.change > 0 ? 'positive' : 'negative'}`}>
                          ({eloChanges.model1.change > 0 ? '+' : ''}{Math.round(eloChanges.model1.change)})
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="elo-change-item">
                    <span className="elo-model-name">{formatModelName(eloChanges.model2.name)}</span>
                    <span className="elo-change-value">
                      {Math.round(eloChanges.model2.oldElo)} → {Math.round(eloChanges.model2.newElo)}
                      {eloChanges.model2.change !== 0 && (
                        <span className={`elo-delta ${eloChanges.model2.change > 0 ? 'positive' : 'negative'}`}>
                          ({eloChanges.model2.change > 0 ? '+' : ''}{Math.round(eloChanges.model2.change)})
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {currentDebateId && (
            <div className="debate-actions">
              <button
                className="share-button"
                onClick={() => setIsShareModalOpen(true)}
              >
                <Share2 size={18} />
                Share This Debate
              </button>
            </div>
          )}
        </div>
      )}
      </div>

      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        transcript={currentDebate}
        transcriptId={currentDebateId}
        isSimulatedDebate={true}
      />

      <Footer />
    </div>
  );
}

export default Leaderboard;

