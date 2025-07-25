import React, { useEffect, useLayoutEffect, useState, useRef } from "react";
import { auth, provider } from "../firebase/firebaseConfig";
import { signInWithPopup } from "firebase/auth";
import { MessageSquare, Code } from "lucide-react";
import "./Login.css";
import Footer from "./Footer.jsx";

function Login({ onLogin }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentText, setCurrentText] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [isTyping, setIsTyping] = useState(true);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  const sectionsRef = useRef([]);
  const featureCardsRef = useRef(null);

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
      // Configure the provider for better UX
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      
      // Use popup with optimized settings
      const result = await signInWithPopup(auth, provider);
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

  const updateArrowVisibility = () => {
    const container = featureCardsRef.current;
    if (!container) return;
    
    const { scrollLeft, scrollWidth, clientWidth } = container;
    
    // Only show arrows if there's actually overflow (more content than visible area)
    const hasOverflow = scrollWidth > clientWidth;
    
    if (!hasOverflow) {
      // Reset scroll position when there's no overflow
      container.scrollLeft = 0;
      setShowLeftArrow(false);
      setShowRightArrow(false);
      return;
    }
    
    const isAtStart = scrollLeft <= 5; // Small tolerance for floating point precision
    const isAtEnd = scrollLeft >= scrollWidth - clientWidth - 5; // Small tolerance
    
    setShowLeftArrow(!isAtStart);
    setShowRightArrow(!isAtEnd);
  };

  const scrollFeatures = (direction) => {
    const container = featureCardsRef.current;
    if (!container) return;
    
    const scrollAmount = 370;
    container.scrollBy({ 
      left: direction === 'left' ? -scrollAmount : scrollAmount, 
      behavior: 'smooth' 
    });
  };

  // Immediate scroll reset using useLayoutEffect
  useLayoutEffect(() => {
    // Multiple scroll reset methods to ensure it works
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
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

  useEffect(() => {
    const container = featureCardsRef.current;
    if (!container) return;

    const handleScroll = () => updateArrowVisibility();
    const handleResize = () => {
      // Force a reflow to ensure accurate measurements
      setTimeout(() => {
        if (container) {
          container.scrollLeft = container.scrollLeft; // Force reflow
          updateArrowVisibility();
        }
      }, 100);
    };

    container.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleResize);
    
    // Initial check
    setTimeout(() => updateArrowVisibility(), 100);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className="login-container">
      <nav className="login-navbar">
        <div className="login-navbar-left">
          <div className="login-logo-container">
            <img src="/images/logo.png" alt="Logo" className="login-logo" />
            <span className="login-brand">DebateSim</span>
          </div>
        </div>
        <div className="login-navbar-right">
          <button
            className="login-btn login-btn-ghost"
            onClick={handleGuestLogin}
            disabled={loading}
          >
            <span className="login-btn-text">Continue as Guest</span>
          </button>
          <button
            className="login-btn login-btn-google"
            onClick={handleGoogleLogin}
            disabled={loading}
            title="Sign in securely with your Google account"
          >
            {loading ? (
              <div className="login-loading-container">
                <div className="login-loading-spinner"></div>
                <span>Signing in...</span>
              </div>
            ) : (
              <div className="login-google-btn-content">
                <img src="/images/google.png" alt="Google logo" />
                <span>Sign in with Google</span>
              </div>
            )}
          </button>
        </div>
      </nav>

      <main className="login-main">
        <section
          className="login-hero-section"
          ref={el => (sectionsRef.current[0] = el)}
          id="hero"
        >
          <div className="login-hero-content">
            {/* <div className="login-hero-badge">
              <span className="login-badge-text">✨ Welcome to the Future of Debate</span>
            </div> */}
            <h1 className="login-hero-title">
              <span className="login-title-main">DebateSim</span>
              {/* <span className="login-title-sub">Develop</span> */}
            </h1>
            <div className="login-dynamic-text-container">
              <p className="login-dynamic-text">
                {displayText}
                <span className="login-typing-cursor" style={{ opacity: isTyping ? 1 : 0 }}>|</span>
              </p>
            </div>
            <div className="login-hero-actions">
              <button className="login-btn-start primary" onClick={scrollToNextSection}>
                <span>Explore</span>
                <div className="login-btn-arrow">➤</div>
              </button>
              <button 
                className="login-btn-start secondary" 
                onClick={handleGoogleLogin}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="login-loading-spinner"></div>
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Get Started Now</span>
                )}
              </button>
            </div>
          </div>
          <div className="login-hero-scroll-indicator">
            <div className="login-scroll-line"></div>
            <span className="login-scroll-text">Scroll to explore</span>
          </div>
        </section>

        <section
          className="login-fade-section login-intro-section"
          ref={el => (sectionsRef.current[1] = el)}
          id="section-1"
        >
          <div className="login-intro-content">
            <h2 className="login-section-title">Experience Dynamic Debates</h2>
            <p className="login-section-description">
              Challenge your thinking with AI-powered opponents and enhance your speaking skills
            </p>
            <div className="login-stats-grid">
              <div className="login-stat-item">
                <span className="login-stat-number">1000+</span>
                <span className="login-stat-label">Debates Simulated</span>
              </div>
              <div className="login-stat-item">
                <span className="login-stat-number">50+</span>
                <span className="login-stat-label">Topics Available</span>
              </div>
              <div className="login-stat-item">
                <span className="login-stat-number">24/7</span>
                <span className="login-stat-label">AI Availability</span>
              </div>
            </div>
          </div>
        </section>

        <section className="login-feature-section login-fade-section" ref={el => (sectionsRef.current[2] = el)}>
          <div className="login-features-header">
            <h2 className="login-features-title">Features</h2>
            <p className="login-features-subtitle">Everything you need to excel at argumentation</p>
          </div>
          <div className="login-features-container">
            <button 
              className={`login-scroll-arrow login-scroll-arrow-left ${showLeftArrow ? 'visible' : ''}`}
              onClick={() => scrollFeatures('left')}
            >
              ←
            </button>
            <button 
              className={`login-scroll-arrow login-scroll-arrow-right ${showRightArrow ? 'visible' : ''}`}
              onClick={() => scrollFeatures('right')}
            >
              →
            </button>
            <div className="login-feature-cards" ref={featureCardsRef}>
            <div className="login-feature-card" onClick={handleGoogleLogin}>
              <div className="login-feature-icon">🎯</div>
              <div className="login-feature-content">
                <h3>Debate Simulator</h3>
                <p>
                  Experience dynamic debates with AI. Challenge your thinking by
                  exploring multiple perspectives, enhance your argumentation
                  skills, and deepen your understanding of complex topics.
                </p>
                <div className="login-feature-status available">Available Now</div>
              </div>
            </div>
            <div className="login-feature-card" onClick={handleGoogleLogin}>
              <div className="login-feature-icon">⚖️</div>
              <div className="login-feature-content">
                <h3>Bill and Legislation Debate</h3>
                <p>
                  Upload any Congressional bill and engage in thoughtful
                  debates about its merits with friends or AI opponents. Explore
                  legislation from multiple perspectives.
                </p>
                <div className="login-feature-status available">Available Now</div>
              </div>
            </div>
            <div className="login-feature-card" onClick={handleGoogleLogin}>
              <div className="login-feature-icon">🔍</div>
              <div className="login-feature-content">
                <h3>Bias Detector</h3>
                <p>
                  Evaluate online content for accuracy and bias! Analyze
                  websites, news articles, or any text to identify potential slant
                  and misinformation. Perfect for fact-checking and media literacy.
                </p>
                <div className="login-feature-status coming-soon">Coming Soon</div>
              </div>
            </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="login-error-section">
            <div className="login-error-message">
              <span className="login-error-icon">⚠️</span>
              <span>{error}</span>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

export default Login;