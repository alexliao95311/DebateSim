import React, { useState, useEffect, useRef } from "react";
import { Github, ExternalLink, Code, Users, Zap, Target, Linkedin, Instagram } from "lucide-react";
import "./AboutUs.css";
import Footer from "./Footer.jsx";

function AboutUs() {
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const teamCardsRef = useRef(null);
  const sectionsRef = useRef([]);

  const updateArrowVisibility = () => {
    const container = teamCardsRef.current;
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

  const scrollTeam = (direction) => {
    const container = teamCardsRef.current;
    if (!container) return;
    
    const scrollAmount = 370;
    container.scrollBy({ 
      left: direction === 'left' ? -scrollAmount : scrollAmount, 
      behavior: 'smooth' 
    });
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

  useEffect(() => {
    const container = teamCardsRef.current;
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
    <div className="presentation-container">
      <nav className="presentation-navbar">
        <div className="presentation-navbar-left">
          <div className="presentation-logo-container">
            <img src="/images/logo.png" alt="Logo" className="presentation-logo" />
            <a href="/" className="presentation-brand" style={{ textDecoration: 'none', color: 'inherit' }}>
              DebateSim
            </a>
          </div>
        </div>
        <div className="presentation-navbar-right">
          <a href="/" className="presentation-nav-link">Home</a>
          <a href="https://github.com/alexliao95311/DebateSim" className="presentation-nav-link">
            <Github size={20} />
            GitHub
          </a>
        </div>
      </nav>

      <main className="presentation-main">
        {/* Technology Overview */}
        <section className="presentation-section presentation-fade-section" ref={el => (sectionsRef.current[0] = el)} id="technology">
          <div className="presentation-section-header">
            <h2 className="presentation-section-title">Technology Overview</h2>
            <p className="presentation-section-subtitle">
              Built with modern AI and web technologies
            </p>
          </div>

          <div className="presentation-overview-grid">
            <div className="presentation-overview-card">
              <Code className="presentation-card-icon" />
              <h3>AI Orchestration</h3>
              <p>
                LangChain-powered debate system with role-based positioning, 
                evidence integration from congressional bills, and persistent 
                memory across rounds.
              </p>
            </div>

            <div className="presentation-overview-card">
              <Target className="presentation-card-icon" />
              <h3>Intelligent Judging</h3>
              <p>
                Automated scoring with bias detection, detailed feedback analysis, 
                and comprehensive winner determination with structured reasoning.
              </p>
            </div>

            <div className="presentation-overview-card">
              <Zap className="presentation-card-icon" />
              <h3>High Performance Backend</h3>
              <p>
                FastAPI with intelligent multi-level caching, sub-500ms response times, 
                and Firebase integration for scalable user management.
              </p>
            </div>
          </div>
        </section>

        {/* Impact & Testimonials Section */}
        <section
          className="presentation-section presentation-fade-section"
          ref={el => (sectionsRef.current[1] = el)}
          id="impact"
        >
          <div className="presentation-section-header">
            <h2 className="presentation-section-title">Impact & Testimonials</h2>
            <p className="presentation-section-subtitle">
              Real students, real improvement in critical thinking and civic engagement
            </p>
          </div>

          <div className="presentation-impact-grid">
            {/* Top Row - Impact Cards */}
            <div className="presentation-impact-card">
              <Users className="presentation-impact-icon" />
              <h3>Student Engagement</h3>
              <div className="presentation-feature-bullets">
                <ul>
                  <li>Students develop stronger counter-argument skills through AI-powered debates</li>
                  <li>Enhanced civic engagement by discussing real congressional bills</li>
                  <li>Improved critical thinking through structured debate formats</li>
                  <li>Real-time feedback and grading to track progress over time</li>
                </ul>
              </div>
            </div>

            <div className="presentation-impact-card">
              <Target className="presentation-impact-icon" />
              <h3>Debate Success</h3>
              <div className="presentation-feature-bullets">
                <ul>
                  <li>Enhanced logical reasoning through structured argument frameworks</li>
                  <li>Improved evidence evaluation and source citation skills</li>
                  <li>Better understanding of opposing viewpoints and counterarguments</li>
                  <li>Increased confidence in public speaking and formal debates</li>
                </ul>
              </div>
            </div>

            {/* Bottom Row - Testimonials */}
            <div className="presentation-testimonial-card">
              <h3>Student Testimonial</h3>
              <blockquote className="presentation-testimonial-quote">
                <p>
                  "Before trying DebateSim, I wasn't into politics. Now, I see why civic engagement 
                  is important and understand what our government is doing."
                </p>
                <cite>— Gautham, Student User</cite>
              </blockquote>
            </div>

            <div className="presentation-testimonial-card">
              <h3>Debater Testimonial</h3>
              <blockquote className="presentation-testimonial-quote">
                <p>
                  "DebateSim helped me understand multiple perspectives on issues I thought I already knew. 
                  The AI feedback made me realize gaps in my logic and taught me to argue more effectively."
                </p>
                <cite>— Neel, Public Forum Debater</cite>
              </blockquote>
            </div>
          </div>
        </section>

        {/* About the Team Section */}
        <section className="presentation-section presentation-fade-section" ref={el => (sectionsRef.current[2] = el)} id="team">
          <div className="presentation-section-header">
            <h2 className="presentation-section-title">About the Team</h2>
            <p className="presentation-section-subtitle">
              Meet the people behind DebateSim
            </p>
          </div>

          <div className="presentation-team-container">
            <button 
              className={`presentation-scroll-arrow presentation-scroll-arrow-left ${showLeftArrow ? 'visible' : ''}`}
              onClick={() => scrollTeam('left')}
            >
              ←
            </button>
            <button 
              className={`presentation-scroll-arrow presentation-scroll-arrow-right ${showRightArrow ? 'visible' : ''}`}
              onClick={() => scrollTeam('right')}
            >
              →
            </button>
            <div className="presentation-team-cards" ref={teamCardsRef}>
            <div className="presentation-team-member">
              <div className="presentation-member-photo">
                <img src="/images/alex.png" alt="Alex Liao" className="presentation-member-image" />
              </div>
              <div className="presentation-member-info">
                <h3>Alex Liao</h3>
                <p className="presentation-member-role">Founder and CTO</p>
                <p className="presentation-member-bio">
                Alex is a backend developer from Emerald High (Dublin, CA). As the founder and CTO of DebateSim, he architected the full-stack platform from the ground up, integrating advanced AI and intuitive UX. He is a competitive public forum debater and has qualified to California State Debate Championships. In his free time, he plays the piano and swims competitively.
                </p>
                <div className="presentation-member-links">
                  <a href="https://www.linkedin.com/in/alex-liao-184832356/" className="presentation-social-link" title="LinkedIn">
                    <Linkedin size={20} />
                  </a>
                  <a href="https://www.instagram.com/alezl5311/" className="presentation-social-link" title="Instagram">
                    <Instagram size={20} />
                  </a>
                </div>
              </div>
            </div>
            <div className="presentation-team-member">
              <div className="presentation-member-photo">
                <div className="presentation-photo-placeholder">
                  <Users size={48} />
                </div>
              </div>
              <div className="presentation-member-info">
                <h3>Mrinal Agarwal</h3>
                <p className="presentation-member-role">Co-Founder</p>
                <p className="presentation-member-bio">
                Mrinal is a junior at Emerald High School and a lead developer on DebateSim. He has created and built backend features including LangChain pipelines, DebateTrainer with prompt engineering and fine-tuning, and the congressional bill analyzer API. Apart from this he is a Machine Learning enthusiast and has created benchmark for deception detection in LLMs, developed safeguards against prompt-based injections. Outside of DebateSim, he is a nationally ranked debater: 2nd in California, top 25 at the Gold TOC, NSDA Nationals Top 40, and currently ranked top 50 in the country. He also enjoys competitive math and badminton.
                </p>
                <div className="presentation-member-links">
                  <a href="#" className="https://www.linkedin.com/in/mrinal-agarwal-71017535a/" title="LinkedIn">
                    <Linkedin size={20} />
                  </a>
                  <a href="#" className="https://www.instagram.com/mrinal_a09/" title="Instagram">
                    <Instagram size={20} />
                  </a>
                </div>
              </div>
            </div>
            <div className="presentation-team-member">
              <div className="presentation-member-photo">
                <div className="presentation-photo-placeholder">
                  <Users size={48} />
                </div>
              </div>
              <div className="presentation-member-info">
                <h3>Arnav Kakani</h3>
                <p className="presentation-member-role">Co-Founder</p>
                <p className="presentation-member-bio">
                Arnav Kakani is a junior at Emerald High School (Dublin, CA) and the co-founder of DebateSim, where he is involved in full-stack development and AI engineering. He has integrated real-time Congressional data, and advanced debate simulations, while creating the mobile UI to ensure a clean, consistent user experience. He is a competitive golfer and pianist with a strong interest in quantum computing, programming, and ethical hacking.
                </p>
                <div className="presentation-member-links">
                  <a href="https://www.linkedin.com/in/arnav-kakani-365117236/" className="presentation-social-link" title="LinkedIn">
                    <Linkedin size={20} />
                  </a>
                  <a href="https://www.instagram.com/arnavkakani/" className="presentation-social-link" title="Instagram">
                    <Instagram size={20} />
                  </a>
                </div>
              </div>
            </div>
            </div>
          </div>
        </section>


        {/* Call to Action Section */}
        <section
          className="presentation-section presentation-cta-section presentation-fade-section"
          ref={el => (sectionsRef.current[3] = el)}
          id="call-to-action"
        >
          <div className="presentation-cta-content">
            <h2 className="presentation-cta-title">Join the Future of Debate</h2>

            <div className="presentation-cta-actions">
              <a 
                href="https://debatesim.us" 
                className="presentation-cta-btn primary"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink size={20} />
                Try DebateSim Now
              </a>
              <a 
                href="https://github.com/alexliao95311/DebateSim" 
                className="presentation-cta-btn secondary"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github size={20} />
                Star on GitHub
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

export default AboutUs;