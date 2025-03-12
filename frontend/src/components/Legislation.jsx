import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, signOut } from 'firebase/auth';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import "./Legislation.css";

const Legislation = ({ user }) => {
  const [pdfFile, setPdfFile] = useState(null);
  const [articleLink, setArticleLink] = useState('');
  const [error, setError] = useState('');
  const [analysisResult, setAnalysisResult] = useState('');
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const navigate = useNavigate();

  const handlePdfUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      setError('');
    } else {
      setError('Please upload a valid PDF file.');
    }
  };

  const handleLinkChange = (event) => {
    setArticleLink(event.target.value);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!pdfFile && !articleLink) {
      setError('Please upload a PDF or provide a link to a legislative article.');
      return;
    }
    if (pdfFile) {
      setAnalysisLoading(true);
      const formData = new FormData();
      formData.append('file', pdfFile);
      try {
        const response = await fetch("http://localhost:8000/analyze-legislation", {
          method: "POST",
          body: formData,
        });
        const data = await response.json();
        setAnalysisResult(data.analysis);
      } catch (err) {
        setError("Error analyzing the bill.");
      }
      setAnalysisLoading(false);
    } else if (articleLink) {
      setError("Article link analysis is not supported yet.");
    }
  };

  const handleLogout = () => {
    signOut(getAuth())
      .then(() => {
        navigate('/login');
      })
      .catch((err) => console.error("Logout error:", err));
  };

  return (
    <div className="legislation-container">
      <header className="home-header">
        <div className="header-content">
          <div className="header-left"></div>
          <div className="header-center">
            <h1 className="site-title" onClick={() => navigate("/")} style={{ cursor: "pointer" }}>
              Bill and Legislation Debate
            </h1>
          </div>
          <div className="header-right">
            <span className="username">{user?.displayName}</span>
            <button className="logout-button" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="main-content">
        <h2>Upload Legislative Article</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="pdfUpload">Upload PDF:</label>
            <input type="file" id="pdfUpload" accept="application/pdf" onChange={handlePdfUpload} />
          </div>
          <div className="form-group">
            <label htmlFor="articleLink">Or provide a link:</label>
            <input
              type="url"
              id="articleLink"
              value={articleLink}
              onChange={handleLinkChange}
              placeholder="https://example.com/article"
            />
          </div>
          {error && <p className="error-text">{error}</p>}
          <button type="submit">Submit</button>
        </form>
        {analysisLoading && <p>Analyzing bill, please wait...</p>}
        {analysisResult && (
          <div className="analysis-result">
            <h3>Bill Analysis</h3>
            <ReactMarkdown rehypePlugins={[rehypeRaw]} className="markdown-renderer">
              {analysisResult}
            </ReactMarkdown>
          </div>
        )}
      </div>

      <footer className="bottom-text">
        <a
          href="https://github.com/alexliao95311/DebateSim"
          target="_blank"
          rel="noopener noreferrer"
          className="github-link"
        >
          GitHub
        </a>
        <span>&copy; {new Date().getFullYear()} DebateSim. All rights reserved.</span>
      </footer>
    </div>
  );
};

export default Legislation;