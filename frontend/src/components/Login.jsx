import React, { useEffect, useState, useRef } from "react";
import { auth, provider } from "../firebase/firebaseConfig";
import { signInWithPopup } from "firebase/auth";
import { MessageSquare, Code } from "lucide-react";
import "./Login.css";

function Login({ onLogin }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
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

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      // Configure the provider for better UX and consistent popup behavior
      provider.setCustomParameters({
        prompt: 'select_account',
        hd: '', // Remove domain restriction
      });

      // Configure popup settings for better positioning and size
      const result = await signInWithPopup(auth, provider);
      
      // Store user preference to go to DebateSim
      localStorage.setItem('loginRedirect', 'debatesim');
      
      onLogin(result.user);
    } catch (err) {
      console.error("Login error:", err);
      
      // Handle specific Firebase auth errors with user-friendly messages
      let errorMessage = "Failed to sign in with Google. Please try again.";
      
      if (err.code === 'auth/popup-blocked') {
        errorMessage = "Login popup was blocked by your browser. Please allow popups for this site and click 'Sign in with Google' again.";
      } else if (err.code === 'auth/popup-closed-by-user') {
        errorMessage = "Login window was closed. Please try again to complete sign in.";
      } else if (err.code === 'auth/network-request-failed') {
        errorMessage = "Network error. Please check your internet connection and try again.";
      } else if (err.code === 'auth/too-many-requests') {
        errorMessage = "Too many login attempts. Please wait a moment and try again.";
      } else if (err.code === 'auth/unauthorized-domain') {
        errorMessage = "This domain is not authorized for Google sign in. Please contact support.";
      }
      
      setError(errorMessage);
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
    localStorage.setItem('loginRedirect', 'debatesim');
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
            disabled={loading}
          >
            <span className="btn-text">Continue as Guest</span>
          </button>
          <button
            className="btn btn-google"
            onClick={handleGoogleLogin}
            disabled={loading}
            title="Sign in securely with your Google account"
          >
            {loading ? (
              <div className="loading-container">
                <div className="loading-spinner"></div>
                <span>Signing in...</span>
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
        <section className="hero-section" id="hero">
          <div className="hero-content">
            <h1 className="hero-title">
              <span className="title-main">DebateSim</span>
            </h1>
            <div className="dynamic-text-container">
              <p className="dynamic-text">
                {displayText}
                <span className="typing-cursor" style={{ opacity: isTyping ? 1 : 0 }}>|</span>
              </p>
            </div>

            {/* Professional Login Section */}
            <div className="google-login-section">
              <h2 className="login-title">Start Your Debate Journey</h2>
              <p className="login-subtitle">
                Join thousands of users enhancing their debate skills with AI-powered simulations
              </p>
              
              <div className="login-buttons">
                <button
                  className="btn-google-large"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                >
                  {loading ? (
                    <div className="loading-container">
                      <div className="loading-spinner"></div>
                      <span>Signing in...</span>
                    </div>
                  ) : (
                    <>
                      <img src="/images/google.png" alt="Google logo" />
                      <span>Continue with Google</span>
                    </>
                  )}
                </button>
                
                <button
                  className="btn-guest-large"
                  onClick={handleGuestLogin}
                  disabled={loading}
                >
                  Try as Guest
                </button>
              </div>

              {error && (
                <div className="error-message" style={{ marginTop: '1rem' }}>
                  <span className="error-icon">⚠️</span>
                  <span>{error}</span>
                </div>
              )}
            </div>

            <div className="hero-actions">
              <button className="btn-start primary" onClick={scrollToNextSection}>
                <span>Learn More</span>
                <div className="btn-arrow">➤</div>
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
      </main>

      <footer className="footer">
        <div className="footer-links">
          <a
            href="https://docs.google.com/forms/d/e/1FAIpQLSf_bXEj_AJSyY17WA779h-ESk4om3QmPFT4sdyce7wcnwBr7Q/viewform?usp=sharing&ouid=109634392449391866526"
            target="_blank"
            rel="noopener noreferrer"
            className="feedback-link"
          >
            <MessageSquare size={16} />
            Give Feedback
          </a>
          <a
            href="https://github.com/alexliao95311/DebateSim"
            target="_blank"
            rel="noopener noreferrer"
            className="github-link"
          >
            <Code size={16} />
            GitHub
          </a>
        </div>
        <span className="copyright">© {new Date().getFullYear()} DebateSim. All rights reserved.</span>
      </footer>
    </div>
  );
}

export default Login;