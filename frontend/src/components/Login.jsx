// Login.jsx – Full file with scroll-triggered animations and feature cards

import React, { useEffect, useState, useRef } from "react";
import { auth, provider } from "../firebase/firebaseConfig";
import { signInWithPopup } from "firebase/auth";
import "./Login.css";

function Login({ onLogin }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const sectionsRef = useRef([]);

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

  const scrollToNextSection = () => {
    const nextSection = document.getElementById("section-1");
    if (nextSection) {
      nextSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.2 }
    );

    sectionsRef.current.forEach(section => {
      if (section) observer.observe(section);
    });

    return () => {
      sectionsRef.current.forEach(section => {
        if (section) observer.unobserve(section);
      });
    };
  }, []);

  return (
    <div className="login-container">
      <nav className="login-navbar">
        <div className="navbar-left">
          <img src="/images/logo.png" alt="Logo" className="logo" />
          <span className="brand">DebateSim</span>
        </div>
        <div className="navbar-right">
          <button
            className="btn btn-ghost"
            onClick={handleGuestLogin}
            disabled={loading}
          >
            Continue as Guest
          </button>
          <button
            className="btn btn-google"
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            {loading ? (
              "Signing in..."
            ) : (
              <>
                <img src="/images/google.png" alt="Google logo" />
                Sign in with Google
              </>
            )}
          </button>
        </div>
      </nav>

      <main className="login-main">
        <section
          className="hero-section"
          ref={el => (sectionsRef.current[0] = el)}
          id="hero"
        >
          <h1>Welcome to DebateSim</h1>
          <button className="btn-start" onClick={scrollToNextSection}>
            Get Started
          </button>
        </section>

        <section
          className="fade-section"
          ref={el => (sectionsRef.current[1] = el)}
          id="section-1"
        >
          <p>AI-powered debate simulation platform</p>
        </section>

        <section
          className="fade-section"
          ref={el => (sectionsRef.current[2] = el)}
        >
          <p>Challenge your mind. Train your argument. Debate with AI.</p>
        </section>

        <section className="feature-section fade-section" ref={el => (sectionsRef.current[3] = el)}>
          <h2>Select a Feature</h2>
          <div className="feature-cards">
            <div className="feature-card">
              <h3>Debate Simulator</h3>
              <p>
                Experience dynamic debates with AI. Challenge your thinking by
                exploring multiple perspectives, enhance your argumentation
                skills, and deepen your understanding of complex topics.
              </p>
            </div>
            <div className="feature-card">
              <h3>Bill and Legislation Debate</h3>
              <p>
                In progress! Upload any Congressional bill and engage in thoughtful
                debates about its merits with friends or AI opponents. Explore
                legislation from multiple perspectives.
              </p>
            </div>
            <div className="feature-card">
              <h3>Bias Detector</h3>
              <p>
                In progress! Evaluate online content for accuracy and bias! Analyze
                websites, news articles, or any text to identify potential slant
                and misinformation.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        GitHub© 2025 DebateSim. All rights reserved.
      </footer>
    </div>
  );
}

export default Login;
