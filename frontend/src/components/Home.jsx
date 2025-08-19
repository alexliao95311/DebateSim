import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth, signOut } from "firebase/auth";
import { getFirestore, collection, getDocs, query, orderBy } from "firebase/firestore";
import HistorySidebar from "./HistorySidebar";
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
  MessageSquare,
  History,
  ChevronDown,
  Menu
} from "lucide-react";
import "./Home.css";
import Footer from "./Footer.jsx";

console.log("API_URL:", import.meta.env.VITE_API_URL);

function Home({ user, onLogout }) {
  const navigate = useNavigate();
  const [hoveredFeature, setHoveredFeature] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const [history, setHistory] = useState([]);
  const [showHistorySidebar, setShowHistorySidebar] = useState(false);
  const [showMobileDropdown, setShowMobileDropdown] = useState(false);
  const featureCardsRef = useRef(null);
  const dropdownRef = useRef(null);

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

  // Handle click outside dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowMobileDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch debate history on load
  useEffect(() => {
    async function fetchHistory() {
      if (!user || user.isGuest) return;
      try {
        const db = getFirestore();
        const transcriptsRef = collection(db, "users", user.uid, "transcripts");
        const q = query(transcriptsRef, orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const fetchedHistory = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setHistory(fetchedHistory);
        }
      } catch (err) {
        console.error("Error fetching debate history:", err);
      }
    }
    fetchHistory();
  }, [user]);

  const updateArrowVisibility = () => {
    const container = featureCardsRef.current;
    if (!container) return;
    
    const { scrollLeft, scrollWidth, clientWidth } = container;
    
    // Only show arrows if there's actually overflow (more content than visible area)
    const hasOverflow = scrollWidth > clientWidth + 10; // Add small buffer
    
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
    
    const scrollAmount = 370; // Increased to account for gaps
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

  const handleLogout = () => {
    // Reset scroll position before logout
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    
    signOut(getAuth()) 
      .then(() => {
        // Additional scroll reset after navigation
        setTimeout(() => {
          window.scrollTo(0, 0);
          document.documentElement.scrollTop = 0;
          document.body.scrollTop = 0;
        }, 0);
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
      status: "active",
      route: "/legislation",
      tags: ["AI Powered Analysis", "Collaborative"],
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
    },
    {
      id: "debate-trainer",
      title: "Debate Trainer",
      description: "Sharpen your debate skills with AI-powered training. Face off against bots of different skill levels, receive personalized feedback, and master any format or styles with feedback tailored to you.",
      icon: <Gavel className="home-feature-icon" />,
      status: "beta",
      route: "/debatesim",
      tags: ["Personalized", "Interactive"],
      gradient: "from-blue-500 to-purple-600"
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
    <div className={`home-container ${showHistorySidebar ? 'home-sidebar-open' : ''}`}>
      <header className="home-header">
        <div className="home-header-content">
          <div className="home-header-left">
            <button
              className="home-history-button"
              onClick={() => setShowHistorySidebar(!showHistorySidebar)}
            >
              <History size={18} />
              <span>History</span>
            </button>
          </div>

          <div className="home-header-center">
            <h1 className="home-site-title">Feature Hub</h1>
          </div>

          <div className="home-header-right">
            {/* Desktop user section */}
            <div className="home-user-section home-desktop-user">
              <div className="home-user-info">
                <User className="home-user-icon" />
                <span className="home-username">{user?.displayName}</span>
              </div>
              <button className="home-logout-button" onClick={handleLogout}>
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            </div>

            {/* Mobile dropdown */}
            <div className="home-mobile-dropdown-container" ref={dropdownRef}>
              <button
                className="home-mobile-dropdown-trigger"
                onClick={() => setShowMobileDropdown(!showMobileDropdown)}
              >
                <Menu size={18} />
                <ChevronDown size={16} className={`home-dropdown-arrow ${showMobileDropdown ? 'rotated' : ''}`} />
              </button>

              {showMobileDropdown && (
                <div className="home-mobile-dropdown-menu">
                  <div className="home-dropdown-user-info">
                    <User size={16} />
                    <span>{user?.displayName}</span>
                  </div>
                  <button
                    className="home-dropdown-option"
                    onClick={() => {
                      setShowHistorySidebar(!showHistorySidebar);
                      setShowMobileDropdown(false);
                    }}
                  >
                    <History size={16} />
                    <span>History</span>
                  </button>
                  <button
                    className="home-dropdown-option home-dropdown-logout"
                    onClick={() => {
                      handleLogout();
                      setShowMobileDropdown(false);
                    }}
                  >
                    <LogOut size={16} />
                    <span>Logout</span>
                  </button>
                </div>
              )}
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
            {features.filter(f => f.status === 'active').length > 0 && (
              <div className="home-stat-item">
                <TrendingUp size={16} />
                <span>{features.filter(f => f.status === 'active').length} Active</span>
              </div>
            )}
            {features.filter(f => f.status === 'beta').length > 0 && (
              <div className="home-stat-item">
                <Clock size={16} />
                <span>{features.filter(f => f.status === 'beta').length} In Progress</span>
              </div>
            )}
            {features.filter(f => f.status === 'coming-soon').length > 0 && (
              <div className="home-stat-item">
                <TrendingUp size={16} />
                <span>{features.filter(f => f.status === 'coming-soon').length} Coming Soon</span>
              </div>
            )}
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

      <HistorySidebar 
        user={user}
        history={history}
        showHistorySidebar={showHistorySidebar}
        setShowHistorySidebar={setShowHistorySidebar}
        componentPrefix="home"
      />
      
      <Footer />
    </div>
  );
}

export default Home;
