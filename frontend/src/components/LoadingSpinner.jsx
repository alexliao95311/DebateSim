import React, { useState, useEffect } from 'react';
import './LoadingSpinner.css';

const LoadingSpinner = ({ message = "Loading...", showProgress = false }) => {
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
      </div>
    </div>
  );
};

export default LoadingSpinner;