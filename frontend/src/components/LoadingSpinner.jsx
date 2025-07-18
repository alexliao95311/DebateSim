import React, { useState, useEffect } from 'react';
import './LoadingSpinner.css';

const LoadingSpinner = ({ message = "Loading...", showProgress = false, estimatedTime = null }) => {
  const [dots, setDots] = useState('');

  // Animated dots effect
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev === '...') return '';
        return prev + '.';
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="loading-spinner-container">
      <div className="loading-spinner">
        <div className="spinner-ring"></div>
      </div>
      
      <div className="loading-content">
        <h3 className="loading-message">
          {message}{dots}
        </h3>
        
        {showProgress && (
          <div className="progress-container">
            <div className="progress-bar">
              <div className="progress-fill infinite-slide"></div>
            </div>
            <span className="progress-text">Processing...</span>
          </div>
        )}
        
        {estimatedTime && (
          <p className="estimated-time">
            Estimated time: ~{Math.round(estimatedTime / 1000)}s
          </p>
        )}
        
        <div className="loading-tips">
          <p>💡 <strong>Tip:</strong> AI responses may take 30-60 seconds depending on model complexity</p>
        </div>
      </div>
    </div>
  );
};

export default LoadingSpinner;