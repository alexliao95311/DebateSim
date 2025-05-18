import React, { useState } from "react";
import { auth, provider } from "../firebase/firebaseConfig";
import { signInWithPopup } from "firebase/auth";
import "bootstrap/dist/css/bootstrap.min.css";
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
    localStorage.setItem("user", JSON.stringify(guestUser));
    onLogin(guestUser);
  };

  return (
    <div className="login-page">
      <nav className="navbar navbar-expand justify-content-between px-4">
        <button
          className="login-btn-primary"
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          {loading ? "Signing in..." : "Sign in with Google"}
        </button>

        <button
          className="login-btn-secondary"
          onClick={handleGuestLogin}
          disabled={loading}
        >
          Continue as Guest
        </button>
      </nav>

      <div className="main-content text-white text-center">
        <h1 className="display-1">
          <span className="word">Welcome</span>
          <span className="word">to</span>
          <span className="word">DebateSim</span>
        </h1>
        <p className="lead mt-3">
          <span className="word">AI-Powered</span>
          <span className="word">Debate</span>
          <span className="word">Simulation</span>
        </p>
        {error && <div className="login-error mt-4">{error}</div>}
      </div>
    </div>
  );
}

export default Login;
