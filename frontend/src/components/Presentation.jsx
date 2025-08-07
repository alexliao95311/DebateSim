import React from "react";
import { Github, ExternalLink, Code, Users, Zap, Target, Linkedin, Instagram } from "lucide-react";
import "./Presentation.css";
import Footer from "./Footer.jsx";

function Presentation() {
  return (
    <div className="presentation-container">
      <nav className="presentation-navbar">
        <div className="presentation-navbar-left">
          <div className="presentation-logo-container">
            <img src="/images/logo.png" alt="Logo" className="presentation-logo" />
            <span className="presentation-brand">DebateSim</span>
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
        {/* Overview Section */}
        <section className="presentation-section" id="overview">
          <div className="presentation-section-header">
            <h2 className="presentation-section-title">DebateSim Overview</h2>
            <p className="presentation-section-subtitle">
              AI-powered debate simulation platform for enhanced critical thinking
            </p>
          </div>

          <div className="presentation-overview-grid">
            <div className="presentation-overview-card">
              <Code className="presentation-card-icon" />
              <h3>Advanced AI Orchestration</h3>
              <p>
                LangChain-powered debaters with role-based positioning, evidence integration 
                from congressional bills, and persistent memory across debate rounds.
              </p>
            </div>

            <div className="presentation-overview-card">
              <Target className="presentation-card-icon" />
              <h3>Intelligent Judging</h3>
              <p>
                Automated scoring with bias detection, detailed feedback analysis, 
                and comprehensive winner determination with reasoning.
              </p>
            </div>

            <div className="presentation-overview-card">
              <Zap className="presentation-card-icon" />
              <h3>High Performance</h3>
              <p>
                FastAPI backend with intelligent caching, sub-500ms response times, 
                and Firebase integration for user management and data persistence.
              </p>
            </div>
          </div>
        </section>

        {/* Key Features Section */}
        <section className="presentation-section" id="features">
          <div className="presentation-section-header">
            <h2 className="presentation-section-title">Key Features</h2>
            <p className="presentation-section-subtitle">
              Everything you need for effective debate simulation
            </p>
          </div>

          <div className="presentation-feature-list">
            <div className="presentation-feature-item">
              <div className="presentation-feature-icon">🎯</div>
              <div>
                <h4>AI vs User Debates</h4>
                <p>Challenge yourself against intelligent AI opponents with real-time feedback</p>
              </div>
            </div>
            <div className="presentation-feature-item">
              <div className="presentation-feature-icon">⚖️</div>
              <div>
                <h4>Bill Analysis</h4>
                <p>Upload and debate congressional bills with evidence-based arguments</p>
              </div>
            </div>
            <div className="presentation-feature-item">
              <div className="presentation-feature-icon">🧠</div>
              <div>
                <h4>Multi-Model Support</h4>
                <p>Choose from GPT-4o, Claude 3.5, Gemini 2.0, and LLaMA 3.3 models</p>
              </div>
            </div>
            <div className="presentation-feature-item">
              <div className="presentation-feature-icon">📊</div>
              <div>
                <h4>Comprehensive Grading</h4>
                <p>Detailed analysis across multiple criteria with visual progress tracking</p>
              </div>
            </div>
            <div className="presentation-feature-item">
              <div className="presentation-feature-icon">🔄</div>
              <div>
                <h4>Real-time Processing</h4>
                <p>Live transcript updates with intelligent caching for optimal performance</p>
              </div>
            </div>
            <div className="presentation-feature-item">
              <div className="presentation-feature-icon">🎪</div>
              <div>
                <h4>AI vs AI Arena</h4>
                <p>Watch different AI models debate each other on complex topics</p>
              </div>
            </div>
          </div>
        </section>

        {/* Technology Stack Section */}
        <section className="presentation-section" id="tech-stack">
          <div className="presentation-section-header">
            <h2 className="presentation-section-title">Technology Stack</h2>
            <p className="presentation-section-subtitle">
              Built with modern, scalable technologies
            </p>
          </div>

          <div className="presentation-tech-grid">
            <div className="presentation-tech-category">
              <h3>Frontend</h3>
              <ul>
                <li>React 18 with Vite</li>
                <li>Firebase Authentication</li>
                <li>Real-time UI updates</li>
                <li>Responsive design</li>
              </ul>
            </div>
            <div className="presentation-tech-category">
              <h3>Backend</h3>
              <ul>
                <li>FastAPI (Python)</li>
                <li>LangChain orchestration</li>
                <li>Multi-level caching</li>
                <li>Async processing</li>
              </ul>
            </div>
            <div className="presentation-tech-category">
              <h3>AI & Data</h3>
              <ul>
                <li>OpenRouter API gateway</li>
                <li>Congress.gov integration</li>
                <li>PDF processing pipeline</li>
                <li>Firebase Firestore</li>
              </ul>
            </div>
          </div>
        </section>

        {/* About the Team Section */}
        <section className="presentation-section" id="team">
          <div className="presentation-section-header">
            <h2 className="presentation-section-title">About the Team</h2>
            <p className="presentation-section-subtitle">
              Meet the people behind DebateSim
            </p>
          </div>

          <div className="presentation-team-grid">
            <div className="presentation-team-member">
              <div className="presentation-member-photo">
                <div className="presentation-photo-placeholder">
                  <Users size={48} />
                </div>
              </div>
              <div className="presentation-member-info">
                <h3>Team Member</h3>
                <p className="presentation-member-role">Role Title</p>
                <p className="presentation-member-bio">
                  Brief bio and background information will go here. Describe their 
                  role in the project and relevant experience.
                </p>
                <div className="presentation-member-links">
                  <a href="#" className="presentation-social-link" title="LinkedIn">
                    <Linkedin size={20} />
                  </a>
                  <a href="#" className="presentation-social-link" title="Instagram">
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
                <h3>Team Member</h3>
                <p className="presentation-member-role">Role Title</p>
                <p className="presentation-member-bio">
                  Brief bio and background information will go here. Describe their 
                  role in the project and relevant experience.
                </p>
                <div className="presentation-member-links">
                  <a href="#" className="presentation-social-link" title="LinkedIn">
                    <Linkedin size={20} />
                  </a>
                  <a href="#" className="presentation-social-link" title="Instagram">
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
                <h3>Team Member</h3>
                <p className="presentation-member-role">Role Title</p>
                <p className="presentation-member-bio">
                  Brief bio and background information will go here. Describe their 
                  role in the project and relevant experience.
                </p>
                <div className="presentation-member-links">
                  <a href="#" className="presentation-social-link" title="LinkedIn">
                    <Linkedin size={20} />
                  </a>
                  <a href="#" className="presentation-social-link" title="Instagram">
                    <Instagram size={20} />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Impact Section */}
        <section className="presentation-section" id="impact">
          <div className="presentation-section-header">
            <h2 className="presentation-section-title">Impact & Results</h2>
            <p className="presentation-section-subtitle">
              Real improvement in critical thinking and civic engagement
            </p>
          </div>

          <div className="presentation-impact-stats">
            <div className="presentation-stat-item">
              <div className="presentation-stat-number">1000+</div>
              <div className="presentation-stat-label">Debates Simulated</div>
            </div>
            <div className="presentation-stat-item">
              <div className="presentation-stat-number">500ms</div>
              <div className="presentation-stat-label">Average Response Time</div>
            </div>
            <div className="presentation-stat-item">
              <div className="presentation-stat-number">4</div>
              <div className="presentation-stat-label">AI Models Supported</div>
            </div>
          </div>

          <div className="presentation-testimonials">
            <div className="presentation-testimonial">
              <blockquote>
                "DebateSim helped me understand multiple perspectives on issues I thought I already knew. 
                The AI feedback made me realize gaps in my logic and taught me to argue more effectively."
              </blockquote>
              <cite>— Neel, Public Forum Debater</cite>
            </div>
            <div className="presentation-testimonial">
              <blockquote>
                "Before trying DebateSim, I wasn't into politics. Now, I see why civic engagement 
                is important and understand what our government is doing."
              </blockquote>
              <cite>— Sanjana, Student User</cite>
            </div>
          </div>
        </section>

        {/* Call to Action Section */}
        <section className="presentation-section presentation-cta-section" id="call-to-action">
          <div className="presentation-cta-content">
            <h2 className="presentation-cta-title">Try DebateSim Today</h2>
            <p className="presentation-cta-subtitle">
              Start improving your debate skills with AI-powered opponents
            </p>

            <div className="presentation-cta-actions">
              <a 
                href="/" 
                className="presentation-cta-btn primary"
              >
                <ExternalLink size={20} />
                Start Debating
              </a>
              <a 
                href="https://github.com/alexliao95311/DebateSim" 
                className="presentation-cta-btn secondary"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github size={20} />
                View Source Code
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

export default Presentation;