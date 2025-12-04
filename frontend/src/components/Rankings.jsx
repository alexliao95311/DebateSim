import React, { useState, useEffect, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, ArrowLeft, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import UserDropdown from './UserDropdown';
import Footer from './Footer';
import './Rankings.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

function Rankings({ user, onLogout }) {
  const navigate = useNavigate();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isVisible, setIsVisible] = useState(false);

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

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/leaderboard/models`);
      if (response.ok) {
        const data = await response.json();
        // Sort by ELO rating (highest first)
        const sorted = (data.models || []).sort((a, b) => (b.elo || 1500) - (a.elo || 1500));
        setLeaderboard(sorted);
      }
    } catch (error) {
      console.error("Error loading leaderboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatModelName = (model) => {
    // Format model names for display
    return model
      .replace('openai/', '')
      .replace('meta-llama/', '')
      .replace('google/', '')
      .replace('anthropic/', '')
      .replace('x-ai/', '')
      .replace('deepseek/', '')
      .replace('mistralai/', '')
      .replace('qwen/', '')
      .replace('amazon/', '')
      .replace('llama-3.3-70b-instruct', 'LLaMA 3.3 70B')
      .replace('gpt-4o-mini', 'GPT-4o Mini')
      .replace('gpt-5-mini', 'GPT-5 Mini')
      .replace('gpt-5.1', 'GPT-5.1')
      .replace('gpt-4.1-mini', 'GPT-4.1 Mini')
      .replace('gemini-2.0-flash-001', 'Gemini 2.0 Flash')
      .replace('gemini-2.5-flash', 'Gemini 2.5 Flash')
      .replace('claude-3.5-sonnet', 'Claude 3.5 Sonnet')
      .replace('claude-sonnet-4', 'Claude Sonnet 4')
      .replace('claude-sonnet-4.5', 'Claude Sonnet 4.5')
      .replace('claude-opus-4.5', 'Claude Opus 4.5')
      .replace('grok-4-fast', 'Grok 4 Fast')
      .replace('grok-3-mini', 'Grok 3 Mini')
      .replace('grok-4', 'Grok 4')
      .replace('grok-4.1-fast', 'Grok 4.1 Fast')
      .replace('nova-2-lite-v1:free', 'Nova 2 Lite')
      .replace('qwen-2.5-72b-instruct', 'Qwen 2.5 72B')
      .replace('deepseek-chat-v3-0324', 'DeepSeek Chat v3')
      .replace('deepseek-chat-v3.1', 'DeepSeek Chat v3.1')
      .replace('mistral-nemo', 'Mistral Nemo')
      .replace('mistral-small-3.2-24b-instruct', 'Mistral Small 3.2')
      .replace('llama-3.1-8b-instruct', 'LLaMA 3.1 8B')
      .replace('llama-4-maverick', 'LLaMA 4 Maverick')
      .replace('qwen3-next-80b-a3b-instruct', 'Qwen3 Next 80B');
  };

  const handleLogout = () => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    onLogout();
  };

  return (
    <div className="rankings-container">
      <header className="rankings-header">
        <div className="rankings-header-content">
          <div className="rankings-header-left">
            <button className="back-button" onClick={() => navigate("/leaderboard")}>
              <ArrowLeft size={20} />
              Back to Leaderboard
            </button>
          </div>

          <div className="rankings-header-center" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1
          }}>
            <h1 className="rankings-site-title">
              <Trophy className="trophy-icon-header" />
              Model Rankings
            </h1>
          </div>

          <div className="rankings-header-right">
            <UserDropdown user={user} onLogout={handleLogout} className="rankings-user-dropdown" />
          </div>
        </div>
      </header>

      <div className="rankings-main-content">
        <div className={`rankings-hero-section ${isVisible ? 'visible' : ''}`}>
          <h1 className="rankings-welcome-message">
            AI Model ELO Rankings
          </h1>
          <p className="rankings-hero-subtitle">
            Complete rankings of all AI models based on their debate performance
          </p>
        </div>

        <div className="rankings-table-container">
          {loading ? (
            <div className="loading-container">
              <div className="spinner"></div>
              <p>Loading rankings...</p>
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="empty-rankings">
              <p>No models have been ranked yet. Run debates to build the leaderboard!</p>
            </div>
          ) : (
            <table className="rankings-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Model</th>
                  <th>ELO Rating</th>
                  <th>Wins</th>
                  <th>Losses</th>
                  <th>Draws</th>
                  <th>Total Games</th>
                  <th>Win Rate</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((model, index) => {
                  const totalGames = (model.wins || 0) + (model.losses || 0) + (model.draws || 0);
                  const winRate = totalGames > 0 ? ((model.wins || 0) / totalGames * 100).toFixed(1) : 0;
                  
                  return (
                    <tr key={model.model || index} className={index < 3 ? `rank-${index + 1}` : ''}>
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
                      <td className="total-games-cell">{totalGames}</td>
                      <td className="winrate-cell">{winRate}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}

export default Rankings;

