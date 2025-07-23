import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth, signOut } from "firebase/auth";
import { 
  Code, 
  Gavel, 
  Shield, 
  ChevronRight, 
  Star, 
  Clock, 
  CheckCircle,
  User,
  LogOut,
  Zap,
  TrendingUp,
  Award,
  MessageSquare
} from "lucide-react";
import "./Home.css";

console.log("API_URL:", import.meta.env.VITE_API_URL);

function Home({ user, onLogout }) {
  const navigate = useNavigate();
  const [hoveredFeature, setHoveredFeature] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const featureCardsRef = useRef(null);

  // Immediate scroll reset using useLayoutEffect (like DebateSim.jsx)
  useLayoutEffect(() => {
    // Multiple scroll reset methods to ensure it works
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  useEffect(() => {
    // Trigger animations on mount
    const animationTimer = setTimeout(() => setIsVisible(true), 100);
    
    return () => {
      clearTimeout(animationTimer);
    };
  }, []);

  const updateArrowVisibility = () => {
    const container = featureCardsRef.current;
    if (!container) return;
    
    const { scrollLeft, scrollWidth, clientWidth } = container;
    const isAtStart = scrollLeft <= 5; // Small tolerance for floating point precision
    const isAtEnd = scrollLeft >= scrollWidth - clientWidth - 5; // Small tolerance
    
    setShowLeftArrow(!isAtStart);
    setShowRightArrow(!isAtEnd);
  };

  const scrollFeatures = (direction) => {
    const container = featureCardsRef.current;
    if (!container) return;
    
    const scrollAmount = 350;
    container.scrollBy({ 
      left: direction === 'left' ? -scrollAmount : scrollAmount, 
      behavior: 'smooth' 
    });
  };

  useEffect(() => {
    const container = featureCardsRef.current;
    if (!container) return;

    const handleScroll = () => updateArrowVisibility();
    const handleResize = () => {
      setTimeout(() => updateArrowVisibility(), 100);
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

  const handleLogout = () => {
    signOut(getAuth()) 
      .then(() => {
        onLogout();
      })
      .catch((err) => console.error("Logout error.", err));
  };

  const features = [
    {
      id: "debate-sim",
      title: "Debate Simulator",
      description: "Experience dynamic debates with AI. Challenge your thinking by exploring multiple perspectives, enhance your argumentation skills, and deepen your understanding of complex topics.",
      icon: <Gavel className="home-feature-icon" />,
      status: "active",
      route: "/debatesim",
      tags: ["AI Powered", "Interactive"],
      gradient: "from-blue-500 to-purple-600"
    },
    {
      id: "legislation",
      title: "Bill and Legislation Debate",
      description: "Upload any Congressional bill and engage in thoughtful debates about its merits with friends or AI opponents. Explore legislation from multiple perspectives.",
      icon: <Code className="home-feature-icon" />,
      status: "beta",
      route: "/legislation",
      tags: ["In Progress", "Collaborative"],
      gradient: "from-green-500 to-teal-600"
    },
    {
      id: "bias-detector",
      title: "Bias Detector",
      description: "Evaluate online content for accuracy and bias! Analyze websites, news articles, or any text to identify potential slant and misinformation.",
      icon: <Shield className="home-feature-icon" />,
      status: "coming-soon",
      route: null,
      tags: ["Coming Soon", "Analysis"],
      gradient: "from-orange-500 to-red-600"
    }
  ];

  const getStatusBadge = (status) => {
    switch (status) {
      case "active":
        return (
          <div className="home-status-badge home-status-active">
            <CheckCircle size={14} />
            <span>Live</span>
          </div>
        );
      case "beta":
        return (
          <div className="home-status-badge home-status-beta">
            <Zap size={14} />
            <span>Beta</span>
          </div>
        );
      case "coming-soon":
        return (
          <div className="home-status-badge home-status-coming-soon">
            <Clock size={14} />
            <span>Coming Soon</span>
          </div>
        );
      default:
        return null;
    }
  };

  const handleFeatureClick = (feature) => {
    if (feature.status === "coming-soon") return;
    
    // Force immediate scroll reset before navigation
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    
    navigate(feature.route, { replace: false, state: { scrollReset: true } });
  };

  return (
    <div className="home-container">
      <header className="home-header">
        <div className="home-header-content">
          <div className="home-header-left">
            <div className="home-brand-section">
              <Award className="home-brand-icon" />
            </div>
          </div>

          <div className="home-header-center">
            <h1 className="home-site-title">Feature Hub</h1>
          </div>

          <div className="home-header-right">
            <div className="home-user-section">
              <div className="home-user-info">
                <User className="home-user-icon" />
                <span className="home-username">{user?.displayName}</span>
              </div>
              <button className="home-logout-button" onClick={handleLogout}>
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="home-main-content">
        <div className={`home-hero-section ${isVisible ? 'visible' : ''}`}>
          <h1 className="home-welcome-message">
            Welcome back, <span className="home-username-highlight">{user?.displayName}</span>
          </h1>
          <p className="home-hero-subtitle">
            Explore powerful tools for debate, analysis, and critical thinking
          </p>
        </div>

        <div className="home-section-header">
          <h2>Select a Feature</h2>
          <div className="home-feature-stats">
            <div className="home-stat-item">
              <TrendingUp size={16} />
              <span>{features.filter(f => f.status === 'active').length} Active</span>
            </div>
            <div className="home-stat-item">
              <Clock size={16} />
              <span>{features.filter(f => f.status === 'beta').length} In Progress</span>
            </div>
          </div>
        </div>

        <div className="home-features-container">
          <button 
            className={`home-scroll-arrow home-scroll-arrow-left ${showLeftArrow ? 'visible' : ''}`}
            onClick={() => scrollFeatures('left')}
          >
            ←
          </button>
          <button 
            className={`home-scroll-arrow home-scroll-arrow-right ${showRightArrow ? 'visible' : ''}`}
            onClick={() => scrollFeatures('right')}
          >
            →
          </button>
          <div className="home-feature-cards" ref={featureCardsRef}>
            {features.map((feature, index) => (
              <div
                key={feature.id}
                className={`home-feature home-feature-${feature.status} ${isVisible ? 'visible' : ''}`}
                style={{ animationDelay: `${index * 0.1}s` }}
                onMouseEnter={() => setHoveredFeature(feature.id)}
                onMouseLeave={() => setHoveredFeature(null)}
                onClick={() => handleFeatureClick(feature)}
              >
                <div className="home-feature-header">
                  <div className="home-feature-icon-container">
                    {feature.icon}
                  </div>
                  {getStatusBadge(feature.status)}
                </div>

                <div className="home-feature-content">
                  <h3>{feature.title}</h3>
                  <p className="home-feature-description">{feature.description}</p>
                  
                  <div className="home-feature-tags">
                    {feature.tags.map((tag, tagIndex) => (
                      <span key={tagIndex} className="home-feature-tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="home-feature-footer">
                    <button 
                      className={`home-feature-button ${feature.status === 'coming-soon' ? 'disabled' : ''}`}
                      disabled={feature.status === 'coming-soon'}
                    >
                      <span>
                        {feature.status === 'coming-soon' ? 'Coming Soon' : 
                         feature.status === 'beta' ? 'Try Beta' : 
                         `Launch ${feature.title.split(' ')[0]}`}
                      </span>
                      {feature.status !== 'coming-soon' && (
                        <ChevronRight 
                          size={16} 
                          className={`home-arrow-icon ${hoveredFeature === feature.id ? 'moved' : ''}`}
                        />
                      )}
                    </button>
                  
                </div>

                {/* Hover overlay effect */}
                <div className="home-feature-overlay"></div>
              </div>
            ))}
          </div>
        </div>

        <div className="home-additional-info">
          <div className="home-info-card">
            <Star className="home-info-icon" />
            <div>
              <h4>More Features Coming Soon</h4>
              <p>We're constantly working on new tools to enhance your experience</p>
            </div>
          </div>
        </div>
      </div>

      <footer className="home-bottom-text">
        <div className="home-footer-links">
          <a
            href="https://docs.google.com/forms/d/e/1FAIpQLSf_bXEj_AJSyY17WA779h-ESk4om3QmPFT4sdyce7wcnwBr7Q/viewform?usp=sharing&ouid=109634392449391866526"
            target="_blank"
            rel="noopener noreferrer"
            className="home-feedback-link"
          >
            <MessageSquare size={16} />
            Give Feedback
          </a>
          <a
            href="https://github.com/alexliao95311/DebateSim"
            target="_blank"
            rel="noopener noreferrer"
            className="home-github-link"
          >
            <Code size={16} />
            GitHub
          </a>
        </div>
        <span className="home-copyright">&copy; {new Date().getFullYear()} DebateSim. All rights reserved.</span>
      </footer>
    </div>
  );
}

export default Home;