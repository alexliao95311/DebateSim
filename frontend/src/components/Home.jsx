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
          {/* Empty left section */}
          <div className="header-left"></div>
          
          <div className="header-center">
            <h1 className="site-title">Feature Hub</h1>
          </div>
          
          <div className="header-right">
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
            <p className="feature-description">
              Experience dynamic debates with AI. Challenge your thinking by exploring multiple perspectives, enhance your argumentation skills, and deepen your understanding of complex topics.
            </p>
            <button 
              className="feature-button" 
              onClick={() => navigate("/debatesim")}
            >
              Go to Debate Simulator
            </button>
          </div>
          
          <div className="feature">
            <h3>Bill and Legislation Debate</h3>
            <p className="feature-description">
              In progress! Upload any Congressional bill and engage in thoughtful debates about its merits with friends or AI opponents. Explore legislation from multiple perspectives.
            </p>
            <button 
              className="feature-button" 
              onClick={() => navigate("/legislation")}
            >
              Go to Bill Debate
            </button>
          </div>
          
          <div className="feature">
            <h3>Bias Detector</h3>
            <p className="feature-description">
              In progress! Evaluate online content for accuracy and bias! Analyze websites, news articles, or any text to identify potential slant and misinformation.
            </p>
            <button 
              className="feature-button" 
              onClick={() => navigate("/feature3")}
            >
              Go to Bias Detector
            </button>
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