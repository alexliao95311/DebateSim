# DebateSim: AI-Powered Legislative Analysis & Debate Platform

<div align="center">

![DebateSim Logo](https://img.shields.io/badge/DebateSim-AI%20Powered%20Debates-blue?style=for-the-badge)

**An intelligent debate simulation platform powered by advanced AI models for democratic discourse and legislative analysis**

## **[LIVE DEMO - debatesim.us](https://debatesim.us)**

[![GitHub](https://img.shields.io/badge/GitHub-Repository-black?style=flat-square&logo=github)](https://github.com/alexliao95311/DebateSim)
[![Documentation](https://img.shields.io/badge/Documentation-Technical%20Report-green?style=flat-square&logo=gitbook)](docs/PROJECT_REPORT.md)
[![API Reference](https://img.shields.io/badge/API-Reference%20Guide-blue?style=flat-square&logo=swagger)](docs/API_REFERENCE.md)

</div>

---

## **Documentation**

**Complete Technical Documentation** is available in the [`docs/`](docs/) folder:

- **[Technical Project Report](docs/PROJECT_REPORT.md)** - Comprehensive analysis covering AI techniques, architecture, ethics, and evaluation
- **[API Reference Guide](docs/API_REFERENCE.md)** - Developer documentation with code examples and integration guides
- **[Documentation Hub](docs/README.md)** - Navigation guide for researchers, developers, and educators

*For quick access to specific sections, see the [Documentation Navigation Guide](docs/README.md#quick-navigation)*

---

## Problem Statement and Motivation

### The Challenge of Democratic Discourse

In an era of increasing polarization and declining civic engagement, quality democratic discourse has become critically endangered. Several key challenges motivated the development of DebateSim:

1. **Educational Gap**: Students and educators lack accessible tools for practicing structured argumentation and debate skills
2. **Legislative Complexity**: Citizens struggle to understand complex legislative documents and their implications
3. **Bias and Echo Chambers**: Limited exposure to well-reasoned opposing viewpoints reinforces existing beliefs
4. **Accessibility Barriers**: Traditional debate formats require significant resources, scheduling, and expertise
5. **Lack of Objective Analysis**: Human bias often clouds debate evaluation and feedback

### Our Vision

DebateSim addresses these challenges by democratizing access to high-quality debate experiences through AI technology. The platform aims to:

- **Enhance Critical Thinking**: Provide structured environments for developing argumentation skills
- **Increase Civic Engagement**: Make legislative analysis accessible to everyday citizens
- **Combat Misinformation**: Offer fact-based, multi-perspective analysis of complex issues
- **Scale Educational Impact**: Enable simultaneous debate experiences for unlimited users
- **Preserve Democratic Values**: Maintain human agency while leveraging AI assistance

---

## **Key Features**

### **Multi-Model AI Integration**
- **4+ AI Providers**: GPT-4o, Claude 3.5 Sonnet, Gemini 2.0 Flash, LLaMA 3.3 with real-time switching
- **Intelligent Fallbacks**: Automatic model switching for improved reliability
- **Specialized Prompts**: Custom-engineered for debate, analysis, and judging
- **Custom LangChain Integration**: Built custom `OpenRouterChat` class for OpenRouter API compatibility

### **Comprehensive Legislative Analysis**
- **Federal Bills**: Real-time integration with Congress.gov API (119th Congress)
- **State Bills**: All 50 US states via LegiScan API with multi-session support
- **California Propositions**: Ballot measures from CA Secretary of State
- **Advanced PDF Processing**: Handle 40,000+ character legislative documents
- **6-Criteria Grading System**: Economic Impact, Public Benefit, Implementation Feasibility, Constitutional Concerns, Political Viability, Democratic Impact
- **Smart Section Extraction**: Intelligent parsing of bill sections for targeted analysis

### **Three Debate Modes**
- **AI vs AI**: Watch sophisticated AI arguments unfold in real-time
- **AI vs User**: Practice and improve your debate skills against AI opponents
- **User vs User**: Human debates with AI moderation and analysis

### **Multiple Debate Formats**
- **Default Format**: Standard academic debate structure
- **Public Forum**: Accessible format focused on current events with cross-examinations
- **Lincoln-Douglas**: Value-based philosophical argumentation

### **AI Personae**
- **Default AI**: Standard debate style
- **Donald Trump**: Bold, confident, superlatives-focused rhetoric
- **Kamala Harris**: Prosecutorial, structured, evidence-based argumentation
- **Elon Musk**: Analytical, first-principles, technical approach
- **Drake**: Smooth, introspective, authentic Toronto style

Each persona uses custom-engineered prompts that inject unique speaking patterns, vocabulary, and rhetorical styles.

### **AI-Powered Judging**
- **Objective Evaluation**: Bias-neutral assessment across multiple criteria
- **Detailed Feedback**: Actionable insights for improvement with specific examples
- **Multi-Model Consensus**: Enhanced accuracy through model diversity
- **Winner Determination**: Clear rationale for debate outcomes

### **Voice Integration**
- **Speech-to-Text**: Real-time voice input during debates using Web Speech API
- **Text-to-Speech**: AI-generated audio responses with Google Cloud TTS
- **Context-Aware Voices**: Speaker-specific voice selection
- **Live Transcription**: See your speech transcribed in real-time
- **Browser-Native**: No app downloads required (Chrome/Edge/Brave support)

### **Transcript Management**
- **Auto-Save**: Automatic saving to Firebase Firestore
- **History**: View all past debates with filtering and sorting
- **Public Sharing**: Generate shareable links with read-only access
- **PDF Export**: Professional transcript formatting with judge feedback
- **Metadata Tracking**: Complete debate details (mode, model, timestamp, participants)

### **Advanced Search & Discovery**
- **Fuzzy Matching**: Smart search with typo tolerance using rapidfuzz
- **Synonym Expansion**: Broad search coverage with related terms
- **Popular Terms Database**: Quick access to trending topics
- **Intelligent Caching**: 30-minute TTL for search results to reduce API calls
- **Multi-Source Search**: Unified interface for federal, state, and proposition searches

---

## **Tech Stack**

### Backend Technologies
- **FastAPI** - High-performance async web framework with 30+ API endpoints
- **LangChain** - AI model orchestration and prompt management
- **Custom OpenRouterChat** - Custom LangChain class for OpenRouter API integration
- **OpenRouter** - Multi-provider AI model gateway (GPT-4o, Claude, Gemini, LLaMA)
- **PDFMiner & PDFPlumber** - Advanced PDF text extraction
- **Congress.gov API** - Real-time federal legislative data
- **LegiScan API** - State bills from all 50 US states
- **Google Cloud Speech-to-Text** - High-accuracy voice recognition
- **Google Cloud Text-to-Speech** - Natural-sounding AI voices
- **Cachetools** - TTL-based intelligent caching
- **Firebase Admin** - Authentication and database management
- **Sentence Transformers** - Text embeddings for semantic search
- **RapidFuzz** - Fuzzy string matching for search

### Frontend Technologies
- **React 18** - Modern hooks-based UI development
- **Firebase** - Google OAuth authentication and Firestore database
- **Vite** - Lightning-fast build tooling and development server
- **Axios** - Promise-based HTTP client with 120s timeout
- **React Router** - Client-side routing
- **React Markdown** - GitHub-flavored markdown rendering
- **jsPDF & html2pdf.js** - Professional PDF generation
- **LangChain.js** - Frontend LangChain integration
- **Lucide React** - Icon library
- **Bootstrap 5** - UI framework and styling

### External Services & APIs
- **OpenRouter** - Access to 4+ AI model providers
- **Congress.gov** - Federal legislative data
- **LegiScan** - State legislative data (all 50 states)
- **CA Secretary of State** - California ballot propositions
- **Google Cloud Platform** - Speech-to-Text and Text-to-Speech
- **Firebase** - Authentication, Firestore, Analytics

### Performance Metrics
- **30+ API endpoints** for comprehensive functionality
- **Multi-layer caching** with 30-min to 24-hour TTL
- **40,000+ character** document processing capability
- **Real-time** Congressional and state legislative data integration
- **Multi-model fallback** architecture for 99%+ uptime
- **120-second timeout** for complex AI operations
- **Async/await patterns** throughout for optimal performance

---

## **Architecture Overview**

### System Architecture
```
User Interface (React 18)
    ↓
Frontend API Client (Axios)
    ↓
FastAPI Backend (:8000)
    ↓
┌─────────────────┬──────────────────┬────────────────┐
│   LangChain     │   Legislative    │     Voice      │
│   Chains        │   APIs           │   Services     │
├─────────────────┼──────────────────┼────────────────┤
│ Debater Chain   │ Congress.gov     │ Google STT     │
│ Judge Chain     │ LegiScan         │ Google TTS     │
│ OpenRouterChat  │ CA SOS           │ Web Speech API │
└─────────────────┴──────────────────┴────────────────┘
    ↓
AI Model Providers (OpenRouter Gateway)
    ↓
GPT-4o | Claude 3.5 | Gemini 2.0 | LLaMA 3.3
```

### Key Components
- **28 React Components**: Modular UI with clear separation of concerns
- **Custom LangChain Classes**: `OpenRouterChat` for seamless OpenRouter integration
- **Multi-Source Bill Search**: Unified search across federal, state, and proposition databases
- **Intelligent Caching Layer**: Multiple TTL strategies for different data types
- **Firebase Integration**: Secure authentication and persistent transcript storage

---

## **Quick Start**

### Try the Platform
1. **Visit**: [debatesim.us](https://debatesim.us)
2. **Sign Up**: Create account with Google authentication
3. **Choose Mode**: Select AI vs AI, AI vs User, or User vs User
4. **Pick Format**: Default, Public Forum, or Lincoln-Douglas
5. **Select Persona**: Choose AI debate style (optional)
6. **Start Debating**: Enter topic or select legislation to debate
7. **Use Voice Input**: Click microphone button to speak your arguments (optional)
8. **Get Judged**: Receive comprehensive AI feedback and scoring

### For Developers
```bash
# API Quick Start - Generate Debate Response
curl -X POST "http://localhost:8000/generate-response" \
  -H "Content-Type: application/json" \
  -d '{
    "debater": "Pro AI",
    "prompt": "AI safety is critical for society",
    "model": "openai/gpt-4o",
    "debate_format": "default",
    "persona": "default"
  }'

# Search Congressional Bills
curl -X POST "http://localhost:8000/search-bills" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "climate change",
    "limit": 10
  }'

# Analyze Legislation
curl -X POST "http://localhost:8000/analyze-legislation-text" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Your bill text here...",
    "model": "openai/gpt-4o"
  }'
```

**Complete API documentation with examples**: [API Reference Guide](docs/API_REFERENCE.md)

---

## **Installation & Development**

### Prerequisites
- **Python 3.9+** for backend
- **Node.js 18+** for frontend
- **API Keys**: OpenRouter (required), Congress.gov (optional), LegiScan (optional)
- **Google Cloud Account** (optional, for TTS/STT features)

### Local Development Setup
```bash
# Clone repository
git clone https://github.com/alexliao95311/DebateSim.git
cd DebateSim

# Backend setup
pip install -r requirements.txt
cp .env.example .env  # Add your API keys

# Start backend server (runs on http://localhost:8000)
python main.py

# Frontend setup (new terminal)
cd frontend
npm install
npm run dev  # Runs on http://localhost:5173
```

### Environment Variables
```env
# Required
OPENROUTER_API_KEY=your_openrouter_key
FIREBASE_CONFIG=your_firebase_config

# Optional - Legislative Data
CONGRESS_API_KEY=your_congress_key
LEGISCAN_API_KEY=your_legiscan_key

# Optional - Voice Features
GOOGLE_CLOUD_PROJECT_ID=your_project_id
GOOGLE_APPLICATION_CREDENTIALS=path/to/credentials.json

# Frontend
VITE_API_URL=http://localhost:8000
VITE_FIREBASE_CONFIG=your_firebase_config

# Backend CORS
BACKEND_ORIGINS=http://localhost:5173,http://localhost:3000
```

### Testing
```bash
# Backend tests
python -m pytest

# Frontend tests
cd frontend
npm test

# Voice features test
cd speech_utils
python3 test_v2t.py
```

---

## **Voice-to-Text Integration**

**Real-time speech recognition** is now available in the [`speech_utils/`](speech_utils/) folder:

- **[Speech Utilities README](speech_utils/README.md)** - Complete setup and usage guide
- **Google Cloud Speech-to-Text** - High-accuracy real-time transcription
- **Easy Integration** - Simple API for adding voice input to debates
- **Testing Tools** - Comprehensive test suite and examples

*Quick test: `cd speech_utils && python3 test_v2t.py`*

### **Frontend Voice Input**

**Browser-based speech recognition** is now integrated into the debate interface:

- **🎤 Voice Input Component** - Real-time speech-to-text in debates
- **AI vs User Mode** - Speak your arguments instead of typing
- **User vs User Mode** - Voice input for both debaters
- **Chrome/Edge Support** - Uses Web Speech API for browser compatibility
- **Live Transcription** - See your speech transcribed in real-time

*Available in all debate modes with microphone access*

---

## **Project Structure**

```
DebateSim/
├── frontend/                      # React 18 application
│   ├── src/
│   │   ├── components/           # 28 React components
│   │   │   ├── Debate.jsx       # Main debate interface (2,747 lines)
│   │   │   ├── Legislation.jsx  # Bill analysis & selection
│   │   │   ├── Judge.jsx        # Judging interface
│   │   │   ├── DebateSim.jsx    # Debate setup wizard
│   │   │   ├── Home.jsx         # Landing page
│   │   │   ├── History.jsx      # Transcript history
│   │   │   ├── EnhancedVoiceOutput.jsx  # TTS component
│   │   │   ├── VoiceInput.jsx   # Speech-to-text
│   │   │   └── [20+ more]
│   │   ├── services/            # Service layer
│   │   ├── firebase/            # Firebase integration
│   │   ├── utils/               # Utility functions
│   │   └── api.js               # Axios API client
│   └── package.json
│
├── chains/                       # LangChain prompt chains
│   ├── debater_chain.py         # Debate generation (969 lines)
│   └── judge_chain.py           # AI judging engine
│
├── main.py                       # FastAPI backend (2,287 lines, 30+ endpoints)
│
├── Support Services
│   ├── billsearch.py            # Congress.gov integration
│   ├── legiscan_service.py      # State bills (all 50 states)
│   ├── ca_propositions_service.py  # CA ballot measures
│   └── speech_utils/            # Voice features
│
├── Documentation
│   ├── docs/                    # Technical reports
│   ├── API_DOCUMENTATION.md
│   ├── STATE_BILLS_SUMMARY.md
│   └── CA_PROPOSITIONS_FRONTEND.md
│
├── requirements.txt             # 54 Python dependencies
└── .env                        # Configuration
```

---

## **Unique Features & Innovation**

### Multi-Model Fallback Architecture
Unlike most debate platforms that rely on a single AI provider, DebateSim supports simultaneous access to 4+ providers with automatic fallback:
- OpenAI (GPT-4o, GPT-4o-mini, search-preview)
- Anthropic (Claude 3.5 Sonnet)
- Google (Gemini 2.0 Flash)
- Meta (LLaMA 3.3 70B)

Users can choose different models for debaters vs judges, and the system automatically falls back to secondary models if the primary fails.

### Comprehensive Legislative Coverage
Three distinct legislative data sources in one platform:
1. **Federal Bills** (Congress.gov) - 119th Congress with real-time updates
2. **State Bills** (LegiScan) - All 50 states with multiple legislative sessions
3. **California Propositions** (SOS) - Ballot measures with voter guide integration

### Persona-Based Style Injection
Goes beyond simple style transfer with full rhetorical pattern adoption:
- Custom vocabulary and phrase patterns
- Argumentation structure preferences
- Reference and citation styles
- Emotional tone calibration
- Character-specific speech patterns

### 6-Criteria AI Grading Rubric
More comprehensive than typical pass/fail analysis:
1. **Economic Impact** - Fiscal analysis and budget implications
2. **Public Benefit** - Social benefit and community impact
3. **Implementation Feasibility** - Practical execution challenges
4. **Constitutional Concerns** - Legal and constitutional issues
5. **Political Viability** - Likelihood of passage and support
6. **Democratic Impact** - Effects on democratic processes

### Real-Time Voice Integration
Rare in debate platforms - fully browser-native:
- Live speech-to-text during debates
- Optional voice output for AI responses
- No app downloads required
- Dual-language support potential

---

## **Use Cases**

### Education
- **High Schools**: Debate team practice and skill development
- **Universities**: Political science and rhetoric courses
- **Mock Trials**: Legal argument practice
- **Civic Education**: Understanding legislative processes

### Research
- **Policy Analysis**: Quick evaluation of legislative proposals
- **Public Opinion**: Understanding different perspectives
- **Argumentation Studies**: Analysis of debate techniques
- **AI Ethics**: Studying AI-human interaction patterns

### Professional
- **Legislative Staff**: Bill impact analysis
- **Policy Advocates**: Argument development
- **Journalists**: Understanding complex legislation
- **Legal Professionals**: Case argument practice

### Personal Development
- **Critical Thinking**: Improve analytical skills
- **Public Speaking**: Practice articulation
- **Civic Engagement**: Understand current legislation
- **Opinion Formation**: Explore multiple viewpoints

---

## **Contributing**

We welcome contributions! Whether you're fixing bugs, adding features, or improving documentation:

1. **Fork** the repository
2. **Create** feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** changes: `git commit -m 'Add amazing feature'`
4. **Push** branch: `git push origin feature/amazing-feature`
5. **Open** Pull Request

### Areas for Contribution
- **AI Integration**: New model providers, prompt improvements, or persona development
- **Data Sources**: Additional legislative APIs, international bills, or document parsers
- **UI/UX**: Frontend improvements, accessibility features, or mobile optimization
- **Documentation**: Tutorials, examples, translations, or video guides
- **Testing**: Unit tests, integration tests, or performance benchmarks
- **Features**: New debate formats, analysis tools, or export options

*Contribution guidelines: [Technical Report - Future Improvements](docs/PROJECT_REPORT.md#future-improvements-and-scalability)*

---

## **Impact & Ethics**

DebateSim is designed with responsible AI principles at its core:

### **Educational Impact**
- **Improved legislative understanding** through accessible analysis tools
- **Enhanced critical thinking** through structured argumentation
- **Global accessibility** to quality debate education
- **Scalable learning** - unlimited simultaneous users
- **Diverse perspectives** exposure through AI-moderated discourse

### **Ethical AI Implementation**
- **Multi-model approach** reduces single-point-of-bias
- **Transparent attribution** of AI-generated content
- **Evidence-based requirements** for all arguments
- **Human oversight** capabilities throughout
- **Privacy-focused** - minimal data collection
- **Open documentation** of AI techniques and limitations

### **Democratic Values**
- **Civic engagement** through accessible legislative analysis
- **Informed participation** in democratic processes
- **Critical media literacy** development
- **Balanced perspectives** presentation
- **Fact-based discourse** encouragement

*Complete ethical analysis: [Technical Report - Ethical Considerations](docs/PROJECT_REPORT.md#ethical-considerations)*

---

## **Code Metrics**

| Metric | Count |
|--------|-------|
| Frontend Components | 28 |
| Backend API Endpoints | 30+ |
| Python Dependencies | 54 |
| Main Backend Lines | 2,287 |
| Debate Component Lines | 2,747 |
| Debater Chain Lines | 969 |
| Supported Debate Formats | 3 |
| AI Personae | 5 |
| AI Model Providers | 4+ |
| Legislative Data Sources | 3 |
| Supported US States | 50 |
| Documentation Files | 15+ |

---

## **Acknowledgments**

- **OpenRouter** for providing access to multiple AI model providers
- **Congress.gov** for comprehensive federal legislative data access
- **LegiScan** for state legislative data across all 50 states
- **Google Cloud** for Speech-to-Text and Text-to-Speech services
- **Firebase** for authentication and database infrastructure
- **The open-source community** for invaluable tools and libraries
- **Contributors and beta testers** who helped shape the platform
- **Educational institutions** providing feedback and validation

---

## **Support and Resources**

- **Live Demo**: [debatesim.us](https://debatesim.us)
- **Technical Documentation**: [Complete Project Report](docs/PROJECT_REPORT.md)
- **API Documentation**: [Developer Reference Guide](docs/API_REFERENCE.md)
- **Documentation Hub**: [Navigation Guide for All Users](docs/README.md)
- **GitHub Issues**: [Report bugs or request features](https://github.com/alexliao95311/DebateSim/issues)
- **Setup Guide**: [Development and deployment instructions](Instructions.md)

---

## **Future Roadmap**

### Planned Features
- **Mobile App**: Native iOS and Android applications
- **International Bills**: Legislative data from other countries
- **Tournament Mode**: Structured multi-round competitions
- **Advanced Analytics**: Performance tracking and improvement metrics
- **Custom Prompts**: User-defined debate rules and formats
- **Video Debates**: Integration with video conferencing
- **Real-Time Collaboration**: Multiple users in same debate
- **Blockchain Verification**: Immutable transcript records

### Technical Improvements
- **Model Fine-Tuning**: Custom models trained on debate data
- **Enhanced Caching**: Redis-based distributed caching
- **GraphQL API**: More flexible data querying
- **WebSocket Support**: Real-time updates without polling
- **Kubernetes Deployment**: Scalable container orchestration
- **Enhanced Security**: Additional authentication methods

*See [Technical Report](docs/PROJECT_REPORT.md#future-improvements-and-scalability) for detailed roadmap*

---

<div align="center">

**Built with care for the debate and education community**

*Empowering critical thinking through AI-powered discourse*

**License**: MIT | **Version**: 1.0.0 | **Last Updated**: January 2025

</div>
