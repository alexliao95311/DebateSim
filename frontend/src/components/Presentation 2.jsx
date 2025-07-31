import React, { useEffect, useRef } from "react";
import { Play, Github, ExternalLink, Code, Users, Zap, Target } from "lucide-react";
import mermaid from "mermaid";
import "./Presentation.css";
import Footer from "./Footer.jsx";

function Presentation() {
  const sectionsRef = useRef([]);

  useEffect(() => {
    // Initialize Mermaid
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      themeVariables: {
        primaryColor: '#60a5fa',
        primaryTextColor: '#ffffff',
        primaryBorderColor: '#3b82f6',
        lineColor: '#60a5fa',
        sectionBkgColor: 'rgba(30, 41, 59, 0.1)',
        altSectionBkgColor: 'rgba(37, 99, 235, 0.1)',
        gridColor: '#64748b',
        tertiaryColor: 'rgba(96, 165, 250, 0.1)',
        background: 'transparent',
        secondaryColor: 'rgba(16, 185, 129, 0.1)',
        tertiaryTextColor: '#ffffff'
      }
    });

    // Render all mermaid diagrams
    const renderDiagrams = async () => {
      const diagrams = document.querySelectorAll('.mermaid');
      for (let i = 0; i < diagrams.length; i++) {
        const element = diagrams[i];
        const graphDefinition = element.textContent;
        const { svg } = await mermaid.render(`diagram-${i}`, graphDefinition);
        element.innerHTML = svg;
      }
    };

    // Delay rendering to ensure DOM is ready
    setTimeout(renderDiagrams, 1000);

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
        {/* Architecture Deep Dive Section */}
        <section
          className="presentation-section presentation-fade-section"
          ref={el => (sectionsRef.current[0] = el)}
          id="architecture"
        >
          <div className="presentation-section-header">
            <h2 className="presentation-section-title">Architecture Deep Dive</h2>
            <p className="presentation-section-subtitle">
              Sophisticated AI orchestration with LangChain, FastAPI, and intelligent caching
            </p>
          </div>

          {/* Debater Chain */}
          <div className="presentation-architecture-card">
            <div className="presentation-card-header">
              <Code className="presentation-card-icon" />
              <h3>Debater Chain Architecture</h3>
            </div>
            <div className="presentation-feature-bullets">
              <ul>
                <li>LangChain orchestrates role-based debaters with specific pro/con positions</li>
                <li>Evidence pulled directly from congressional bill text for accuracy</li>
                <li>Memory persisted across debate rounds for contextual continuity</li>
                <li>Structured markdown output with proper citations</li>
              </ul>
            </div>
            <div className="presentation-code-block">
              <div className="presentation-code-header">
                <span>debater_chain.py</span>
                <button className="presentation-copy-btn">Copy</button>
              </div>
              <pre><code dangerouslySetInnerHTML={{
                __html: `<span class="python-comment"># LangChain orchestrates role-based debaters with evidence & memory</span>
<span class="python-keyword">class</span> <span class="python-class">ChainWrapper</span><span class="python-bracket">:</span>
    <span class="python-keyword">def</span> <span class="python-function">run</span><span class="python-bracket">(</span><span class="python-parameter">self</span><span class="python-bracket">,</span> <span class="python-operator">**</span><span class="python-parameter">kwargs</span><span class="python-bracket">):</span>
        <span class="python-comment"># Memory persistence across debate rounds</span>
        <span class="python-keyword">if</span> <span class="python-variable">chain_id</span> <span class="python-keyword">not in</span> <span class="python-variable">memory_map</span><span class="python-bracket">:</span>
            <span class="python-variable">memory_map</span><span class="python-bracket">[</span><span class="python-variable">chain_id</span><span class="python-bracket">]</span> <span class="python-operator">=</span> <span class="python-bracket">[]</span>
        
        <span class="python-comment"># Evidence integration from bill text</span>
        <span class="python-variable">chain</span> <span class="python-operator">=</span> <span class="python-bracket">(</span>
            <span class="python-bracket">{</span>
                <span class="python-string">"debater_role"</span><span class="python-bracket">:</span> <span class="python-keyword">lambda</span> <span class="python-parameter">inputs</span><span class="python-bracket">:</span> <span class="python-parameter">inputs</span><span class="python-bracket">[</span><span class="python-string">"debater_role"</span><span class="python-bracket">],</span>
                <span class="python-string">"topic"</span><span class="python-bracket">:</span> <span class="python-keyword">lambda</span> <span class="python-parameter">inputs</span><span class="python-bracket">:</span> <span class="python-parameter">inputs</span><span class="python-bracket">[</span><span class="python-string">"topic"</span><span class="python-bracket">],</span> 
                <span class="python-string">"bill_description"</span><span class="python-bracket">:</span> <span class="python-keyword">lambda</span> <span class="python-parameter">inputs</span><span class="python-bracket">:</span> <span class="python-parameter">inputs</span><span class="python-bracket">.</span><span class="python-function">get</span><span class="python-bracket">(</span><span class="python-string">"bill_description"</span><span class="python-bracket">,</span> <span class="python-string">""</span><span class="python-bracket">),</span>
                <span class="python-string">"memory"</span><span class="python-bracket">:</span> <span class="python-variable">memory_function</span><span class="python-bracket">,</span>
                <span class="python-string">"history"</span><span class="python-bracket">:</span> <span class="python-keyword">lambda</span> <span class="python-parameter">inputs</span><span class="python-bracket">:</span> <span class="python-parameter">inputs</span><span class="python-bracket">.</span><span class="python-function">get</span><span class="python-bracket">(</span><span class="python-string">"history"</span><span class="python-bracket">,</span> <span class="python-string">""</span><span class="python-bracket">)</span>
            <span class="python-bracket">}</span>
            <span class="python-operator">|</span> <span class="python-variable">chat_prompt</span>
            <span class="python-operator">|</span> <span class="python-variable">llm</span>
            <span class="python-operator">|</span> <span class="python-class">StrOutputParser</span><span class="python-bracket">()</span>
        <span class="python-bracket">)</span>
        
        <span class="python-variable">response</span> <span class="python-operator">=</span> <span class="python-variable">chain</span><span class="python-bracket">.</span><span class="python-function">invoke</span><span class="python-bracket">(</span><span class="python-parameter">inputs</span><span class="python-bracket">)</span>
        
        <span class="python-comment"># Persist to memory for next round</span>
        <span class="python-variable">memory_map</span><span class="python-bracket">[</span><span class="python-variable">chain_id</span><span class="python-bracket">].</span><span class="python-function">append</span><span class="python-bracket">({</span>
            <span class="python-string">"role"</span><span class="python-bracket">:</span> <span class="python-string">"assistant"</span><span class="python-bracket">,</span> 
            <span class="python-string">"content"</span><span class="python-bracket">:</span> <span class="python-variable">response</span>
        <span class="python-bracket">})</span>
        <span class="python-keyword">return</span> <span class="python-variable">response</span>`
              }} /></pre>
            </div>
            <div className="presentation-mermaid-placeholder">
              <h4>Debater Chain Architecture Flow</h4>
              <div className="mermaid">{`graph TD
    A[User Input<br/>Debater Role + Topic + Bill] --> B{Memory Check}
    B --> C[Load Existing Memory]
    B --> D[Initialize New Memory]
    C --> E[Evidence Integration<br/>Bill Text Processing]
    D --> E
    E --> F[LangChain Runnable Chain]
    F --> G[Role-based Prompt Template<br/>Pro/Con Position]
    G --> H[OpenRouter API<br/>Multi-Model Selection]
    H --> I[AI Response Generation<br/>Structured Markdown]
    I --> J[Memory Persistence<br/>Round-to-Round Context]
    J --> K[Response Output]
    
    subgraph "Memory Management"
        L[memory_map Dictionary]
        M[Chain ID Tracking]
        N[Context History]
    end
    
    subgraph "Evidence Processing"
        O[Bill Text Extraction]
        P[Citation Requirements]
        Q[Context Truncation]
    end
    
    B -.-> L
    E -.-> O
    I -.-> J
    
    style A fill:#60a5fa,color:#ffffff
    style K fill:#10b981,color:#ffffff
    style H fill:#a855f7,color:#ffffff`}
              </div>
            </div>
          </div>

          {/* Judge Chain */}
          <div className="presentation-architecture-card">
            <div className="presentation-card-header">
              <Target className="presentation-card-icon" />
              <h3>Judge Chain System</h3>
            </div>
            <div className="presentation-feature-bullets">
              <ul>
                <li>Automated scoring of logical consistency and argument strength</li>
                <li>Bias detection algorithms to ensure balanced evaluation</li>
                <li>Detailed feedback with strengths and weaknesses analysis</li>
                <li>Winner determination with comprehensive reasoning</li>
              </ul>
            </div>
            <div className="presentation-code-block">
              <div className="presentation-code-header">
                <span>judge_chain.py</span>
                <button className="presentation-copy-btn">Copy</button>
              </div>
              <pre><code dangerouslySetInnerHTML={{
                __html: `<span class="python-comment"># Judge chain scores logic, detects bias, produces detailed feedback</span>
<span class="python-variable">template</span> <span class="python-operator">=</span> <span class="python-string">"""You are an expert debate judge. Analyze the following debate transcript.

DEBATE TRANSCRIPT:
{transcript}

Please provide judgment with the following sections:
1. Summary of Main Arguments from both sides
2. Strengths and Weaknesses Analysis for each debater  
3. Decision on who won the debate with reasoning

Format your response with clear headings using markdown (###)."""</span>

<span class="python-keyword">def</span> <span class="python-function">get_judge_chain</span><span class="python-bracket">(</span><span class="python-parameter">model_name</span><span class="python-operator">=</span><span class="python-string">"openai/gpt-4o"</span><span class="python-bracket">):</span>
    <span class="python-variable">llm</span> <span class="python-operator">=</span> <span class="python-class">OpenRouterChat</span><span class="python-bracket">(</span><span class="python-parameter">model_name</span><span class="python-operator">=</span><span class="python-parameter">model_name</span><span class="python-bracket">,</span> <span class="python-parameter">temperature</span><span class="python-operator">=</span><span class="python-number">0.5</span><span class="python-bracket">)</span>
    
    <span class="python-variable">chain</span> <span class="python-operator">=</span> <span class="python-bracket">(</span>
        <span class="python-bracket">{</span><span class="python-string">"transcript"</span><span class="python-bracket">:</span> <span class="python-class">RunnablePassthrough</span><span class="python-bracket">()}</span>
        <span class="python-operator">|</span> <span class="python-class">ChatPromptTemplate</span><span class="python-bracket">.</span><span class="python-function">from_template</span><span class="python-bracket">(</span><span class="python-parameter">template</span><span class="python-bracket">)</span>
        <span class="python-operator">|</span> <span class="python-variable">llm</span> 
        <span class="python-operator">|</span> <span class="python-class">StrOutputParser</span><span class="python-bracket">()</span>
    <span class="python-bracket">)</span>
    
    <span class="python-keyword">return</span> <span class="python-class">ChainWrapper</span><span class="python-bracket">(</span><span class="python-parameter">chain</span><span class="python-bracket">)</span>`
              }} /></pre>
            </div>
            <div className="presentation-mermaid-placeholder">
              <h4>AI Judge Evaluation System</h4>
              <div className="mermaid">{`graph TD
    A[Complete Debate Transcript] --> B[Judge Chain Initialization]
    B --> C[Structured Prompt Template<br/>Analysis Instructions]
    C --> D[AI Judge Model<br/>OpenRouter API]
    
    D --> E[Argument Analysis]
    D --> F[Evidence Evaluation]
    D --> G[Logic Assessment]
    D --> H[Bias Detection]
    
    E --> I[Strength Scoring<br/>Per Debater]
    F --> J[Source Verification<br/>Citation Quality]
    G --> K[Logical Consistency<br/>Fallacy Detection]
    H --> L[Neutrality Check<br/>Political Balance]
    
    I --> M[Comprehensive Feedback<br/>Markdown Formatted]
    J --> M
    K --> M
    L --> M
    
    M --> N[Winner Determination<br/>Reasoning Provided]
    N --> O[Final Judgment Output]
    
    subgraph "Evaluation Criteria"
        P[1. Summary of Arguments]
        Q[2. Strengths & Weaknesses]
        R[3. Decision with Reasoning]
    end
    
    M -.-> P
    M -.-> Q
    N -.-> R
    
    style A fill:#60a5fa,color:#ffffff
    style D fill:#a855f7,color:#ffffff
    style O fill:#10b981,color:#ffffff`}
              </div>
            </div>
          </div>

          {/* FastAPI + Firebase */}
          <div className="presentation-architecture-card">
            <div className="presentation-card-header">
              <Zap className="presentation-card-icon" />
              <h3>FastAPI + Firebase Infrastructure</h3>
            </div>
            <div className="presentation-feature-bullets">
              <ul>
                <li>FastAPI handles asynchronous request processing for scalability</li>
                <li>Firebase Firestore stores user profiles and debate transcripts</li>
                <li>Multi-level intelligent caching system (response + bills + search)</li>
                <li>Optimized response times under 500 milliseconds with cache hits</li>
                <li>Connection pooling with aiohttp.TCPConnector for efficiency</li>
              </ul>
            </div>
            <div className="presentation-code-block">
              <div className="presentation-code-header">
                <span>main.py</span>
                <button className="presentation-copy-btn">Copy</button>
              </div>
              <pre><code dangerouslySetInnerHTML={{
                __html: `<span class="python-comment"># FastAPI handles async requests with intelligent caching</span>
<span class="python-comment"># Cached responses clock in under 500 milliseconds</span>

<span class="python-comment"># Connection pooling with optimizations</span>
<span class="python-variable">connector</span> <span class="python-operator">=</span> <span class="python-variable">aiohttp</span><span class="python-bracket">.</span><span class="python-class">TCPConnector</span><span class="python-bracket">(</span>
    <span class="python-parameter">limit</span><span class="python-operator">=</span><span class="python-number">30</span><span class="python-bracket">,</span> <span class="python-parameter">limit_per_host</span><span class="python-operator">=</span><span class="python-number">20</span><span class="python-bracket">,</span> <span class="python-parameter">ttl_dns_cache</span><span class="python-operator">=</span><span class="python-number">300</span><span class="python-bracket">,</span>
    <span class="python-parameter">use_dns_cache</span><span class="python-operator">=</span><span class="python-keyword">True</span><span class="python-bracket">,</span> <span class="python-parameter">keepalive_timeout</span><span class="python-operator">=</span><span class="python-number">60</span>
<span class="python-bracket">)</span>

<span class="python-comment"># Multi-level intelligent caching</span>
<span class="python-variable">cache</span> <span class="python-operator">=</span> <span class="python-class">TTLCache</span><span class="python-bracket">(</span><span class="python-parameter">maxsize</span><span class="python-operator">=</span><span class="python-number">200</span><span class="python-bracket">,</span> <span class="python-parameter">ttl</span><span class="python-operator">=</span><span class="python-number">600</span><span class="python-bracket">)</span>  <span class="python-comment"># 10 minutes</span>
<span class="python-variable">bills_cache</span> <span class="python-operator">=</span> <span class="python-class">TTLCache</span><span class="python-bracket">(</span><span class="python-parameter">maxsize</span><span class="python-operator">=</span><span class="python-number">50</span><span class="python-bracket">,</span> <span class="python-parameter">ttl</span><span class="python-operator">=</span><span class="python-number">3600</span><span class="python-bracket">)</span>  <span class="python-comment"># 1 hour</span>

<span class="python-decorator">@app.post</span><span class="python-bracket">(</span><span class="python-string">"/generate-response"</span><span class="python-bracket">)</span>
<span class="python-keyword">async def</span> <span class="python-function">generate_response</span><span class="python-bracket">(</span><span class="python-parameter">request</span><span class="python-bracket">:</span> <span class="python-class">GenerateResponseRequest</span><span class="python-bracket">):</span>
    <span class="python-comment"># Check cache first</span>
    <span class="python-variable">cache_key</span> <span class="python-operator">=</span> <span class="python-builtin">f</span><span class="python-string">"debate_{request.debater}_{hash(request.prompt)}"</span>
    <span class="python-keyword">if</span> <span class="python-variable">cache_key</span> <span class="python-keyword">in</span> <span class="python-variable">cache</span><span class="python-bracket">:</span>
        <span class="python-keyword">return</span> <span class="python-variable">cache</span><span class="python-bracket">[</span><span class="python-variable">cache_key</span><span class="python-bracket">]</span>  <span class="python-comment"># Sub-500ms response!</span>
    
    <span class="python-comment"># Async processing with LangChain</span>
    <span class="python-variable">debater_chain</span> <span class="python-operator">=</span> <span class="python-function">get_debater_chain</span><span class="python-bracket">(</span><span class="python-parameter">request</span><span class="python-bracket">.</span><span class="python-variable">model</span><span class="python-bracket">)</span>
    <span class="python-variable">response</span> <span class="python-operator">=</span> <span class="python-variable">debater_chain</span><span class="python-bracket">.</span><span class="python-function">run</span><span class="python-bracket">(</span>
        <span class="python-parameter">debater_role</span><span class="python-operator">=</span><span class="python-parameter">request</span><span class="python-bracket">.</span><span class="python-variable">debater</span><span class="python-bracket">,</span>
        <span class="python-parameter">topic</span><span class="python-operator">=</span><span class="python-parameter">request</span><span class="python-bracket">.</span><span class="python-variable">prompt</span><span class="python-bracket">,</span>
        <span class="python-parameter">bill_description</span><span class="python-operator">=</span><span class="python-parameter">request</span><span class="python-bracket">.</span><span class="python-variable">bill_description</span>
    <span class="python-bracket">)</span>
    
    <span class="python-comment"># Cache for future requests</span>
    <span class="python-variable">cache</span><span class="python-bracket">[</span><span class="python-variable">cache_key</span><span class="python-bracket">]</span> <span class="python-operator">=</span> <span class="python-bracket">{</span><span class="python-string">"response"</span><span class="python-bracket">:</span> <span class="python-variable">response</span><span class="python-bracket">}</span>
    <span class="python-keyword">return</span> <span class="python-bracket">{</span><span class="python-string">"response"</span><span class="python-bracket">:</span> <span class="python-variable">response</span><span class="python-bracket">}</span>`
              }} /></pre>
            </div>
            <div className="presentation-mermaid-placeholder">
              <h4>Complete System Architecture</h4>
              <div className="mermaid">{`graph TB
    subgraph "Frontend Layer"
        A[React 18 Frontend<br/>Vite Build System]
        B[Firebase Auth<br/>User Management]
        C[Real-time UI Updates<br/>Loading States]
    end
    
    subgraph "Backend Infrastructure"
        D[FastAPI Server<br/>Async Processing]
        E[Connection Pool<br/>aiohttp.TCPConnector]
        F[Multi-level Caching<br/>TTLCache Strategy]
    end
    
    subgraph "Caching System"
        G[AI Response Cache<br/>10min TTL]
        H[Congress Bills Cache<br/>1hr TTL]
        I[Search Results Cache<br/>30min TTL]
    end
    
    subgraph "AI Processing"
        J[OpenRouter API Gateway]
        K[GPT-4o<br/>Primary Model]
        L[Claude 3.5<br/>Analysis Model]
        M[Gemini 2.0<br/>Speed Model]
        N[LLaMA 3.3<br/>Fallback Model]
    end
    
    subgraph "Data Sources"
        O[Congress.gov API<br/>Live Legislative Data]
        P[PDF Processing<br/>PDFMiner Engine]
        Q[Firebase Firestore<br/>User Data & Transcripts]
    end
    
    A <--> D
    B <--> Q
    D <--> E
    D <--> F
    F <--> G
    F <--> H
    F <--> I
    
    D <--> J
    J <--> K
    J <--> L  
    J <--> M
    J <--> N
    
    D <--> O
    D <--> P
    D <--> Q
    
    style D fill:#60a5fa,color:#ffffff
    style F fill:#10b981,color:#ffffff
    style J fill:#a855f7,color:#ffffff
    style A fill:#ef4444,color:#ffffff`}
              </div>
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
            <div className="presentation-impact-card">
              <Users className="presentation-impact-icon" />
              <h3>Student Engagement</h3>
              <p className="presentation-speaker-quote">
                <span className="presentation-speaker">Arnav:</span>
                "With DebateSim, students gain stronger counter-argument skills and deeper civic engagement."
              </p>
              <div className="presentation-transcript-showcase">
                <h4>Sample Saved Transcripts</h4>
                <div className="presentation-transcript-grid">
                  <div className="presentation-transcript-card">
                    <h5>AI vs User: Climate Policy</h5>
                    <p>8 rounds • Evidence-based • Grade: A-</p>
                  </div>
                  <div className="presentation-transcript-card">
                    <h5>User vs User: Healthcare Reform</h5>
                    <p>12 rounds • Congressional Bill HR-1234 • Grade: B+</p>
                  </div>
                  <div className="presentation-transcript-card">
                    <h5>AI vs AI: Education Funding</h5>
                    <p>6 rounds • Topic Debate • Grade: A</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="presentation-testimonial-card">
              <h3>Student Testimonial</h3>
              <div className="presentation-video-placeholder">
                <div className="presentation-video-container">
                  <Play className="presentation-play-icon" />
                  <div className="presentation-video-overlay">
                    <h4>Sanjana's Testimonial</h4>
                    <p>📹 [Video Placeholder]</p>
                  </div>
                </div>
              </div>
              <blockquote className="presentation-testimonial-quote">
                <p>
                  "Before trying DebateSim, I wasn't into politics. Now, I see why civic engagement 
                  is important and understand what our government is doing."
                </p>
                <cite>— Sanjana, Student User</cite>
              </blockquote>
            </div>
          </div>
        </section>

        {/* Roadmap Section */}
        <section
          className="presentation-section presentation-fade-section"
          ref={el => (sectionsRef.current[2] = el)}
          id="roadmap"
        >
          <div className="presentation-section-header">
            <h2 className="presentation-section-title">Future Roadmap</h2>
            <p className="presentation-section-subtitle">
              Expanding beyond text debates into voice, mobile, and competitive AI benchmarking
            </p>
          </div>

          <div className="presentation-roadmap-grid">
            <div className="presentation-roadmap-card">
              <h3>Next-Generation Features</h3>
              <p className="presentation-speaker-quote">
                <span className="presentation-speaker">Alex:</span>
                "We have many great things planned for DebateSim. Next-up: voice debates, celebrity personas, and a mobile app."
              </p>
              <div className="presentation-feature-list">
                <div className="presentation-feature-item">
                  <div className="presentation-feature-icon">🎤</div>
                  <div>
                    <h4>Voice Debates</h4>
                    <p>Real-time speech-to-text with AI voice responses</p>
                  </div>
                </div>
                <div className="presentation-feature-item">
                  <div className="presentation-feature-icon">🎭</div>
                  <div>
                    <h4>Celebrity Personas</h4>
                    <p>Debate against AI versions of famous debaters and politicians</p>
                  </div>
                </div>
                <div className="presentation-feature-item">
                  <div className="presentation-feature-icon">📱</div>
                  <div>
                    <h4>Mobile App</h4>
                    <p>Native iOS and Android apps for debates on-the-go</p>
                  </div>
                </div>
              </div>
              <div className="presentation-mermaid-placeholder">
                <h4>Future Features Integration</h4>
                <div className="mermaid">{`graph TD
    subgraph "Current Platform"
        A[DebateSim Core<br/>Text-based Debates]
        B[FastAPI Backend]
        C[React Frontend]
    end
    
    subgraph "Voice Integration"
        D[Speech-to-Text API<br/>Real-time Transcription]
        E[Text-to-Speech Engine<br/>AI Voice Responses]
        F[Audio Processing Pipeline]
    end
    
    subgraph "Mobile Apps"
        G[iOS Native App<br/>Swift/SwiftUI]
        H[Android Native App<br/>Kotlin/Compose]
        I[Shared API Integration]
    end
    
    subgraph "Celebrity Personas"
        J[Persona Engine<br/>Character Modeling]
        K[Historical Figures<br/>Political Leaders]
        L[Custom Training Data<br/>Speech Patterns]
    end
    
    A --> D
    A --> G
    A --> H
    A --> J
    
    D --> F
    E --> F
    F --> B
    
    G --> I
    H --> I
    I --> B
    
    J --> K
    J --> L
    L --> B
    
    B --> C
    
    style A fill:#60a5fa,color:#ffffff
    style D fill:#10b981,color:#ffffff
    style G fill:#a855f7,color:#ffffff
    style J fill:#ef4444,color:#ffffff`}
                </div>
              </div>
            </div>

            <div className="presentation-arena-card">
              <h3>AI Debate Arena</h3>
              <p className="presentation-speaker-quote">
                <span className="presentation-speaker">Mrinal:</span>
                "Plus an AI Debate Arena—models battle for a leaderboard rank on debate skill, not exam scores. 
                This will provide as a new debate-related benchmark for models, similar to how companies use math competitions as STEM benchmarks."
              </p>
              <div className="presentation-arena-concept">
                <h4>Arena Concept</h4>
                <div className="presentation-concept-placeholder">
                  🎨 [Arena Concept Art Placeholder]
                  <div className="presentation-leaderboard-mockup">
                    <h5>Model Leaderboard Preview</h5>
                    <div className="presentation-leaderboard-item">
                      <span className="presentation-rank">1.</span>
                      <span className="presentation-model">GPT-4o</span>
                      <span className="presentation-score">1847 ELO</span>
                    </div>
                    <div className="presentation-leaderboard-item">
                      <span className="presentation-rank">2.</span>
                      <span className="presentation-model">Claude-3.5</span>
                      <span className="presentation-score">1823 ELO</span>
                    </div>
                    <div className="presentation-leaderboard-item">
                      <span className="presentation-rank">3.</span>
                      <span className="presentation-model">Gemini-2.0</span>
                      <span className="presentation-score">1799 ELO</span>
                    </div>
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
            
            <div className="presentation-cta-speakers">
              <p className="presentation-speaker-quote">
                <span className="presentation-speaker">Shely:</span>
                "Thanks for watching our tour of DebateSim."
              </p>
              <p className="presentation-speaker-quote">
                <span className="presentation-speaker">Arnav:</span>
                "Try a debate now at DebateSim.us."
              </p>
              <p className="presentation-speaker-quote">
                <span className="presentation-speaker">Mrinal:</span>
                "Star the repo on GitHub and join the community."
              </p>
            </div>

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

            <div className="presentation-final-links">
              <div className="presentation-link-card">
                <h3>🌐 Live Platform</h3>
                <a href="https://debatesim.us">debatesim.us</a>
              </div>
              <div className="presentation-link-card">
                <h3>💻 Open Source</h3>
                <a href="https://github.com/alexliao95311/DebateSim">GitHub Repository</a>
              </div>
              <div className="presentation-link-card">
                <h3>📖 Documentation</h3>
                <a href="/docs">Technical Docs</a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

export default Presentation;