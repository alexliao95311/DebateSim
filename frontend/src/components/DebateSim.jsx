import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import { getFirestore, collection, getDocs, query, orderBy } from "firebase/firestore";
import { auth } from "../firebase/firebaseConfig";
import { signOut, getAuth } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import HistorySidebar from "./HistorySidebar";
import { 
  Users, 
  Bot, 
  UserCheck, 
  PlayCircle, 
  History, 
  User,
  LogOut,
  Award,
  ChevronRight,
  ChevronDown,
  Menu
} 
from "lucide-react";
import "./DebateSim.css";
import Footer from "./Footer.jsx";

function DebateSim({ user }) {
  const [mode, setMode] = useState("");
  const [debateTopic, setDebateTopic] = useState("AI does more good than harm");
  const [history, setHistory] = useState([]);
  const [showHistorySidebar, setShowHistorySidebar] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [hoveredMode, setHoveredMode] = useState(null);
  const [showMobileDropdown, setShowMobileDropdown] = useState(false);
  
  // Persona selection states
  const [proPersona, setProPersona] = useState("default");
  const [conPersona, setConPersona] = useState("default");
  const [aiPersona, setAiPersona] = useState("default");
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const pdfContentRef = useRef(null);
  const topicSectionRef = useRef(null);
  const personaCardsRef = useRef(null);
  const personaSectionRef = useRef(null);

  // Immediate scroll reset using useLayoutEffect
  useLayoutEffect(() => {
    // Multiple scroll reset methods to ensure it works
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  // Animation trigger
  useEffect(() => {
    // Start animations after a brief delay
    const animationTimer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(animationTimer);
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

  // Fetch history on load
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

  // Auto-scroll to persona section when mode is selected
  useEffect(() => {
    if (mode && personaSectionRef.current) {
      // Add a small delay to ensure the UI has updated
      setTimeout(() => {
        personaSectionRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start',
          inline: 'nearest'
        });
      }, 300);
    }
  }, [mode]);

  // Auto-scroll to topic section when personas are selected
  useEffect(() => {
    if (mode && topicSectionRef.current) {
      const shouldScroll = mode === 'user-vs-user' || 
        (mode === 'ai-vs-user' && aiPersona !== 'default') ||
        (mode === 'ai-vs-ai' && proPersona !== 'default' && conPersona !== 'default');
      
      if (shouldScroll) {
        setTimeout(() => {
          topicSectionRef.current?.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start',
            inline: 'nearest'
          });
        }, 300);
      }
    }
  }, [mode, aiPersona, proPersona, conPersona]);

  // Persona cards scroll behavior
  useEffect(() => {
    const container = personaCardsRef.current;
    if (!container) return;

    const handleScroll = () => {
      requestAnimationFrame(() => updateArrowVisibility());
    };
    
    const handleResize = () => {
      // Force a reflow to ensure accurate measurements
      setTimeout(() => {
        if (container && personaCardsRef.current) {
          updateArrowVisibility();
        }
      }, 150);
    };

    // Add event listeners
    container.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);
    
    // Initial checks with multiple timeouts to ensure proper initialization
    setTimeout(() => updateArrowVisibility(), 100);
    setTimeout(() => updateArrowVisibility(), 300);
    setTimeout(() => updateArrowVisibility(), 600);

    return () => {
      if (container) {
        container.removeEventListener('scroll', handleScroll);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Additional effect to check arrows when mode changes (personas become visible)
  useEffect(() => {
    if (mode && (mode === 'ai-vs-ai' || mode === 'ai-vs-user')) {
      setTimeout(() => updateArrowVisibility(), 200);
      setTimeout(() => updateArrowVisibility(), 500);
    }
  }, [mode]);

  const modes = [
    {
      id: "ai-vs-ai",
      title: "AI vs AI",
      description: "Watch two AI systems debate each other with advanced reasoning and counter-arguments",
      icon: <Bot size={48} />,
      tags: ["Automated", "Analysis"],
      color: "from-blue-500 to-purple-600"
    },
    {
      id: "ai-vs-user",
      title: "AI vs User",
      description: "Challenge yourself against AI. Test your debating skills and learn new perspectives",
      icon: <UserCheck size={48} />,
      tags: ["Interactive", "Educational"],
      color: "from-green-500 to-teal-600"
    },
    {
      id: "user-vs-user",
      title: "User vs User",
      description: "Debate with friends or colleagues. Perfect for educational discussions and team activities",
      icon: <Users size={48} />,
      tags: ["Collaborative", "Social"],
      color: "from-orange-500 to-red-600"
    }
  ];

  const personas = [
    {
      id: "default",
      name: "Default AI",
      description: "Standard debate style",
      image: "/images/default-ai.png"
    },
    {
      id: "trump",
      name: "Donald Trump",
      description: "Bold, direct speaking style",
      image: "/images/trump-placeholder.png"
    },
    {
      id: "harris",
      name: "Kamala Harris",
      description: "Prosecutorial, precise debate style",
      image: "/images/harris-placeholder.png"
    },
    {
      id: "musk",
      name: "Elon Musk",
      description: "Innovative, tech-focused approach",
      image: "/images/musk-placeholder.png"
    },
    {
      id: "drake",
      name: "Drake",
      description: "Charismatic, cultural references",
      image: "/images/drake-placeholder.png"
    }
  ];

  const updateArrowVisibility = () => {
    const container = personaCardsRef.current;
    if (!container) {
      setShowLeftArrow(false);
      setShowRightArrow(false);
      return;
    }
    
    // Force reflow to get accurate measurements
    const { scrollLeft, scrollWidth, clientWidth } = container;
    
    
    // Only show arrows if there's actually overflow (more content than visible area)
    const hasOverflow = scrollWidth > clientWidth + 20; // Increased buffer
    
    if (!hasOverflow) {
      setShowLeftArrow(false);
      setShowRightArrow(false);
      return;
    }
    
    const isAtStart = scrollLeft <= 20; // Increased tolerance
    const isAtEnd = scrollLeft >= scrollWidth - clientWidth - 20; // Increased tolerance
    
    setShowLeftArrow(!isAtStart);
    setShowRightArrow(!isAtEnd);
  };

  const scrollPersonas = (direction) => {
    const container = personaCardsRef.current;
    if (!container) return;
    
    const cardWidth = 260;
    const gap = 32; // 2rem gap
    const scrollAmount = cardWidth + gap;
    
    const targetScrollLeft = direction === 'left' 
      ? container.scrollLeft - scrollAmount 
      : container.scrollLeft + scrollAmount;
    
    container.scrollTo({ 
      left: targetScrollLeft, 
      behavior: 'smooth' 
    });
    
    // Update arrows after scroll animation completes
    setTimeout(() => updateArrowVisibility(), 400);
  };

  const handleStartDebate = () => {
    if (!mode) {
      alert("Please select a debate mode before starting.");
      return;
    }
    if (!debateTopic.trim()) {
      alert("Please enter a debate topic.");
      return;
    }
    navigate("/debate", { 
      state: { 
        mode, 
        topic: debateTopic,
        proPersona,
        conPersona,
        aiPersona
      } 
    });
  };

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
        navigate("/");
      })
      .catch((err) => console.error("Logout error:", err));
  };

  return (
    <div className={`debatesim-container ${showHistorySidebar ? 'debatesim-sidebar-open' : ''}`}>
      <header className="debatesim-header">
        <div className="debatesim-header-content">
          {/* LEFT SECTION: History Button */}
          <div className="debatesim-header-left">
            <button
              className="debatesim-history-button"
              onClick={() => setShowHistorySidebar(!showHistorySidebar)}
            >
              <History size={18} />
              <span>History</span>
            </button>
          </div>

          {/* CENTER SECTION: Title */}
          <div className="debatesim-header-center">
            <h1 className="debatesim-site-title" onClick={() => navigate("/")}>
              Debate Simulator
            </h1>
          </div>

          {/* RIGHT SECTION: User + Logout */}
          <div className="debatesim-header-right">
            {/* Desktop user section */}
            <div className="debatesim-user-section debatesim-desktop-user">
              <div className="debatesim-user-info">
                <User size={18} />
                <span>{user?.displayName}</span>
              </div>
              <button className="debatesim-logout-button" onClick={handleLogout}>
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            </div>

            {/* Mobile dropdown */}
            <div className="debatesim-mobile-dropdown-container" ref={dropdownRef}>
              <button
                className="debatesim-mobile-dropdown-trigger"
                onClick={() => setShowMobileDropdown(!showMobileDropdown)}
              >
                <Menu size={18} />
                <ChevronDown size={16} className={`debatesim-dropdown-arrow ${showMobileDropdown ? 'rotated' : ''}`} />
              </button>

              {showMobileDropdown && (
                <div className="debatesim-mobile-dropdown-menu">
                  <div className="debatesim-dropdown-user-info">
                    <User size={16} />
                    <span>{user?.displayName}</span>
                  </div>
                  <button
                    className="debatesim-dropdown-option"
                    onClick={() => {
                      setShowHistorySidebar(!showHistorySidebar);
                      setShowMobileDropdown(false);
                    }}
                  >
                    <History size={16} />
                    <span>History</span>
                  </button>
                  <button
                    className="debatesim-dropdown-option debatesim-dropdown-logout"
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

      <div className="debatesim-main-content">
        {/* Hero Section */}
        <div className={`debatesim-hero-section ${isVisible ? 'debatesim-visible' : ''}`}>
          <h1 className="debatesim-welcome-message">
            Welcome back, <span className="debatesim-username-highlight">{user?.displayName}</span>
          </h1>
          <p className="debatesim-hero-subtitle">
            Choose your debate mode and engage in thoughtful discussions
          </p>
        </div>

        {/* Mode Selection Section */}
        <div className={`debatesim-section ${isVisible ? 'debatesim-visible' : ''}`} style={{ animationDelay: '0.2s' }}>
          <h2 className="debatesim-section-title">Select a Debate Mode</h2>
          <div className="debatesim-mode-grid">
            {modes.map((modeOption, index) => (
              <div
                key={modeOption.id}
                className={`debatesim-mode-card ${mode === modeOption.id ? 'debatesim-selected' : ''}`}
                onMouseEnter={() => setHoveredMode(modeOption.id)}
                onMouseLeave={() => setHoveredMode(null)}
                style={{ animationDelay: `${0.3 + index * 0.1}s` }}
              >
                <div className="debatesim-mode-icon">
                  {modeOption.icon}
                </div>
                <h3 className="debatesim-mode-title">{modeOption.title}</h3>
                <p className="debatesim-mode-description">{modeOption.description}</p>
                <div className="debatesim-mode-tags">
                  {modeOption.tags.map((tag, tagIndex) => (
                    <span key={tagIndex} className="debatesim-mode-tag">
                      {tag}
                    </span>
                  ))}
                </div>
                <button 
                  className={`debatesim-mode-select-btn ${mode === modeOption.id ? 'debatesim-selected' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMode(modeOption.id);
                  }}
                >
                  {mode === modeOption.id ? (
                    <>
                      <span>✓ Selected</span>
                    </>
                  ) : (
                    <>
                      <span>Select Mode</span>
                      <ChevronRight size={16} />
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Persona Selection Section */}
        <div ref={personaSectionRef} className={`debatesim-section ${isVisible ? 'debatesim-visible' : ''}`} style={{ animationDelay: '0.4s' }}>
          <h2 className="debatesim-section-title">Select Debate Personas</h2>
          <p className="debatesim-section-subtitle">
            {!mode ? 'Select a debate mode first to choose personas' :
             mode === 'ai-vs-ai' ? 'Choose personas for both sides of the debate' : 
             mode === 'ai-vs-user' ? 'Choose a persona for your AI opponent' : 
             'No persona selection needed for user vs user mode'}
          </p>
          
          {mode && (mode === 'ai-vs-ai' || mode === 'ai-vs-user') && (
              <div className="debatesim-persona-container">
                <button 
                  className={`debatesim-scroll-arrow debatesim-scroll-arrow-left ${showLeftArrow ? 'visible' : ''}`}
                  onClick={() => scrollPersonas('left')}
                >
                  ←
                </button>
                <button 
                  className={`debatesim-scroll-arrow debatesim-scroll-arrow-right ${showRightArrow ? 'visible' : ''}`}
                  onClick={() => scrollPersonas('right')}
                >
                  →
                </button>
                
                <div className="debatesim-persona-cards" ref={personaCardsRef}>
                  {personas.map((persona) => (
                    <div
                      key={persona.id}
                      className={`debatesim-persona-card ${
                        (mode === 'ai-vs-ai' && (proPersona === persona.id || conPersona === persona.id)) ||
                        (mode === 'ai-vs-user' && aiPersona === persona.id) ? 'debatesim-selected' : ''
                      }`}
                    >
                      <div className="debatesim-persona-photo">
                        <div className="debatesim-photo-placeholder">
                          <Users size={48} />
                        </div>
                      </div>
                      <div className="debatesim-persona-info">
                        <h3>{persona.name}</h3>
                        <p className="debatesim-persona-description">{persona.description}</p>
                        
                        {mode === 'ai-vs-ai' && (
                          <div className="debatesim-persona-buttons">
                            <button 
                              className={`debatesim-persona-select-btn ${proPersona === persona.id ? 'debatesim-selected' : ''}`}
                              onClick={() => {
                                setProPersona(persona.id);
                                setTimeout(() => updateArrowVisibility(), 100);
                              }}
                            >
                              {proPersona === persona.id ? '✓ Pro Side' : 'Select Pro'}
                            </button>
                            <button 
                              className={`debatesim-persona-select-btn ${conPersona === persona.id ? 'debatesim-selected' : ''}`}
                              onClick={() => {
                                setConPersona(persona.id);
                                setTimeout(() => updateArrowVisibility(), 100);
                              }}
                            >
                              {conPersona === persona.id ? '✓ Con Side' : 'Select Con'}
                            </button>
                          </div>
                        )}
                        
                        {mode === 'ai-vs-user' && (
                          <button 
                            className={`debatesim-persona-select-btn ${aiPersona === persona.id ? 'debatesim-selected' : ''}`}
                            onClick={() => {
                              setAiPersona(persona.id);
                              setTimeout(() => updateArrowVisibility(), 100);
                            }}
                          >
                            {aiPersona === persona.id ? '✓ Selected' : 'Select AI'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </div>

        {/* Topic Input Section */}
        <div ref={topicSectionRef} className={`debatesim-section ${isVisible ? 'debatesim-visible' : ''}`} style={{ animationDelay: '0.6s' }}>
          <h2 className="debatesim-section-title">Enter Debate Topic</h2>
          <div className="debatesim-input-section">
            <div className="debatesim-input-wrapper">
              <div className="debatesim-input-container">
                <input
                  ref={inputRef}
                  className="debatesim-topic-input"
                  type="text"
                  placeholder="Enter a compelling debate topic..."
                  value={debateTopic}
                  onChange={(e) => setDebateTopic(e.target.value)}
                />
              </div>
              {debateTopic && (
                <button 
                  className="debatesim-clear-button" 
                  onClick={() => setDebateTopic("")}
                  title="Clear input"
                >
                  ❌
                </button>
              )}
            </div>
            
            <button 
              className="debatesim-start-button" 
              onClick={handleStartDebate}
              disabled={!mode || !debateTopic.trim()}
            >
              <PlayCircle size={20} />
              Start Debate
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <HistorySidebar 
        user={user}
        history={history}
        showHistorySidebar={showHistorySidebar}
        setShowHistorySidebar={setShowHistorySidebar}
        componentPrefix="debatesim"
      />
      
      <Footer />
    </div>
  );
}

export default DebateSim;