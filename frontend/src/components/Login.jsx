import React, { useEffect, useState, useRef } from "react";
import { auth, provider } from "../firebase/firebaseConfig";
import { signInWithRedirect, getRedirectResult } from "firebase/auth";
import "./Login.css";

function Login({ onLogin }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [currentText, setCurrentText] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [isTyping, setIsTyping] = useState(true);

  const sectionsRef = useRef([]);

  const dynamicTexts = [
    "AI-powered debate simulation.",
    "Sharpen your thinking.",
    "Flip perspectives. Challenge assumptions. Win arguments.",
    "Explore different perspectives on complex topics.",
    "Use a machine trained to win."
  ];

  // Handle redirect result when user returns from Google login
  useEffect(() => {
    const handleRedirectResult = async () => {
      setLoading(true);
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          // User successfully signed in via redirect
          onLogin(result.user);
        }
      } catch (err) {
        console.error("Redirect login error:", err);
        // Handle specific Firebase auth errors
        let errorMessage = "Failed to complete Google sign in. Please try again.";
        
        if (err.code === 'auth/popup-blocked') {
          errorMessage = "Login popup was blocked. Please allow popups and try again.";
        } else if (err.code === 'auth/popup-closed-by-user') {
          errorMessage = "Login was cancelled. Please try again.";
        } else if (err.code === 'auth/network-request-failed') {
          errorMessage = "Network error. Please check your connection and try again.";
        } else if (err.code === 'auth/too-many-requests') {
          errorMessage = "Too many login attempts. Please wait a moment and try again.";
        }
        
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    handleRedirectResult();
  }, [onLogin]);

  const handleGoogleLogin = async () => {
    setRedirecting(true);
    setError("");
    try {
      // Configure the provider for better UX
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      
      // Redirect to Google login - this provides a full-page professional experience
      await signInWithRedirect(auth, provider);
    } catch (err) {
      console.error("Login error:", err);
      
      // Handle specific error cases
      let errorMessage = "Failed to initiate Google sign in. Please try again.";
      
      if (err.code === 'auth/operation-not-supported-in-this-environment') {
        errorMessage = "Google sign in is not supported in this environment. Please try from a supported browser.";
      } else if (err.code === 'auth/unauthorized-domain') {
        errorMessage = "This domain is not authorized for Google sign in. Please contact support.";
      }
      
      setError(errorMessage);
      setRedirecting(false);
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
      nextSection.scrollIntoView({ 
        behavior: "smooth", 
        block: "start" 
      });
    }
  };

  // Scroll reset on component mount
  useEffect(() => {
    // Force scroll reset with slight delay to ensure it works after navigation
    const scrollTimer = setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }, 0);
    
    return () => clearTimeout(scrollTimer);
  }, []);

  // Typing animation effect
  useEffect(() => {
    const typeText = () => {
      const fullText = dynamicTexts[currentText];
      setDisplayText(fullText.substring(0, displayText.length + 1));
      
      if (displayText.length === fullText.length) {
        setTimeout(() => {
          setIsTyping(false);
          setTimeout(() => {
            setCurrentText((prev) => (prev + 1) % dynamicTexts.length);
            setDisplayText("");
            setIsTyping(true);
          }, 2000);
        }, 1000);
      }
    };

    if (isTyping) {
      const timer = setTimeout(typeText, 100);
      return () => clearTimeout(timer);
    }
  }, [displayText, currentText, isTyping]);

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
      {/* Loading overlay during redirect */}
      {redirecting && (
        <div className="redirect-overlay">
          <div className="redirect-content">
            <div className="google-logo-large">
              <img src="/images/google.png" alt="Google" />
            </div>
            <div className="redirect-spinner"></div>
            <h3>Redirecting to Google</h3>
            <p>You'll be securely redirected to Google's authentication page.</p>
            <div className="security-notice">
              <span className="security-icon">🔒</span>
              <span>Secured by Google OAuth 2.0</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Loading overlay when processing redirect result */}
      {loading && (
        <div className="redirect-overlay">
          <div className="redirect-content">
            <div className="redirect-spinner"></div>
            <h3>Completing Sign In</h3>
            <p>Please wait while we complete your authentication...</p>
          </div>
        </div>
      )}

      <nav className="login-navbar">
        <div className="navbar-left">
          <div className="logo-container">
            <img src="/images/logo.png" alt="Logo" className="logo" />
            <span className="brand">DebateSim</span>
          </div>
        </div>
        <div className="navbar-right">
          <button
            className="btn btn-ghost"
            onClick={handleGuestLogin}
            disabled={loading || redirecting}
          >
            <span className="btn-text">Continue as Guest</span>
          </button>
          <button
            className="btn btn-google"
            onClick={handleGoogleLogin}
            disabled={loading || redirecting}
          >
            {loading ? (
              <div className="loading-container">
                <div className="loading-spinner"></div>
                <span>Completing sign in...</span>
              </div>
            ) : redirecting ? (
              <div className="loading-container">
                <div className="loading-spinner"></div>
                <span>Redirecting to Google...</span>
              </div>
            ) : (
              <div className="google-btn-content">
                <img src="/images/google.png" alt="Google logo" />
                <span>Sign in with Google</span>
              </div>
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
          <div className="hero-content">
            {/* <div className="hero-badge">
              <span className="badge-text">✨ Welcome to the Future of Debate</span>
            </div> */}
            <h1 className="hero-title">
              <span className="title-main">DebateSim</span>
              {/* <span className="title-sub">Develop</span> */}
            </h1>
            <div className="dynamic-text-container">
              <p className="dynamic-text">
                {displayText}
                <span className="typing-cursor" style={{ opacity: isTyping ? 1 : 0 }}>|</span>
              </p>
            </div>
            <div className="hero-actions">
              <button className="btn-start primary" onClick={scrollToNextSection}>
                <span>Start Debating</span>
                <div className="btn-arrow">➤</div>
              </button>
              <button 
                className="btn-start secondary" 
                onClick={handleGoogleLogin}
                disabled={loading || redirecting}
              >
                {loading ? (
                  <>
                    <div className="loading-spinner"></div>
                    <span>Completing sign in...</span>
                  </>
                ) : redirecting ? (
                  <>
                    <div className="loading-spinner"></div>
                    <span>Redirecting to Google...</span>
                  </>
                ) : (
                  <span>Get Started Now</span>
                )}
              </button>
            </div>
          </div>
          <div className="hero-scroll-indicator">
            <div className="scroll-line"></div>
            <span className="scroll-text">Scroll to explore</span>
          </div>
        </section>

        <section
          className="fade-section intro-section"
          ref={el => (sectionsRef.current[1] = el)}
          id="section-1"
        >
          <div className="intro-content">
            <h2 className="section-title">Experience Dynamic Debates</h2>
            <p className="section-description">
              Challenge your thinking with AI-powered opponents and enhance your speaking skills
            </p>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-number">1000+</span>
                <span className="stat-label">Debates Simulated</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">50+</span>
                <span className="stat-label">Topics Available</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">24/7</span>
                <span className="stat-label">AI Availability</span>
              </div>
            </div>
          </div>
        </section>

        <section className="feature-section fade-section" ref={el => (sectionsRef.current[2] = el)}>
          <div className="features-header">
            <h2 className="features-title">Features</h2>
            <p className="features-subtitle">Everything you need to become a master debater</p>
          </div>
          <div className="feature-cards">
            <div className="feature-card" onClick={handleGoogleLogin}>
              <div className="feature-icon">🎯</div>
              <div className="feature-content">
                <h3>Debate Simulator</h3>
                <p>
                  Experience dynamic debates with AI. Challenge your thinking by
                  exploring multiple perspectives, enhance your argumentation
                  skills, and deepen your understanding of complex topics.
                </p>
                <div className="feature-status available">Available Now</div>
              </div>
            </div>
            <div className="feature-card" onClick={handleGoogleLogin}>
              <div className="feature-icon">⚖️</div>
              <div className="feature-content">
                <h3>Bill and Legislation Debate</h3>
                <p>
                  Upload any Congressional bill and engage in thoughtful
                  debates about its merits with friends or AI opponents. Explore
                  legislation from multiple perspectives.
                </p>
                <div className="feature-status coming-soon">Coming Soon</div>
              </div>
            </div>
            <div className="feature-card" onClick={handleGoogleLogin}>
              <div className="feature-icon">🔍</div>
              <div className="feature-content">
                <h3>Bias Detector</h3>
                <p>
                  Evaluate online content for accuracy and bias! Analyze
                  websites, news articles, or any text to identify potential slant
                  and misinformation.
                </p>
                <div className="feature-status coming-soon">Coming Soon</div>
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="error-section">
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              <span>{error}</span>
            </div>
          </div>
        )}
      </main>

      <footer className="footer">
        <div className="footer-content">
          <div className="footer-left">
            <img src="/images/logo.png" alt="Logo" className="footer-logo" />
            <span className="footer-brand">DebateSim</span>
          </div>
          <div className="footer-right">
            <span>© 2025 DebateSim. All rights reserved.</span>
            <a href="https://github.com" className="footer-link">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Login;