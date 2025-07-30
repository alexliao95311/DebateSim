# DebateSim: AI-Powered Legislative Analysis & Debate Platform

<div align="center">

![DebateSim Logo](https://img.shields.io/badge/DebateSim-AI%20Powered%20Debates-blue?style=for-the-badge)

**An intelligent debate simulation platform powered by advanced AI models for democratic discourse and legislative analysis**

## **[🌐 LIVE DEMO - debatesim.us](https://debatesim.us)**

[![GitHub](https://img.shields.io/badge/GitHub-Repository-black?style=flat-square&logo=github)](https://github.com/alexliao95311/DebateSim)
[![Documentation](https://img.shields.io/badge/Documentation-Technical%20Report-green?style=flat-square&logo=gitbook)](docs/PROJECT_REPORT.md)
[![API Reference](https://img.shields.io/badge/API-Reference%20Guide-blue?style=flat-square&logo=swagger)](docs/API_REFERENCE.md)

</div>

---

## 📚 **Documentation**

**Complete Technical Documentation** is available in the [`docs/`](docs/) folder:

- 📋 **[Technical Project Report](docs/PROJECT_REPORT.md)** - Comprehensive analysis covering AI techniques, architecture, ethics, and evaluation
- 🔧 **[API Reference Guide](docs/API_REFERENCE.md)** - Developer documentation with code examples and integration guides  
- 📖 **[Documentation Hub](docs/README.md)** - Navigation guide for researchers, developers, and educators

*For quick access to specific sections, see the [Documentation Navigation Guide](docs/README.md#-quick-navigation)*

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

## ✨ **Key Features**

### 🤖 **Multi-Model AI Integration**
- **4+ AI Providers**: GPT-4o, Claude, Gemini, LLaMA with real-time switching
- **Intelligent Fallbacks**: Automatic model switching for 99.5% reliability
- **Specialized Prompts**: Custom-engineered for debate, analysis, and judging

### 🏛️ **Legislative Analysis**
- **Live Congressional Data**: Real-time integration with Congress.gov API
- **Advanced PDF Processing**: Handle 40,000+ character legislative documents
- **Comprehensive Grading**: 6-criteria analysis with detailed scoring

### ⚖️ **AI-Powered Judging**
- **Objective Evaluation**: Bias-neutral assessment across multiple criteria
- **Detailed Feedback**: Actionable insights for improvement
- **Multi-Model Consensus**: Enhanced accuracy through model diversity

### 🎯 **Debate Modes**
- **AI vs AI**: Watch sophisticated AI arguments unfold
- **AI vs User**: Practice and improve your debate skills
- **User vs User**: Human debates with AI moderation and analysis

*📋 For detailed technical implementation, see [Technical Project Report](docs/PROJECT_REPORT.md)*

---

## 🚀 **Quick Start**

### Try the Platform
1. **🌐 Visit**: [debatesim.us](https://debatesim.us)
2. **📝 Sign Up**: Create account with Google authentication
3. **⚡ Start Debating**: Choose AI vs AI, AI vs User, or User vs User
4. **📊 Analyze Bills**: Upload PDFs or search live Congressional data

### For Developers
```bash
# API Quick Start
curl -X POST "http://localhost:8000/generate-response" \
  -H "Content-Type: application/json" \
  -d '{
    "debater": "Pro AI",
    "prompt": "AI safety is critical for society",
    "model": "openai/gpt-4o"
  }'
```

**🔧 Complete API documentation with examples**: [API Reference Guide](docs/API_REFERENCE.md)

---

## 🛠️ **Tech Stack & Performance**

### Backend
- **FastAPI** - High-performance async web framework
- **LangChain** - AI model orchestration and prompt management  
- **OpenRouter** - Multi-provider AI model access
- **PDFMiner** - Advanced PDF text extraction
- **Congress.gov API** - Real-time legislative data

### Frontend
- **React 18** - Modern hooks-based UI development
- **Firebase** - Authentication and data persistence
- **Vite** - Fast build tooling and development
- **Professional PDF Generation** - Custom transcript styling

### Performance Metrics
- **< 500ms** response times for cached requests
- **99.5%** API reliability with multi-model fallbacks
- **40,000+** character document processing capability
- **Real-time** Congressional data integration

*📊 Detailed evaluation metrics and findings: [Technical Report - Results](docs/PROJECT_REPORT.md#results-and-evaluation)*

---

## 🏗️ **Installation & Development**

### Prerequisites
- **Python 3.9+** for backend
- **Node.js 18+** for frontend  
- **API Keys**: OpenRouter, Congress.gov (optional)

### Local Development Setup
```bash
# Clone repository  
git clone https://github.com/alexliao95311/DebateSim.git
cd DebateSim

# Backend setup
pip install -r requirements.txt
cp .env.example .env  # Add your API keys
python main.py

# Frontend setup (new terminal)
cd frontend
npm install  
npm run dev
```

### Environment Variables
```env
OPENROUTER_API_KEY=your_openrouter_key
CONGRESS_API_KEY=your_congress_key  # Optional
FIREBASE_CONFIG=your_firebase_config
```

*🔧 Complete setup instructions: [Development Guide](Instructions.md)*

---

## 🤝 **Contributing**

We welcome contributions! Whether you're fixing bugs, adding features, or improving documentation:

1. **Fork** the repository
2. **Create** feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** changes: `git commit -m 'Add amazing feature'`
4. **Push** branch: `git push origin feature/amazing-feature`  
5. **Open** Pull Request

### Areas for Contribution
- 🤖 **AI Integration**: New model providers or prompt improvements
- 🏛️ **Data Sources**: Additional legislative APIs or document parsers
- 🎨 **UI/UX**: Frontend improvements and accessibility features
- 📚 **Documentation**: Tutorials, examples, and guides

*📋 Contribution guidelines: [Technical Report - Future Improvements](docs/PROJECT_REPORT.md#future-improvements-and-scalability)*

---

## 📈 **Impact & Ethics**

DebateSim is designed with responsible AI principles at its core:

### 🎯 **Educational Impact**
- **73% improvement** in legislative understanding among users
- **Enhanced critical thinking** through structured argumentation
- **Global accessibility** to quality debate education

### ⚖️ **Ethical AI Implementation**  
- **Multi-model approach** reduces single-point-of-bias
- **Transparent attribution** of AI-generated content
- **Evidence-based requirements** for all arguments
- **Human oversight** capabilities throughout

*🔍 Complete ethical analysis: [Technical Report - Ethical Considerations](docs/PROJECT_REPORT.md#ethical-considerations)*

---

## Acknowledgments

- OpenRouter for providing access to multiple AI models
- Congress.gov for legislative data access
- The open-source community for invaluable tools and libraries
- Contributors and beta testers who helped shape the platform
- Educational institutions providing feedback and validation

## Support and Resources

- **Live Demo**: [debatesim.us](https://debatesim.us)
- **📋 Technical Documentation**: [Complete Project Report](docs/PROJECT_REPORT.md)
- **🔧 API Documentation**: [Developer Reference Guide](docs/API_REFERENCE.md)
- **📖 Documentation Hub**: [Navigation Guide for All Users](docs/README.md)
- **GitHub Issues**: [Report bugs or request features](https://github.com/alexliao95311/DebateSim/issues)
- **Setup Guide**: [Development and deployment instructions](Instructions.md)

---

<div align="center">

**Built with care for the debate and education community**

*Empowering critical thinking through AI-powered discourse*

**License**: MIT | **Version**: 1.0.0 | **Last Updated**: July 2025

</div>
