import React, { useState, useRef } from 'react';
import { extractTextFromFile, validateFile, formatExtractedText } from '../utils/fileProcessor';
import './FileUploadInput.css';

const FileUploadInput = ({ 
  value, 
  onChange, 
  placeholder = "Enter your argument or upload a file (PDF, DOCX, TXT)",
  disabled = false,
  onKeyDown = null,
  rows = 4
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const fileInputRef = useRef(null);

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploadError('');
    setIsProcessing(true);

    try {
      // Validate file
      const validation = validateFile(file);
      if (!validation.isValid) {
        setUploadError(validation.error);
        return;
      }

      // Extract text from file
      const extractedText = await extractTextFromFile(file);
      const formattedText = formatExtractedText(extractedText);

      if (!formattedText || formattedText.length === 0) {
        setUploadError('No readable text found in the file.');
        return;
      }

      // Update the text input with extracted content
      onChange({ target: { value: formattedText } });
      setUploadedFileName(file.name);
      
      // Clear the file input so the same file can be uploaded again if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (error) {
      console.error('File processing error:', error);
      setUploadError(error.message || 'Failed to process file. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      // Create a fake file input event
      const fakeEvent = {
        target: {
          files: [file]
        }
      };
      handleFileSelect(fakeEvent);
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const clearText = () => {
    onChange({ target: { value: '' } });
    setUploadedFileName('');
    setUploadError('');
  };

  const hasContent = value && value.trim().length > 0;

  return (
    <div className="file-upload-input-container">
      {/* File upload area */}
      <div 
        className={`file-upload-area ${isProcessing ? 'processing' : ''} ${uploadError ? 'error' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          disabled={disabled || isProcessing}
        />
        
        <div className="upload-content">
          {isProcessing ? (
            <div className="processing-indicator">
              <div className="spinner"></div>
              <span>Processing file...</span>
            </div>
          ) : (
            <>
              <div className="upload-icon">📄</div>
              <div className="upload-text">
                <strong>Drop a file here or click to upload</strong>
                <br />
                <small>Supports PDF, DOCX, and TXT files (max 10MB)</small>
              </div>
              <button
                type="button"
                className="upload-button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
              >
                Choose File
              </button>
            </>
          )}
        </div>
      </div>

      {/* Error message */}
      {uploadError && (
        <div className="upload-error">
          Warning: {uploadError}
        </div>
      )}

      {/* Success message */}
      {uploadedFileName && !uploadError && (
        <div className="upload-success">
          ✅ Text extracted from: {uploadedFileName}
        </div>
      )}

      {/* Text input area */}
      <div className="text-input-container">
        <textarea
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          rows={rows}
          disabled={disabled || isProcessing}
          className={`text-input ${hasContent ? 'has-content' : ''}`}
        />
        
        {hasContent && (
          <button
            type="button"
            className="clear-button"
            onClick={clearText}
            disabled={disabled || isProcessing}
            title="Clear text"
          >
            ✕
          </button>
        )}
      </div>

      {/* Character count */}
      {hasContent && (
        <div className="character-count">
          {value.length.toLocaleString()} characters
        </div>
      )}
    </div>
  );
};

export default FileUploadInput;