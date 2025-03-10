import React, { useState } from "react";
import { auth, provider } from "../firebase/firebaseConfig";
import { signInWithPopup } from "firebase/auth";
import "./Login.css";

function Login({ onLogin }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await signInWithPopup(auth, provider);
      onLogin(result.user);
    } catch (err) {
      console.error("Login error:", err);
      setError("Failed to sign in with Google. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = () => {
    const guestUser = {
      displayName: "Guest",
      uid: "guest",
      isGuest: true,
    };
    onLogin(guestUser);
  };

  return (
    <div className="login-container">
      {/* Left Side: Welcome Section */}
      <div className="left-panel">
        <h1>
          <span className="word">Welcome</span>
          <span className="word">to</span>
          <span className="word">DebateSim</span>
        </h1>
        <p>
          <span className="word">AI-Powered</span>
          <span className="word">Debate</span>
          <span className="word">Simulation</span>
        </p>
      </div>

      {/* Right Side: Login Form */}
      <div className="right-panel">
        <div className="login-content">
          {error && <p className="error">{error}</p>}
          <button
            className="login-button"
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign in with Google"}
          </button>
          <button
            className="login-button guest-button"
            onClick={handleGuestLogin}
            disabled={loading}
          >
            Continue as Guest
          </button>
        </div>
      </div>
    </div>
  );
}

export default Login;
