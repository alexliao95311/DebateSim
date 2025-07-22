import React, { useState, useEffect } from "react";
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

  useEffect(() => {
    // Force scroll reset with slight delay to ensure it works after navigation
    const scrollTimer = setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }, 0);
    
    // Trigger animations on mount
    const animationTimer = setTimeout(() => setIsVisible(true), 100);
    
    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(animationTimer);
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
      icon: <Gavel className="feature-icon" />,
      status: "active",
      route: "/debatesim",
      tags: ["AI Powered", "Interactive"],
      gradient: "from-blue-500 to-purple-600"
    },
    {
      id: "legislation",
      title: "Bill and Legislation Debate",
      description: "Upload any Congressional bill and engage in thoughtful debates about its merits with friends or AI opponents. Explore legislation from multiple perspectives.",
      icon: <Code className="feature-icon" />,
      status: "beta",
      route: "/legislation",
      tags: ["In Progress", "Collaborative"],
      gradient: "from-green-500 to-teal-600"
    },
    {
      id: "bias-detector",
      title: "Bias Detector",
      description: "Evaluate online content for accuracy and bias! Analyze websites, news articles, or any text to identify potential slant and misinformation.",
      icon: <Shield className="feature-icon" />,
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
          <div className="status-badge status-active">
            <CheckCircle size={14} />
            <span>Live</span>
          </div>
        );
      case "beta":
        return (
          <div className="status-badge status-beta">
            <Zap size={14} />
            <span>Beta</span>
          </div>
        );
      case "coming-soon":
        return (
          <div className="status-badge status-coming-soon">
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
        <div className="header-content">
          <div className="header-left">
            <div className="brand-section">
              <Award className="brand-icon" />
            </div>
          </div>

          <div className="header-center">
            <h1 className="site-title">Feature Hub</h1>
          </div>

          <div className="header-right">
            <div className="user-section">
              <div className="user-info">
                <User className="user-icon" />
                <span className="username">{user?.displayName}</span>
              </div>
              <button className="logout-button" onClick={handleLogout}>
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="main-content">
        <div className={`hero-section ${isVisible ? 'visible' : ''}`}>
          <h1 className="welcome-message">
            Welcome back, <span className="username-highlight">{user?.displayName}</span>
          </h1>
          <p className="hero-subtitle">
            Explore powerful tools for debate, analysis, and critical thinking
          </p>
        </div>

        <div className="section-header">
          <h2>Select a Feature</h2>
          <div className="feature-stats">
            <div className="stat-item">
              <TrendingUp size={16} />
              <span>{features.filter(f => f.status === 'active').length} Active</span>
            </div>
            <div className="stat-item">
              <Clock size={16} />
              <span>{features.filter(f => f.status === 'beta').length} In Progress</span>
            </div>
          </div>
        </div>

        <div className="feature-sections">
          {features.map((feature, index) => (
            <div
              key={feature.id}
              className={`feature feature-${feature.status} ${isVisible ? 'visible' : ''}`}
              style={{ animationDelay: `${index * 0.1}s` }}
              onMouseEnter={() => setHoveredFeature(feature.id)}
              onMouseLeave={() => setHoveredFeature(null)}
              onClick={() => handleFeatureClick(feature)}
            >
              <div className="feature-header">
                <div className="feature-icon-container">
                  {feature.icon}
                </div>
                {getStatusBadge(feature.status)}
              </div>

              <div className="feature-content">
                <h3>{feature.title}</h3>
                <p className="feature-description">{feature.description}</p>
                
                <div className="feature-tags">
                  {feature.tags.map((tag, tagIndex) => (
                    <span key={tagIndex} className="feature-tag">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="feature-footer">
                  <button 
                    className={`feature-button ${feature.status === 'coming-soon' ? 'disabled' : ''}`}
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
                        className={`arrow-icon ${hoveredFeature === feature.id ? 'moved' : ''}`}
                      />
                    )}
                  </button>
                
              </div>

              {/* Hover overlay effect */}
              <div className="feature-overlay"></div>
            </div>
          ))}
        </div>

        <div className="additional-info">
          <div className="info-card">
            <Star className="info-icon" />
            <div>
              <h4>More Features Coming Soon</h4>
              <p>We're constantly working on new tools to enhance your experience</p>
            </div>
          </div>
        </div>
      </div>

      <footer className="bottom-text">
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
        <span className="copyright">&copy; {new Date().getFullYear()} DebateSim. All rights reserved.</span>
      </footer>
    </div>
  );
}

export default Home;