import React from "react";
import { useNavigate } from "react-router-dom";
import { getAuth, signOut } from "firebase/auth";
import "./Home.css";

function Home({ user, onLogout }) {
  const navigate = useNavigate();

  console.log("Home component loaded"); // Debugging check

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
          <h1>Feature Hub</h1>
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
        <div className="feature-buttons">
          <button onClick={() => navigate("/debatesim")}>Debate Simulator</button>
          <button onClick={() => navigate("/feature2")}>Feature 2</button>
          <button onClick={() => navigate("/feature3")}>Feature 3</button>
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