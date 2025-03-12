import React, { useState } from "react";
import { auth, provider } from "../firebase/firebaseConfig";
import { signInWithPopup } from "firebase/auth";
import "bootstrap/dist/css/bootstrap.min.css";
import "./Login.css"; // Make sure this file is still imported

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
    // Persist the guest user to localStorage
    localStorage.setItem("user", JSON.stringify(guestUser));
    onLogin(guestUser);
  };

  return (
    <div className="container-fluid d-flex p-0" style={{ height: "100vh" }}>
      {/* Left Side: Welcome Section */}
      <div
        className="col-lg-6 d-flex flex-column justify-content-center align-items-center text-center bg-dark text-white p-5 left-panel"
      >
        <h1 className="display-1">
          <span className="word">Welcome</span>
          <span className="word">to</span>
          <span className="word">DebateSim</span>
        </h1>
        <p className="lead">
          <span className="word">AI-Powered</span>
          <span className="word">Debate</span>
          <span className="word">Simulation</span>
        </p>
      </div>

      {/* Right Side: Login Form */}
      <div className="col-lg-6 d-flex justify-content-center align-items-center bg-light">
        <div className="login-content p-4 rounded shadow-sm" style={{ maxWidth: "400px", width: "90%" }}>
          {error && <p className="alert alert-danger">{error}</p>}
          <button
            className="btn btn-primary w-100 mb-3"
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign in with Google"}
          </button>
          <button
            className="btn btn-secondary w-100"
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
