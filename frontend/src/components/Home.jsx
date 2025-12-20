import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth, signOut } from "firebase/auth";
import { getFirestore, collection, getDocs, query, orderBy } from "firebase/firestore";
import UserDropdown from "./UserDropdown";
import { useTranslation } from "../utils/translations";
import {
  Code,
  Gavel,
  Shield,
  ChevronRight,
  Star,
  Clock,
  CheckCircle,
  Zap,
  TrendingUp,
  Award,
  MessageSquare,
  Trophy,
  Lightbulb,
} from "lucide-react";
import "./Home.css";
import Footer from "./Footer.jsx";

console.log("API_URL:", import.meta.env.VITE_API_URL);

function Home({ user, onLogout }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [hoveredFeature, setHoveredFeature] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const [topicOfDay, setTopicOfDay] = useState("");
  const [currentDate, setCurrentDate] = useState("");
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
    
    // Fetch topics.txt and calculate topic of the day
    const loadTopicOfDay = async () => {
      try {
        const response = await fetch('/topics.txt');
        const text = await response.text();
        const topics = text.split('\n').filter(topic => topic.trim().length > 0);
        
        // Calculate days since a reference date (e.g., Jan 1, 2024)
        const referenceDate = new Date(2025, 11, 4); // January 1, 2024
        const today = new Date();
        
        // Reset time to midnight for accurate day count
        today.setHours(0, 0, 0, 0);
        referenceDate.setHours(0, 0, 0, 0);
        
        const daysSinceReference = Math.floor((today - referenceDate) / (1000 * 60 * 60 * 24));
        const topicIndex = daysSinceReference % topics.length;
        
        setTopicOfDay(topics[topicIndex]);
        
        // Format date as readable string
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const dateString = today.toLocaleDateString(undefined, options);
        setCurrentDate(dateString);
        
        console.log(`Topic of the Day (${dateString}): ${topics[topicIndex]}`);
      } catch (error) {
        console.error("Error loading topics.txt:", error);
        setTopicOfDay("Should AI be regulated like a public utility?");
      }
    };
    
    loadTopicOfDay();
    
    return () => {
      clearTimeout(animationTimer);
    };
  }, []);



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
      title: t('home.feature.debateSim.title'),
      description: t('home.feature.debateSim.description'),
      icon: <Gavel className="home-feature-icon" />,
      status: "active",
      route: "/debatesim",
      tags: [t('home.tag.aiPowered'), t('home.tag.interactive')],
      gradient: "from-blue-500 to-purple-600"
    },
    {
      id: "legislation",
      title: t('home.feature.legislation.title'),
      description: t('home.feature.legislation.description'),
      icon: <Code className="home-feature-icon" />,
      status: "active",
      route: "/legislation",
      tags: [t('home.tag.aiPoweredAnalysis'), t('home.tag.collaborative')],
      gradient: "from-green-500 to-teal-600"
    },
    {
      id: "debate-trainer",
      title: t('home.feature.debateTrainer.title'),
      description: t('home.feature.debateTrainer.description'),
      icon: <Award className="home-feature-icon" />,
      status: "active",
      route: "/debatetrainer",
      tags: [t('home.tag.training')],
      gradient: "from-orange-500 to-red-600"
    },
    {
      id: "leaderboard",
      title: "AI Debate Leaderboard",
      description: "Rank AI models based on their debate performance with ELO ratings",
      icon: <Trophy className="home-feature-icon" />,
      status: "active",
      route: "/leaderboard",
      tags: ["ELO Ranking", "AI Benchmark"],
      gradient: "from-yellow-500 to-amber-600"
    },
  ];

  const getStatusBadge = (status) => {
    switch (status) {
      case "active":
        return (
          <div className="home-status-badge home-status-active">
            <CheckCircle size={14} />
            <span>{t('home.live')}</span>
          </div>
        );
      case "beta":
        return (
          <div className="home-status-badge home-status-beta">
            <Zap size={14} />
            <span>{t('home.beta')}</span>
          </div>
        );
      case "coming-soon":
        return (
          <div className="home-status-badge home-status-coming-soon">
            <Clock size={14} />
            <span>{t('home.comingSoon')}</span>
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
            {/* Empty space for alignment */}
          </div>

          <div className="home-header-center" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1
          }}>
            <h1 className="home-site-title">{t('home.featureHub')}</h1>
          </div>

          <div className="home-header-right">
            <UserDropdown user={user} onLogout={handleLogout} className="home-user-dropdown" />
          </div>
        </div>
      </header>

      <div className="home-main-content">
        <div className={`home-hero-section ${isVisible ? 'visible' : ''}`}>
          <h1 className="home-welcome-message">
            {t('home.welcomeBack')} <span className="home-username-highlight">{user?.displayName}</span>
          </h1>
          <p className="home-hero-subtitle">
            {t('home.exploreTools')}
          </p>
        </div>

        {/* Topic of the Day Section */}
        <div className={`home-topic-of-day ${isVisible ? 'visible' : ''}`}>
          <div className="home-topic-header">
            <Lightbulb className="home-topic-icon" />
            <h2>Topic of the Day</h2>
          </div>
          <div className="home-topic-card">
            <p className="home-topic-date">{currentDate}</p>
            <p className="home-topic-text">{topicOfDay}</p>
            <div className="home-topic-meta">
              <button 
                className="home-topic-button"
                onClick={() => navigate('/debatesim', { state: { topicOfDay: topicOfDay } })}
              >
                Debate This Topic →
              </button>
            </div>
          </div>
        </div>

        <div className="home-section-header">
          <h2>{t('home.selectFeature')}</h2>
          <div className="home-feature-stats">
            {features.filter(f => f.status === 'active').length > 0 && (
              <div className="home-stat-item">
                <TrendingUp size={16} />
                <span>{features.filter(f => f.status === 'active').length} {t('home.active')}</span>
              </div>
            )}
            {features.filter(f => f.status === 'beta').length > 0 && (
              <div className="home-stat-item">
                <Clock size={16} />
                <span>{features.filter(f => f.status === 'beta').length} {t('home.inProgress')}</span>
              </div>
            )}
            {features.filter(f => f.status === 'coming-soon').length > 0 && (
              <div className="home-stat-item">
                <TrendingUp size={16} />
                <span>{features.filter(f => f.status === 'coming-soon').length} {t('home.comingSoon')}</span>
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
                        {feature.status === 'coming-soon' ? t('home.comingSoon') : 
                         feature.status === 'beta' ? t('home.tryBeta') : 
                         `${t('home.launch')} ${feature.title.split(' ')[0]}`}
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
              <h4>{t('home.moreFeatures')}</h4>
              <p>{t('home.moreFeaturesDesc')}</p>
            </div>
          </div>
        </div>
      </div>

      
      <Footer />
    </div>
  );
}

export default Home;
