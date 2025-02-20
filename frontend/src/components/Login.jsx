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
    // Create a guest user object with a flag that indicates no history should be saved.
    const guestUser = {
      displayName: "Guest",
      uid: "guest", // Using a constant UID for guest users.
      isGuest: true,
    };
    onLogin(guestUser);
  };

  return (
    <div className="home-container">
      <div className="login-content">
        <h1>Welcome to DebateSim</h1>
        <p>AI-Powered Debate Simulation</p>
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
  );
}

export default Login;