import React from "react";
import { useNavigate } from "react-router-dom";
import { getAuth, signOut } from "firebase/auth";
import "./Home.css";

function Home({ user, onLogout }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    signOut(getAuth())
      .then(() => {
        onLogout();
      })
      .catch((err) => console.error("Logout error:", err));
  };

  return (
    <div className="home-container">
      <header className="home-header">
        <div className="header-content">
          <h1 className="site-title">
            Feature Hub
          </h1>
          <div className="user-section">
            <span className="username">{user?.displayName}</span>
            <button className="logout-button" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="main-content">
        <h1 className="welcome-message">Welcome, {user?.displayName}</h1>
        <h2>Select a Feature</h2>
        <div className="feature-sections">
          <div className="feature">
            <h3>Debate Simulator</h3>
            <a className="feature-link" href="/debatesim">
              Go to Debate Simulator
            </a>
            <p className="feature-description">
              Experience dynamic debates with AI. Challenge your thinking by exploring multiple perspectives, enhance your argumentation skills, and deepen your understanding of complex topics. Debate against AI opponents, invite friends to join, or watch as AI personas debate each other to reveal new insights and approaches.
            </p>
          </div>
          <div className="feature">
            <h3>Bill and Legislation Debate</h3>
            <a className="feature-link" href="/feature2">
              Go to Bill and Legislation Debate
            </a>
            <p className="feature-description">
              In progress! Upload any Congressional bill and engage in thoughtful debates about its merits with friends or AI opponents. Explore the legislation's pros and cons from multiple perspectives, gaining deeper insights that can help inform your voting decisions and understanding of complex policy issues.
            </p>
          </div>
          <div className="feature">
            <h3>Bias Detector</h3>
            <a className="feature-link" href="/feature3">
              Go to Bias Detector
            </a>
            <p className="feature-description">
              In progress! Evaluate online content for accuracy and bias! Analyze websites, news articles, or any text to identify potential slant and misinformation. Assess source credibility and information reliability to make more informed decisions and develop balanced perspectives on complex topics.
            </p>
          </div>
        </div>
      </div>

      <footer className="bottom-text">
        <a
          href="https://github.com/alexliao95311/DebateSim"
          target="_blank"
          rel="noopener noreferrer"
          className="github-link"
        >
          GitHub
        </a>
        <span>&copy; {new Date().getFullYear()} DebateSim. All rights reserved.</span>
      </footer>
    </div>
  );
}

export default Home;