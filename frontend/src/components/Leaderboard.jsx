import React, { useState, useEffect, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Play, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import UserDropdown from './UserDropdown';
import Footer from './Footer';
import { useTranslation } from '../utils/translations';
import './Leaderboard.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

const AVAILABLE_MODELS = [
  "openai/gpt-4o-mini",
  "meta-llama/llama-3.3-70b-instruct",
  "google/gemini-2.0-flash-001",
  "anthropic/claude-3.5-sonnet",
  "openai/gpt-4o-mini-search-preview"
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

  // Load topics from Firestore
  useEffect(() => {
    // Initialize localStorage with default models if empty
    const localData = localStorage.getItem('leaderboard');
    if (!localData) {
      const defaultModels = AVAILABLE_MODELS.map(model => ({
        model,
        elo: 1500,
        wins: 0,
        losses: 0,
        draws: 0
      }));
      localStorage.setItem('leaderboard', JSON.stringify(defaultModels));
      console.log('Initialized leaderboard in localStorage with default models');
    }
    
    loadTopics();
    loadLeaderboard();

    // Listen for localStorage changes (from other tabs/windows or same page)
    const handleStorageChange = (e) => {
      if (e.key === 'leaderboard' || e.key === null) {
        console.log('localStorage changed, reloading leaderboard...');
        loadLeaderboard();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
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
      console.log('Loading leaderboard from:', `${API_BASE}/leaderboard/models`);
      const response = await fetch(`${API_BASE}/leaderboard/models`);
      if (response.ok) {
        const data = await response.json();
        console.log('Leaderboard data received:', data);
        
        // If backend returns empty (Firebase not configured), try localStorage
        if (!data.models || data.models.length === 0) {
          console.log('Backend returned empty, checking localStorage...');
          const localData = localStorage.getItem('leaderboard');
          if (localData) {
            const parsed = JSON.parse(localData);
            console.log('Loaded from localStorage:', parsed);
            setLeaderboard(parsed);
            setLoading(false);
            return parsed;
          }
        }
        
        // Sort by ELO rating (highest first)
        const sorted = (data.models || []).sort((a, b) => (b.elo || 1500) - (a.elo || 1500));
        console.log('Sorted leaderboard:', sorted);
        setLeaderboard(sorted);
        return sorted;
      } else {
        console.error('Failed to load leaderboard:', response.status, response.statusText);
        // Try localStorage as fallback
        const localData = localStorage.getItem('leaderboard');
        if (localData) {
          const parsed = JSON.parse(localData);
          setLeaderboard(parsed);
          return parsed;
        }
      }
    } catch (error) {
      console.error("Error loading leaderboard:", error);
      // Try localStorage as fallback
      const localData = localStorage.getItem('leaderboard');
      if (localData) {
        const parsed = JSON.parse(localData);
        setLeaderboard(parsed);
        return parsed;
      }
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

      // Get current ELO ratings for display
      const model1Data = leaderboard.find(m => m.model === model1) || { elo: 1500 };
      const model2Data = leaderboard.find(m => m.model === model2) || { elo: 1500 };

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
          language: "en"
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
                  setCurrentDebate(data);
                  setDebateStatus(null); // Clear status when complete
                  // Update ELO ratings and get changes
                  const changes = await updateELO(data);
                  setEloChanges(changes);
                  // Reload leaderboard to show updated rankings
                  console.log('Debate complete, reloading leaderboard...');
                  const updatedLeaderboard = await loadLeaderboard();
                  console.log('Leaderboard reloaded with updated rankings:', updatedLeaderboard);
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

  const updateELO = async (debateResult) => {
    try {
      console.log('Updating ELO for debate result:', debateResult);
      // Calculate ELO changes
      const model1Name = debateResult.model1;
      const model2Name = debateResult.model2;
      const winner = debateResult.winner;

      // Get current ELO ratings (default to 1500 if not found)
      const model1Data = leaderboard.find(m => m.model === model1Name) || { elo: 1500, wins: 0, losses: 0, draws: 0 };
      const model2Data = leaderboard.find(m => m.model === model2Name) || { elo: 1500, wins: 0, losses: 0, draws: 0 };
      console.log('Model 1 data:', model1Data, 'Model 2 data:', model2Data);

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

      // Update both models
      console.log('Updating model 1 ELO:', { model: model1Name, elo: newModel1Elo, wins: model1Wins, losses: model1Losses, draws: model1Draws });
      const response1 = await fetch(`${API_BASE}/leaderboard/update-elo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model1Name,
          elo: newModel1Elo,
          wins: model1Wins,
          losses: model1Losses,
          draws: model1Draws
        }),
      });
      const result1 = await response1.json();
      console.log('Model 1 update result:', result1);

      console.log('Updating model 2 ELO:', { model: model2Name, elo: newModel2Elo, wins: model2Wins, losses: model2Losses, draws: model2Draws });
      const response2 = await fetch(`${API_BASE}/leaderboard/update-elo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model2Name,
          elo: newModel2Elo,
          wins: model2Wins,
          losses: model2Losses,
          draws: model2Draws
        }),
      });
      const result2 = await response2.json();
      console.log('Model 2 update result:', result2);

      // If backend doesn't have Firebase, save to localStorage as fallback
      if (!result1.success || !result2.success) {
        console.warn('Backend persistence failed, using localStorage fallback');
        
        // Get current leaderboard from localStorage or use empty array
        const localData = localStorage.getItem('leaderboard');
        let models = localData ? JSON.parse(localData) : [];
        
        // Update or add model 1
        const model1Index = models.findIndex(m => m.model === model1Name);
        if (model1Index >= 0) {
          models[model1Index] = { model: model1Name, elo: newModel1Elo, wins: model1Wins, losses: model1Losses, draws: model1Draws };
        } else {
          models.push({ model: model1Name, elo: newModel1Elo, wins: model1Wins, losses: model1Losses, draws: model1Draws });
        }
        
        // Update or add model 2
        const model2Index = models.findIndex(m => m.model === model2Name);
        if (model2Index >= 0) {
          models[model2Index] = { model: model2Name, elo: newModel2Elo, wins: model2Wins, losses: model2Losses, draws: model2Draws };
        } else {
          models.push({ model: model2Name, elo: newModel2Elo, wins: model2Wins, losses: model2Losses, draws: model2Draws });
        }
        
        // Sort by ELO rating (highest first) to maintain accurate rankings
        models.sort((a, b) => (b.elo || 1500) - (a.elo || 1500));
        
        // Save to localStorage
        localStorage.setItem('leaderboard', JSON.stringify(models));
        console.log('Saved and sorted leaderboard to localStorage:', models);
        
        // Update the displayed leaderboard state to reflect new rankings
        setLeaderboard(models);
      }

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

  const getELOChange = (model) => {
    // This would need to track previous ELO to show change
    // For now, return null
    return null;
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
        {loadingTopics && <p className="loading-text">Loading topics...</p>}
      </div>

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
            <div className="streaming-transcript-preview">
              <h4>Debate in Progress:</h4>
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

          <details className="judge-feedback">
            <summary>Judge Feedback</summary>
            <div className="judge-feedback-content">
              <ReactMarkdown>{currentDebate.judge_feedback}</ReactMarkdown>
            </div>
          </details>

          <details className="full-transcript">
            <summary>Full Debate Transcript</summary>
            <div className="transcript-content">
              {currentDebate.transcript_parts && currentDebate.transcript_parts.length > 0 ? (
                <div className="transcript-parts">
                  {currentDebate.transcript_parts.map((part, index) => (
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
              ) : (
                <div className="transcript-fallback">
                  <ReactMarkdown>{currentDebate.transcript}</ReactMarkdown>
                </div>
              )}
            </div>
          </details>
        </div>
      )}

      <div className="leaderboard-table-container">
        {loading ? (
          <div className="loading-container">
            <Loader2 className="spinner" />
            <p>Loading leaderboard...</p>
          </div>
        ) : leaderboard.length === 0 && !currentDebate ? (
          <div className="empty-leaderboard">
            <p>No debates have been run yet. Click "Run Random Debate" to start!</p>
          </div>
        ) : leaderboard.length > 0 ? (
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Model</th>
                <th>ELO Rating</th>
                <th>Wins</th>
                <th>Losses</th>
                <th>Draws</th>
                <th>Win Rate</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((model, index) => {
                const totalGames = (model.wins || 0) + (model.losses || 0) + (model.draws || 0);
                const winRate = totalGames > 0 ? ((model.wins || 0) / totalGames * 100).toFixed(1) : 0;
                
                return (
                  <tr key={model.model || index}>
                    <td className="rank-cell">
                      {index === 0 && <Trophy className="gold-trophy" />}
                      {index === 1 && <Trophy className="silver-trophy" />}
                      {index === 2 && <Trophy className="bronze-trophy" />}
                      <span className="rank-number">{index + 1}</span>
                    </td>
                    <td className="model-name-cell">{formatModelName(model.model || 'Unknown')}</td>
                    <td className="elo-cell">
                      <span className="elo-rating">{Math.round(model.elo || 1500)}</span>
                    </td>
                    <td className="wins-cell">{model.wins || 0}</td>
                    <td className="losses-cell">{model.losses || 0}</td>
                    <td className="draws-cell">{model.draws || 0}</td>
                    <td className="winrate-cell">{winRate}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="empty-leaderboard">
            <p>Leaderboard will appear after the debate results are processed.</p>
          </div>
        )}
      </div>
      </div>

      <Footer />
    </div>
  );
}

export default Leaderboard;

