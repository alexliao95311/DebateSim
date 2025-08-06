import React, { useEffect, useState } from "react";
import { Play, Github, ExternalLink, Code, Users, Zap, Target, X, Maximize2 } from "lucide-react";
import mermaid from "mermaid";
import "./Presentation.css";
import Footer from "./Footer.jsx";

function Presentation() {
  const [expandedDiagram, setExpandedDiagram] = useState(null);

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
        
        // Skip if already rendered (contains SVG)
        if (element.querySelector('svg')) continue;
        
        const graphDefinition = element.textContent.trim();
        
        // Skip if content looks like CSS or is empty
        if (!graphDefinition || graphDefinition.includes('font-family') || graphDefinition.includes('#diagram-')) {
          console.warn('Skipping invalid diagram content:', graphDefinition.substring(0, 100));
          continue;
        }
        
        try {
          const { svg } = await mermaid.render(`diagram-${Date.now()}-${i}`, graphDefinition);
          element.innerHTML = svg;
          
          // Add click handler for expansion
          element.style.cursor = 'pointer';
          element.title = 'Click to expand diagram';
          element.addEventListener('click', () => {
            setExpandedDiagram({
              svg: svg,
              title: element.parentElement.querySelector('h4')?.textContent || 'Architecture Diagram'
            });
          });
          
          // Add expand icon overlay
          const expandIcon = document.createElement('div');
          expandIcon.className = 'diagram-expand-icon';
          expandIcon.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6"></path><path d="m21 3-7 7"></path><path d="M9 21H3v-6"></path><path d="m3 21 7-7"></path></svg>';
          element.style.position = 'relative';
          element.appendChild(expandIcon);
          
          console.log(`Successfully rendered diagram ${i}`);
        } catch (error) {
          console.error(`Mermaid rendering error for diagram ${i}:`, error);
          console.error('Failed content:', graphDefinition);
          element.innerHTML = `<p style="color: #ef4444; padding: 20px; text-align: center;">Diagram rendering failed</p>`;
        }
      }
    };

    // Delay rendering to ensure DOM is ready
    setTimeout(renderDiagrams, 1000);

    // Remove intersection observer animations for immediate visibility
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
          className="presentation-section"
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

Please provide judgement with the following sections:
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
          className="presentation-section"
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
                <cite>— Sanjana, Student User</cite>
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

        {/* Roadmap Section */}
        <section
          className="presentation-section"
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
              <div className="presentation-feature-bullets">
                <ul>
                  <li>Voice debates with real-time speech-to-text and AI voice responses</li>
                  <li>Celebrity personas - debate against AI versions of famous figures</li>
                  <li>Native mobile apps for iOS and Android platforms</li>
                  <li>Cross-platform API integration for seamless experience</li>
                </ul>
              </div>
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
            </div>

            <div className="presentation-arena-card">
              <h3>AI Debate Arena</h3>
              <div className="presentation-feature-bullets">
                <ul>
                  <li>AI models compete in debate battles for leaderboard rankings</li>
                  <li>New benchmark focused on debate skills rather than exam scores</li>
                  <li>ELO rating system to track model performance over time</li>
                  <li>Similar to math competitions but for conversational reasoning</li>
                </ul>
              </div>
              <div className="presentation-arena-concept">
                <h4>Arena Concept</h4>
                <div className="presentation-concept-placeholder">
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
          className="presentation-section presentation-cta-section"
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

      {/* Expanded Diagram Modal */}
      {expandedDiagram && (
        <div className="diagram-modal-overlay" onClick={() => setExpandedDiagram(null)}>
          <div className="diagram-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="diagram-modal-header">
              <h3>{expandedDiagram.title}</h3>
              <button 
                className="diagram-modal-close"
                onClick={() => setExpandedDiagram(null)}
              >
                <X size={24} />
              </button>
            </div>
            <div className="diagram-modal-body">
              <div 
                className="expanded-diagram"
                dangerouslySetInnerHTML={{ __html: expandedDiagram.svg }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Presentation;