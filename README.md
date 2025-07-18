# DebateSim

<div align="center">

![DebateSim Logo](https://img.shields.io/badge/DebateSim-AI%20Powered%20Debates-blue?style=for-the-badge)

**An intelligent debate simulation platform powered by advanced AI models**

## **[🌐 LIVE DEMO - debatesim.us](https://debatesim.us)**

[![GitHub](https://img.shields.io/badge/GitHub-Repository-black?style=flat-square&logo=github)](https://github.com/alexliao95311/DebateSim)

</div>

---

## Overview

DebateSim is a sophisticated debate simulation platform that leverages cutting-edge AI technology to create engaging, educational debate experiences. Whether you're a student honing your argumentation skills, an educator facilitating classroom discussions, or simply someone passionate about exploring different perspectives on complex issues, DebateSim provides the tools to engage in structured, high-quality debates.

## Key Features

### **Multi-Modal Debate Formats**
- **AI vs AI**: Watch two AI debaters engage in structured arguments on any topic
- **AI vs User**: Challenge yourself against sophisticated AI opponents
- **User vs User**: Facilitate human-to-human debates with AI moderation

### **Intelligent AI Judge System**
- Comprehensive post-debate analysis and feedback
- Objective evaluation of argument strength and logical consistency
- Detailed breakdown of each debater's performance
- Winner determination with clear reasoning

### **Legislative Analysis** *(In Development)*
- Upload Congressional bills and legislation documents (PDF)
- AI-powered analysis of policy implications
- Multi-perspective debate generation from legislative content
- Text extraction and summarization capabilities

### **Debate Management**
- Persistent debate history and transcript storage
- Downloadable debate records in multiple formats
- User authentication and personalized experience
- Real-time debate progression tracking

### **Advanced Technical Features**
- Multiple AI model support (DeepSeek, OpenAI, Meta LLaMA, Google, Mistral)
- Optimized response caching for improved performance
- RESTful API architecture with FastAPI backend
- Modern React frontend with responsive design
- Firebase integration for user management and data persistence

## Getting Started

### Prerequisites
- Python 3.8+
- Node.js 16+
- OpenRouter API key
- Firebase project (for authentication)

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/alexliao95311/DebateSim.git
   cd DebateSim
   ```

2. **Set up the backend**
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Configure environment variables**
   ```bash
   # Create .env file in project root
   echo "OPENROUTER_API_KEY=your_api_key_here" > .env
   ```

4. **Start the backend server**
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 5000
   ```

5. **Set up the frontend**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

6. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

## Architecture

### Backend Stack
- **FastAPI**: High-performance Python web framework
- **LangChain**: AI model orchestration and prompt management
- **OpenRouter**: Multi-provider AI model access
- **PDFMiner**: Document text extraction
- **Async/Await**: Non-blocking request handling

### Frontend Stack
- **React 18**: Modern component-based UI framework
- **Vite**: Fast build tool and development server
- **React Router**: Client-side routing
- **Firebase**: Authentication and real-time database
- **Markdown Rendering**: Rich text display for debates

### Deployment
- **Production**: Azure VM with Nginx reverse proxy
- **CI/CD**: GitHub Actions automated deployment
- **Domain**: Custom domain with SSL termination
- **Monitoring**: Comprehensive logging and error tracking

## Usage Examples

### Starting an AI vs AI Debate
```javascript
// Navigate to debate simulator
// Select "AI vs AI" mode
// Enter topic: "Universal Basic Income should be implemented globally"
// Watch AI debaters engage in structured argumentation
```

### Analyzing Legislation
```javascript
// Upload PDF of Congressional bill
// Receive AI-powered analysis of key provisions
// Generate debate topics from legislative content
```

### Getting Judge Feedback
```javascript
// Complete any debate format
// Request comprehensive judge analysis
// Receive detailed performance breakdown
```

## API Reference

### Core Endpoints

#### Generate Debate Response
```http
POST /generate-response
Content-Type: application/json

{
  "debater": "Pro",
  "prompt": "Topic: Climate change. Opponent's argument: ...",
  "model": "deepseek/deepseek-r1-0528:free"
}
```

#### Judge Debate
```http
POST /judge-debate
Content-Type: application/json

{
  "transcript": "Full debate transcript...",
  "model": "deepseek/deepseek-r1-0528:free"
}
```

#### Analyze Legislation
```http
POST /analyze-legislation
Content-Type: multipart/form-data

file: [PDF document]
```

## Roadmap

- **Bias Detection Module**: Analyze content for potential bias and misinformation
- **Advanced Debate Formats**: Parliamentary, Oxford Union, and custom formats
- **Real-time Collaboration**: Live multi-user debate sessions
- **Performance Analytics**: Detailed user progress tracking
- **Mobile Application**: Native iOS/Android apps
- **Integration APIs**: Webhook support for educational platforms

## Contributing

We welcome contributions from the community! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details on:

- Code style and standards
- Pull request process
- Issue reporting guidelines
- Development environment setup

### Development Setup
```bash
# Fork the repository
git clone https://github.com/yourusername/DebateSim.git
cd DebateSim

# Create feature branch
git checkout -b feature/your-feature-name

# Make changes and commit
git commit -m "feat: add your feature description"

# Push and create pull request
git push origin feature/your-feature-name
```

## Acknowledgments

- OpenRouter for providing access to multiple AI models
- The open-source community for invaluable tools and libraries
- Contributors and beta testers who helped shape the platform

## Support

- **Live Demo**: [debatesim.us](https://debatesim.us)
- **GitHub Issues**: [Report bugs or request features](https://github.com/alexliao95311/DebateSim/issues)
- **Documentation**: [Full setup and deployment guide](Instructions.md)

---

<div align="center">

**Built with care for the debate and education community**

*Empowering critical thinking through AI-powered discourse*

</div>
